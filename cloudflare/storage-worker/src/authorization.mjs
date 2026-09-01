const authzCache = new Map();
const DELETE_ROLES = new Set(['admin', 'analista', 'assistente', 'supervisor']);

async function rpc(env, token, name, body, fetchImpl) {
  const response = await fetchImpl(`${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error('authorization_unavailable');
  return response.json();
}

export async function authorizeUser(auth, env, operation, fetchImpl = fetch) {
  const key = `${auth.sessionId}:${operation}`;
  const cached = authzCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.allowed;
  const access = await rpc(env, auth.token, 'get_my_storage_access', {}, fetchImpl);
  const internal = access?.internal === true;
  const roles = Array.isArray(access?.roles) && access.roles.every(role => typeof role === 'string')
    ? access.roles
    : [];
  let allowed = false;
  if (operation === 'read' || operation === 'upload') allowed = internal;
  if (operation === 'delete') allowed = internal && roles.some(role => DELETE_ROLES.has(role));
  authzCache.set(key, { allowed, expiresAt: Date.now() + 30_000 });
  return allowed;
}

async function referencedInTable(env, auth, table, column, locator, fetchImpl) {
  const url = new URL(`${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${table}`);
  url.searchParams.set('select', 'id');
  url.searchParams.set(column, `eq.${locator}`);
  url.searchParams.set('limit', '1');
  const response = await fetchImpl(url, {
    headers: {
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      authorization: `Bearer ${auth.token}`,
      accept: 'application/json',
    },
  });
  if (!response.ok) throw new Error('reference_check_unavailable');
  const rows = await response.json();
  return Array.isArray(rows) && rows.length > 0;
}

async function referencedInTaskComment(env, auth, locator, fetchImpl) {
  const url = new URL(`${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/task_comments`);
  url.searchParams.set('select', 'id');
  url.searchParams.set('attachment_urls', `cs.{${locator}}`);
  url.searchParams.set('limit', '1');
  const response = await fetchImpl(url, {
    headers: {
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      authorization: `Bearer ${auth.token}`,
      accept: 'application/json',
    },
  });
  if (!response.ok) throw new Error('reference_check_unavailable');
  const rows = await response.json();
  return Array.isArray(rows) && rows.length > 0;
}

export async function hasDatabaseReference(auth, env, scope, locator, fetchImpl = fetch) {
  if (scope === 'task-attachments') return referencedInTaskComment(env, auth, locator, fetchImpl);
  if (scope === 'lost-items') {
    const [active, archived] = await Promise.all([
      referencedInTable(env, auth, 'lost_items', 'image_url', locator, fetchImpl),
      referencedInTable(env, auth, 'lost_items_archive', 'image_url', locator, fetchImpl),
    ]);
    return active || archived;
  }
  if (scope !== 'signatures') throw new Error('reference_check_not_implemented');
  const module = locator.split('/')[2];
  const references = {
    equipment: [['equipment_loans', 'borrower_signature'], ['equipment_loans', 'return_signature']],
    lockers: [['locker_loans', 'borrower_signature'], ['locker_loans', 'return_signature']],
    'lost-items': [['lost_items', 'owner_signature'], ['lost_items_archive', 'owner_signature']],
    'process-selection': [['ps_event_collaborators', 'signature_url']],
  }[module];
  if (!references) throw new Error('reference_check_not_implemented');
  const matches = await Promise.all(references.map(([table, column]) =>
    referencedInTable(env, auth, table, column, locator, fetchImpl)));
  return matches.some(Boolean);
}
