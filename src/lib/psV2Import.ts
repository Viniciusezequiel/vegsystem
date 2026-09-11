export type PsV2AreaType = 'corridor' | 'sanitary' | 'entrance' | 'coordination' | 'support' | 'other';
export type PsV2EnvironmentType = 'classroom' | 'bathroom' | 'coordination' | 'support' | 'entrance' | 'other';

export type PsV2StructureImportRow = {
  location: string;
  addressLine?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  building: string;
  floor: string;
  area?: string | null;
  areaType?: PsV2AreaType;
  environment?: string | null;
  environmentType?: PsV2EnvironmentType;
  capacity?: number | null;
};

export type PsV2ImportIssue = {
  row: number;
  level: 'error' | 'warning';
  message: string;
};

const clean = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim();
const normalizeKey = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

function buildLookup(raw: Record<string, unknown>) {
  const entries = Object.entries(raw).map(([key, value]) => [normalizeKey(key), value] as const);
  return new Map(entries);
}

function pick(lookup: Map<string, unknown>, aliases: string[]) {
  for (const alias of aliases) {
    const value = lookup.get(normalizeKey(alias));
    if (value !== undefined && clean(value)) return value;
  }
  return undefined;
}

function normalizeAreaType(value: unknown): PsV2AreaType {
  const text = clean(value).toLowerCase();
  if (!text) return 'other';
  if (text.includes('corred')) return 'corridor';
  if (text.includes('banhe') || text.includes('sanit')) return 'sanitary';
  if (text.includes('entrada') || text.includes('portaria') || text.includes('acesso')) return 'entrance';
  if (text.includes('coord')) return 'coordination';
  if (text.includes('apoio')) return 'support';
  return 'other';
}

function normalizeEnvironmentType(value: unknown, environmentName: string): PsV2EnvironmentType {
  const text = `${clean(value)} ${environmentName}`.toLowerCase();
  if (text.includes('banhe') || text.includes('sanit')) return 'bathroom';
  if (text.includes('coord')) return 'coordination';
  if (text.includes('apoio')) return 'support';
  if (text.includes('entrada') || text.includes('portaria') || text.includes('acesso')) return 'entrance';
  if (text.includes('sala') || text.includes('laborat') || text.includes('audit')) return 'classroom';
  return clean(value) ? 'other' : 'classroom';
}

export function normalizePsV2StructureRows(rawRows: Record<string, unknown>[]) {
  const rows: PsV2StructureImportRow[] = [];
  const issues: PsV2ImportIssue[] = [];
  const seen = new Set<string>();

  rawRows.forEach((raw, index) => {
    const lookup = buildLookup(raw);
    const rowNumber = index + 2;
    const location = clean(pick(lookup, ['local', 'campus', 'unidade', 'local do evento']));
    const building = clean(pick(lookup, ['predio', 'prédio', 'bloco', 'edificio', 'edifício'])) || 'Prédio principal';
    const floor = clean(pick(lookup, ['andar', 'pavimento', 'piso']));
    const area = clean(pick(lookup, ['area', 'área', 'corredor', 'setor do andar'])) || null;
    const environment = clean(pick(lookup, ['ambiente', 'sala', 'local interno', 'espaco', 'espaço'])) || null;
    const addressLine = clean(pick(lookup, ['endereco', 'endereço', 'logradouro'])) || null;
    const neighborhood = clean(pick(lookup, ['bairro'])) || null;
    const city = clean(pick(lookup, ['cidade', 'municipio', 'município'])) || null;
    const state = clean(pick(lookup, ['estado', 'uf'])) || null;
    const postalCode = clean(pick(lookup, ['cep'])) || null;
    const capacityRaw = clean(pick(lookup, ['capacidade', 'lugares', 'quantidade de lugares']));
    const capacityNumber = capacityRaw ? Number(capacityRaw.replace(/[^0-9]/g, '')) : null;

    if (!location) issues.push({ row: rowNumber, level: 'error', message: 'Local/campus não informado.' });
    if (!floor) issues.push({ row: rowNumber, level: 'error', message: 'Andar/pavimento não informado.' });
    if (!area && !environment) issues.push({ row: rowNumber, level: 'warning', message: 'Linha cria somente o andar; nenhuma área ou ambiente foi informada.' });
    if (capacityRaw && (!Number.isFinite(capacityNumber) || Number(capacityNumber) < 0)) issues.push({ row: rowNumber, level: 'warning', message: 'Capacidade inválida; o valor será ignorado.' });

    if (!location || !floor) return;

    const normalized: PsV2StructureImportRow = {
      location,
      addressLine,
      neighborhood,
      city,
      state,
      postalCode,
      building,
      floor,
      area,
      areaType: normalizeAreaType(pick(lookup, ['tipo de area', 'tipo área', 'tipo da area', 'tipo da área']) || area),
      environment,
      environmentType: normalizeEnvironmentType(pick(lookup, ['tipo de ambiente', 'tipo ambiente']), environment || ''),
      capacity: Number.isFinite(capacityNumber) ? capacityNumber : null,
    };

    const dedupeKey = [location, building, floor, area || '', environment || ''].map(value => value.toLowerCase()).join('|');
    if (seen.has(dedupeKey)) {
      issues.push({ row: rowNumber, level: 'warning', message: 'Linha duplicada; será considerada apenas uma vez.' });
      return;
    }
    seen.add(dedupeKey);
    rows.push(normalized);
  });

  return {
    rows,
    issues,
    hasErrors: issues.some(issue => issue.level === 'error'),
    stats: {
      rawRows: rawRows.length,
      validRows: rows.length,
      locations: new Set(rows.map(row => row.location.toLowerCase())).size,
      buildings: new Set(rows.map(row => `${row.location}|${row.building}`.toLowerCase())).size,
      floors: new Set(rows.map(row => `${row.location}|${row.building}|${row.floor}`.toLowerCase())).size,
      areas: new Set(rows.filter(row => row.area).map(row => `${row.location}|${row.building}|${row.floor}|${row.area}`.toLowerCase())).size,
      environments: rows.filter(row => row.environment).length,
    },
  };
}
