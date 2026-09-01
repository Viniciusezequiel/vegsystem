#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const EQUIPMENT_FIELDS = ['borrower_signature', 'return_signature'];
export const MANIFEST_PATH = path.resolve('backup/r2-signatures-equipment-migration.json');
export const LOCKER_FIELDS = ['borrower_signature', 'return_signature'];
export const MODULES = {
  equipment: {
    name: 'equipment', table: 'equipment_loans', fields: EQUIPMENT_FIELDS,
    rpc: 'update_equipment_signature_locator', manifestPath: MANIFEST_PATH,
  },
  lockers: {
    name: 'lockers', table: 'locker_loans', fields: LOCKER_FIELDS,
    rpc: 'update_locker_signature_locator',
    manifestPath: path.resolve('backup/r2-signatures-lockers-migration.json'),
  },
  'lost-items': {
    name: 'lost-items', fields: ['owner_signature'],
    sources: [
      { name: 'active', table: 'lost_items', fields: ['owner_signature'] },
      { name: 'archive', table: 'lost_items_archive', fields: ['owner_signature'] },
    ],
    rpc: 'update_lost_item_signature_locator',
    manifestPath: path.resolve('backup/r2-signatures-lost-items-migration.json'),
  },
  'process-selection': {
    name: 'process-selection', table: 'ps_event_collaborators', fields: ['signature_url'],
    rpc: 'update_process_selection_signature_locator',
    manifestPath: path.resolve('backup/r2-signatures-process-selection-migration.json'),
  },
};
const WORKER_DEFAULT = 'https://vegsystem-storage.viniciusezequiel.workers.dev';
const PNG_MAGIC = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export function parseArgs(argv) {
  const args = new Set(argv);
  const moduleIndex = argv.indexOf('--module');
  const module = moduleIndex >= 0 ? argv[moduleIndex + 1] : null;
  const dryRun = args.has('--dry-run');
  const resume = args.has('--resume');
  const execute = args.has('--execute') || resume;
  if (!MODULES[module]) throw new Error('unsupported_module');
  if (dryRun === execute) throw new Error('choose_exactly_one_of_dry_run_or_execute');
  const known = new Set(['--module', 'equipment', 'lockers', 'lost-items', 'process-selection', '--dry-run', '--execute', '--resume']);
  if (argv.some(arg => !known.has(arg))) throw new Error('unknown_argument');
  return { module, dryRun, execute, resume };
}

export function decodePngDataUrl(value) {
  if (typeof value !== 'string' || !value.startsWith('data:image/png;base64,')) {
    return { valid: false, status: 'invalid_data_url' };
  }
  const encoded = value.slice('data:image/png;base64,'.length);
  if (!encoded || encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    return { valid: false, status: 'invalid_base64' };
  }
  const bytes = Buffer.from(encoded, 'base64');
  const canonical = bytes.toString('base64');
  if (canonical !== encoded || bytes.length < PNG_MAGIC.length) {
    return { valid: false, status: 'invalid_base64' };
  }
  if (!bytes.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC)) {
    return { valid: false, status: 'invalid_png_magic' };
  }
  return { valid: true, status: 'dry_run_valid', bytes, sha256: sha256(bytes) };
}

export function inventoryEntry(recordId, field, value, timestamp, source = null) {
  const decoded = decodePngDataUrl(value);
  return {
    ...(source ? { record_id: recordId, source } : { loan_id: recordId }),
    field,
    old_bytes: decoded.valid ? decoded.bytes.length : null,
    old_sha256: decoded.valid ? decoded.sha256 : sha256(Buffer.from(String(value ?? ''), 'utf8')),
    new_locator: null,
    new_bytes: null,
    new_sha256: null,
    status: decoded.status,
    timestamps: { inventoried_at: timestamp },
  };
}

