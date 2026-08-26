import fs from 'node:fs';
import path from 'node:path';

export const AUTH_DIR = path.resolve('test-results/.auth');
export const INTERNAL_STATE = path.join(AUTH_DIR, 'internal.json');
export const ADMIN_STATE = path.join(AUTH_DIR, 'admin.json');
export const REGISTRY_PATH = path.resolve('test-results/e2e-created.json');

export type Registry = {
  runId: string;
  rows: Record<string, string[]>;
  objects: Record<string, string[]>;
  createdRows: Record<string, string[]>;
  removedRows: Record<string, string[]>;
  createdObjects: Record<string, string[]>;
  removedObjects: Record<string, string[]>;
};

export function newRunId() {
  return `__E2E__${Date.now()}`;
}

export function loadRegistry(): Registry | null {
  if (!fs.existsSync(REGISTRY_PATH)) return null;
  return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8')) as Registry;
}

export function saveRegistry(registry: Registry) {
  fs.mkdirSync(path.dirname(REGISTRY_PATH), { recursive: true });
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2), { mode: 0o600 });
}

export function trackRow(registry: Registry, table: string, id: string) {
  registry.rows[table] ??= [];
  registry.createdRows ??= {};
  registry.createdRows[table] ??= [];
  if (!registry.rows[table].includes(id)) registry.rows[table].push(id);
  if (!registry.createdRows[table].includes(id)) registry.createdRows[table].push(id);
  saveRegistry(registry);
}

export function trackObject(registry: Registry, bucket: string, objectPath: string) {
  registry.objects[bucket] ??= [];
  registry.createdObjects ??= {};
  registry.createdObjects[bucket] ??= [];
  if (!registry.objects[bucket].includes(objectPath)) registry.objects[bucket].push(objectPath);
  if (!registry.createdObjects[bucket].includes(objectPath)) registry.createdObjects[bucket].push(objectPath);
  saveRegistry(registry);
}

export function untrackRow(registry: Registry, table: string, id: string) {
  registry.rows[table] = (registry.rows[table] ?? []).filter(value => value !== id);
  registry.removedRows ??= {};
  registry.removedRows[table] ??= [];
  if (!registry.removedRows[table].includes(id)) registry.removedRows[table].push(id);
  saveRegistry(registry);
}

export function untrackObject(registry: Registry, bucket: string, objectPath: string) {
  registry.objects[bucket] = (registry.objects[bucket] ?? []).filter(value => value !== objectPath);
  registry.removedObjects ??= {};
  registry.removedObjects[bucket] ??= [];
  if (!registry.removedObjects[bucket].includes(objectPath)) registry.removedObjects[bucket].push(objectPath);
  saveRegistry(registry);
}
