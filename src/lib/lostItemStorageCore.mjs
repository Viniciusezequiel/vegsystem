import { getStorageProvider, R2_LOST_ITEMS_PREFIX } from './r2CapabilityResolver.mjs';

const SAFE_SEGMENT = /^[^\\\u0000-\u001f\u007f]+$/;
const NEW_LOST_ITEM_LOCATOR = /^r2\/lost-items\/\d{4}\/(?:0[1-9]|1[0-2])\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}-[0-9a-f]{16}\.webp$/i;

export function r2NewUploadsEnabled(value) {
  return value === 'true';
}

export function validateR2LostItemLocator(locator) {
  if (typeof locator !== 'string' || !locator.startsWith(R2_LOST_ITEMS_PREFIX)) return null;
  const key = locator.slice(R2_LOST_ITEMS_PREFIX.length);
  if (!key || key.length > 900 || key.startsWith('/') || key.endsWith('/') || key.includes('//')) return null;
  const segments = key.split('/');
  if (segments.some(segment => !segment || segment === '.' || segment === '..' || segment.length > 255 || !SAFE_SEGMENT.test(segment))) return null;
  return { locator, key, encodedKey: segments.map(encodeURIComponent).join('/') };
}

export function validateNewR2LostItemLocator(locator) {
  const parsed = validateR2LostItemLocator(locator);
  return parsed && NEW_LOST_ITEM_LOCATOR.test(parsed.locator) ? parsed : null;
}

export class LostItemStorageError extends Error {
  constructor(message, { status = null, code = 'storage_error', preserved = true } = {}) {
    super(message);
    this.name = 'LostItemStorageError';
    this.status = status;
    this.code = code;
    this.preserved = preserved;
  }
}

function errorForResponse(status, operation, payload = {}) {
  const code = typeof payload?.error === 'string' ? payload.error : 'worker_error';
  const messages = {
    400: 'O Worker rejeitou os dados da imagem.',
    401: 'Sua sessão expirou. Entre novamente para continuar.',
    403: 'Você não tem permissão para esta operação de imagem.',
    404: operation === 'delete' ? 'O objeto solicitado não existe no R2.' : 'O serviço de imagens não está disponível.',
    409: operation === 'delete' ? 'A imagem continua referenciada e foi preservada.' : 'Já existe um objeto com a mesma chave.',
    413: 'A imagem excede o tamanho máximo permitido.',
    429: 'Muitas solicitações de imagem. Aguarde e tente novamente.',
  };
  const message = messages[status] ?? (status >= 500
    ? 'O serviço de imagens está temporariamente indisponível; o arquivo foi preservado.'
    : 'Não foi possível concluir a operação de imagem.');
  return new LostItemStorageError(message, {
    status,
    code,
    preserved: operation === 'delete' || Boolean(payload?.preserved),
  });
}

async function safeJson(response) {
  try { return await response.json(); } catch { return {}; }
}

export class LostItemStorageClient {
  constructor({ uploadsFlag, workerUrl, getAccessToken, uploadSupabase, deleteSupabase, fetchImpl = fetch }) {
    this.useR2ForNewUploads = r2NewUploadsEnabled(uploadsFlag);
    this.workerUrl = String(workerUrl ?? '').replace(/\/+$/, '');
    this.getAccessToken = getAccessToken;
    this.uploadSupabase = uploadSupabase;
    this.deleteSupabase = deleteSupabase;
    this.fetchImpl = fetchImpl;
  }

  async accessToken() {
    const token = await this.getAccessToken?.();
    if (!token) throw new LostItemStorageError('Sessão autenticada necessária para acessar imagens.', { status: 401, code: 'missing_session' });
    return token;
  }

  async upload(file, supabasePath) {
    if (!this.useR2ForNewUploads) {
      const locator = await this.uploadSupabase(file, supabasePath);
      return { locator, provider: 'supabase' };
    }
    if (!this.workerUrl) throw new LostItemStorageError('O serviço R2 não está configurado.', { code: 'worker_not_configured' });
    const token = await this.accessToken();
    const response = await this.fetchImpl(`${this.workerUrl}/v1/files/lost-items`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': file.type || 'application/octet-stream' },
      body: file,
    });
    const payload = await safeJson(response);
    if (!response.ok) throw errorForResponse(response.status, 'upload', payload);
    const parsed = validateNewR2LostItemLocator(payload?.locator);
    if (!parsed) throw new LostItemStorageError('O Worker retornou um locator de imagem inválido.', { code: 'invalid_locator' });
    return { locator: parsed.locator, provider: 'r2' };
  }

  async delete(locator) {
    const provider = getStorageProvider(locator);
    if (provider === 'none') return { removed: false, preserved: true, reason: 'empty' };
    if (provider === 'supabase') {
      await this.deleteSupabase(locator);
      return { removed: true, preserved: false, provider };
    }
    const parsed = validateR2LostItemLocator(locator);
    if (!parsed) throw new LostItemStorageError('Locator R2 inválido; o objeto foi preservado.', { code: 'invalid_locator' });
    if (!this.workerUrl) throw new LostItemStorageError('O serviço R2 não está configurado; o objeto foi preservado.', { code: 'worker_not_configured' });
    const token = await this.accessToken();
    const response = await this.fetchImpl(`${this.workerUrl}/v1/files/lost-items/${parsed.encodedKey}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` },
    });
    const payload = await safeJson(response);
    if (!response.ok) throw errorForResponse(response.status, 'delete', payload);
    return { removed: true, preserved: false, provider };
  }
}

export async function persistNewImageSafely({ upload, persist, cleanupNew }) {
  const uploaded = await upload();
  try {
    const value = await persist(uploaded.locator);
    return { value, uploaded, cleanup: null };
  } catch (error) {
    try { await cleanupNew(uploaded.locator); }
    catch (cleanupError) {
      error.possibleOrphanLocator = uploaded.locator;
      error.cleanupError = cleanupError;
    }
    throw error;
  }
}

export async function replaceImageSafely({ oldLocator, upload, update, cleanupNew, cleanupOld }) {
  const uploaded = await upload();
  try {
    const value = await update(uploaded.locator);
    let oldCleanup = null;
    if (oldLocator && oldLocator !== uploaded.locator) {
      try { oldCleanup = await cleanupOld(oldLocator); }
      catch (error) { oldCleanup = { removed: false, preserved: true, error }; }
    }
    return { value, uploaded, oldCleanup };
  } catch (error) {
    try { await cleanupNew(uploaded.locator); }
    catch (cleanupError) {
      error.possibleOrphanLocator = uploaded.locator;
      error.cleanupError = cleanupError;
    }
    throw error;
  }
}

export async function processImageBatchIndependently(operations) {
  const results = [];
  for (const operation of operations) {
    try { results.push({ status: 'fulfilled', value: await operation() }); }
    catch (reason) { results.push({ status: 'rejected', reason }); }
  }
  return results;
}