export function summarizeEntries(entries) {
  const valid = entries.filter(entry => entry.status === 'dry_run_valid');
  const invalid = entries.length - valid.length;
  const bySha = new Map();
  for (const entry of valid) {
    const list = bySha.get(entry.old_sha256) ?? [];
    list.push(entry);
    bySha.set(entry.old_sha256, list);
  }
  const duplicateGroups = [...bySha.values()].filter(group => group.length > 1);
  return {
    borrower_found: entries.filter(entry => entry.field === 'borrower_signature').length,
    return_found: entries.filter(entry => entry.field === 'return_signature').length,
    active_found: entries.filter(entry => entry.source === 'active').length,
    archive_found: entries.filter(entry => entry.source === 'archive').length,
    total: entries.length,
    valid: valid.length,
    invalid,
    bytes: valid.reduce((total, entry) => total + entry.old_bytes, 0),
    duplicate_groups: duplicateGroups.length,
    duplicate_values: duplicateGroups.reduce((total, group) => total + group.length, 0),
    duplicate_extra_occurrences: duplicateGroups.reduce((total, group) => total + group.length - 1, 0),
  };
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function readLocalEnv() {
  if (!fs.existsSync('.env')) return {};
  return Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/)
    .filter(line => line && !line.startsWith('#') && line.includes('='))
    .map(line => {
      const index = line.indexOf('=');
      return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, '')];
    }));
}

function atomicWriteJson(file, payload) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, file);
}

function loadManifest(manifestPath) {
  if (!fs.existsSync(manifestPath)) return null;
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

async function login(config) {
  const response = await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: config.publishableKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email: config.email, password: config.password }),
  });
  if (!response.ok) throw new Error(`authentication_failed_${response.status}`);
  const token = (await response.json()).access_token;
  if (!token) throw new Error('authentication_token_missing');
  return token;
}

async function rest(config, token, resource, init = {}) {
  return fetch(`${config.supabaseUrl}/rest/v1/${resource}`, {
    ...init,
    headers: {
      apikey: config.publishableKey,
      authorization: `Bearer ${token}`,
      accept: 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

async function verifyPermissions(config, token) {
  const response = await rest(config, token, 'rpc/get_my_storage_access', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
  });
  const access = response.ok ? await response.json() : null;
  const roles = Array.isArray(access?.roles) ? access.roles : [];
  if (!response.ok || access?.internal !== true || !roles.includes('admin')) {
    throw new Error('required_admin_storage_permissions_missing');
  }
  return { internal: true, admin: true, worker_upload: true, worker_delete: true, database_update: true };
}

function moduleSources(module) {
  return module.sources ?? [{ name: null, table: module.table, fields: module.fields }];
}

function entrySource(config, entry) {
  const source = moduleSources(config.module).find(candidate => candidate.name === (entry.source ?? null));
  if (!source) throw new Error('manifest_source_invalid');
  return source;
}

function entryRecordId(entry) {
  return entry.record_id ?? entry.loan_id;
}

async function fetchFieldRows(config, token, source, field) {
  const rows = [];
  const pageSize = 100;
  for (let offset = 0; ; offset += pageSize) {
    const resource = `${source.table}?select=id,${field}&${field}=not.is.null&order=id.asc`;
    const response = await rest(config, token, resource, {
      headers: { range: `${offset}-${offset + pageSize - 1}`, prefer: 'count=exact' },
    });
    if (!response.ok) throw new Error(`inventory_${field}_${response.status}`);
    const page = await response.json();
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

async function readCurrentValue(config, token, entry) {
  const source = entrySource(config, entry);
  const response = await rest(config, token,
    `${source.table}?select=id,${entry.field}&id=eq.${encodeURIComponent(entryRecordId(entry))}&limit=1`);
  if (!response.ok) throw new Error(`read_current_${response.status}`);
  const rows = await response.json();
  return rows.length === 1 ? rows[0][entry.field] : undefined;
}

async function exactReferenceCount(config, token, locator) {
  const encoded = encodeURIComponent(locator);
  let count = 0;
  for (const source of moduleSources(config.module)) {
    const filters = source.fields.map(field => `${field}.eq.${encoded}`).join(',');
    const response = await rest(config, token, `${source.table}?select=id&or=(${filters})`);
    if (!response.ok) throw new Error(`reference_count_${response.status}`);
    count += (await response.json()).length;
  }
  return count;
}

async function deleteExact(config, token, locator) {
  if (await exactReferenceCount(config, token, locator) !== 0) throw new Error('cleanup_refused_object_referenced');
  const response = await fetch(`${config.workerUrl}/v1/files/${locator.slice(3)}`, {
    method: 'DELETE', headers: { authorization: `Bearer ${token}` },
  });
  if (response.status !== 200) throw new Error(`cleanup_delete_${response.status}`);
}

async function verifyResolvedObject(config, token, locator, expectedSha, expectedBytes) {
  const resolve = await fetch(`${config.workerUrl}/v1/files/resolve`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ locators: [locator] }),
  });
  if (resolve.status !== 200) throw new Error(`resolve_${resolve.status}`);
  const capabilityUrl = (await resolve.json()).files?.[0]?.url;
  if (!capabilityUrl) throw new Error('capability_missing');
  const read = await fetch(capabilityUrl, { cache: 'no-store' });
  const bytes = Buffer.from(await read.arrayBuffer());
  if (read.status !== 200 || read.headers.get('content-type') !== 'image/png'
    || bytes.length !== expectedBytes || sha256(bytes) !== expectedSha) {
    throw new Error('r2_read_validation_failed');
  }
}

async function updateConditionally(config, token, entry, original, locator) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.updateTimeoutMs);
  try {
    const response = await rest(config, token, `rpc/${config.module.rpc}`, {
      method: 'POST', signal: controller.signal,
      headers: { 'content-type': 'application/json', prefer: 'return=representation' },
      body: JSON.stringify(config.module.name === 'lost-items' ? {
        p_record_id: entryRecordId(entry), p_source: entry.source,
        p_expected_value: original, p_new_locator: locator,
      } : {
        p_loan_id: entryRecordId(entry), p_field: entry.field,
        p_expected_value: original, p_new_locator: locator,
      }),
    });
    if (!response.ok) throw new Error(`conditional_rpc_${response.status}`);
    const rows = await response.json();
    if (rows.length !== 1 || rows[0].success !== true || rows[0].rows_updated !== 1) {
      throw new Error('conditional_rpc_not_exactly_one');
    }
    return 'updated';
  } catch (error) {
    if (error?.name !== 'AbortError') throw error;
    const current = await readCurrentValue(config, token, entry);
    if (current === locator) return 'updated_after_timeout';
    if (current === original) return 'not_updated_after_timeout';
    throw new Error('update_state_indeterminate');
  } finally {
    clearTimeout(timer);
  }
}

async function executeEntry(config, token, manifest, entry) {
  const current = await readCurrentValue(config, token, entry);
  if (typeof current !== 'string') throw new Error('source_row_or_value_missing');
  const decoded = decodePngDataUrl(current);
  if (!decoded.valid || decoded.sha256 !== entry.old_sha256 || decoded.bytes.length !== entry.old_bytes) {
    throw new Error('source_value_changed');
  }
  const upload = await fetch(`${config.workerUrl}/v1/files/signatures/${config.module.name}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'image/png' },
    body: decoded.bytes,
  });
  const body = await upload.json();
  if (upload.status !== 201) throw new Error(`upload_${upload.status}`);
  const locatorPattern = new RegExp(`^r2/signatures/${config.module.name}/\\d{4}/(?:0[1-9]|1[0-2])/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}-([0-9a-f]{16})\\.png$`);
  const match = locatorPattern.exec(body?.locator ?? '');
  if (!match) throw new Error('upload_receipt_invalid_object_preserved');
  if (match[1] !== decoded.sha256.slice(0, 16)) {
    await deleteExact(config, token, body.locator);
    throw new Error('upload_checksum_mismatch_cleaned');
  }
  entry.new_locator = body.locator;
  entry.new_bytes = decoded.bytes.length;
  entry.new_sha256 = decoded.sha256;
  entry.status = 'uploaded_verified_by_worker';
  entry.timestamps.uploaded_at = new Date().toISOString();
  atomicWriteJson(config.module.manifestPath, manifest);

  let updateState;
  try {
    updateState = await updateConditionally(config, token, entry, current, body.locator);
    if (updateState === 'not_updated_after_timeout') {
      await deleteExact(config, token, body.locator);
      entry.status = 'not_updated_cleaned';
      entry.timestamps.cleaned_at = new Date().toISOString();
      atomicWriteJson(config.module.manifestPath, manifest);
      return;
    }
    await verifyResolvedObject(config, token, body.locator, decoded.sha256, decoded.bytes.length);
    entry.status = 'migrated';
    entry.timestamps.migrated_at = new Date().toISOString();
    atomicWriteJson(config.module.manifestPath, manifest);
  } catch (error) {
    const databaseValue = await readCurrentValue(config, token, entry);
    if (databaseValue === current) {
      await deleteExact(config, token, body.locator);
      entry.status = 'failed_before_update_cleaned';
      entry.timestamps.cleaned_at = new Date().toISOString();
      atomicWriteJson(config.module.manifestPath, manifest);
    } else if (databaseValue === body.locator) {
      entry.status = 'update_confirmed_validation_failed_preserved';
      entry.timestamps.failed_at = new Date().toISOString();
      atomicWriteJson(config.module.manifestPath, manifest);
    } else {
      entry.status = 'indeterminate_preserved';
      entry.timestamps.failed_at = new Date().toISOString();
      atomicWriteJson(config.module.manifestPath, manifest);
    }
    throw error;
  }
}

async function dryRun(config, token, permissions) {
  const existing = loadManifest(config.module.manifestPath);
  if (existing?.entries?.some(entry => entry.status === 'migrated')) {
    throw new Error('refusing_to_overwrite_manifest_with_migrated_entries');
  }
  const timestamp = new Date().toISOString();
  const entries = [];
  for (const source of moduleSources(config.module)) {
    for (const field of source.fields) {
      const rows = await fetchFieldRows(config, token, source, field);
      for (const row of rows) entries.push(inventoryEntry(row.id, field, row[field], timestamp, source.name));
    }
  }
  const summary = summarizeEntries(entries);
  const manifest = {
    version: 1,
    module: config.module.name,
    mode: 'dry-run',
    generated_at: timestamp,
    permissions,
    summary,
    entries,
  };
  atomicWriteJson(config.module.manifestPath, manifest);
  const manifestBytes = fs.readFileSync(config.module.manifestPath);
  return { ...summary, mib: summary.bytes / 1024 / 1024, manifest: config.module.manifestPath, manifest_sha256: sha256(manifestBytes), uploads: 0, updates: 0, deletes: 0 };
}

async function execute(config, token, resume) {
  const manifest = loadManifest(config.module.manifestPath);
  if (!manifest || manifest.module !== config.module.name || !Array.isArray(manifest.entries)) throw new Error('valid_dry_run_manifest_required');
  if (!resume && manifest.entries.some(entry => entry.status !== 'dry_run_valid' && !entry.status.startsWith('invalid_'))) {
    throw new Error('manifest_has_progress_use_resume');
  }
  manifest.mode = 'execute';
  manifest.execution_started_at ??= new Date().toISOString();
  atomicWriteJson(config.module.manifestPath, manifest);
  for (const entry of manifest.entries) {
    if (entry.status === 'migrated' || entry.status.startsWith('invalid_')) continue;
    if (resume && entry.status !== 'dry_run_valid' && entry.status !== 'not_updated_cleaned' && entry.status !== 'failed_before_update_cleaned') continue;
    await executeEntry(config, token, manifest, entry);
  }
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const local = readLocalEnv();
  const config = {
    supabaseUrl: String(process.env.VITE_SUPABASE_URL ?? local.VITE_SUPABASE_URL ?? '').replace(/\/$/, ''),
    publishableKey: process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? local.VITE_SUPABASE_PUBLISHABLE_KEY,
    email: process.env.E2E_ADMIN_EMAIL,
    password: process.env.E2E_ADMIN_PASSWORD,
    workerUrl: String(process.env.VITE_STORAGE_WORKER_URL ?? WORKER_DEFAULT).replace(/\/$/, ''),
    updateTimeoutMs: 20_000,
    module: MODULES[args.module],
  };
  if (!config.supabaseUrl || !config.publishableKey || !config.email || !config.password) throw new Error('required_configuration_missing');
  const token = await login(config);
  const permissions = await verifyPermissions(config, token);
  if (args.dryRun) {
    const result = await dryRun(config, token, permissions);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  await execute(config, token, args.resume);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
