const EMPTY_LOCATION_VALUES = new Set([
  '',
  '-',
  '—',
  'N/A',
  'NA',
  'NAO INFORMADO',
  'NAO INFORMADA',
  'SEM INFORMACAO',
]);

function foldLocation(value) {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

export function isMeaningfulPsLocation(value) {
  return !EMPTY_LOCATION_VALUES.has(foldLocation(value));
}

export function normalizePsLocation(value, { building = false } = {}) {
  let normalized = foldLocation(value);

  if (!isMeaningfulPsLocation(normalized)) return '';

  if (building) {
    normalized = normalized.replace(/^PREDIO\s*(?:[-–—:]\s*)?/, '');
  }

  return normalized
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function getPsAttendanceLocation(link) {
  const campusSource = isMeaningfulPsLocation(link?.campus) ? link.campus : '';
  const campusLabelSource = campusSource || (
    isMeaningfulPsLocation(link?.unit) ? link.unit : ''
  );
  const buildingSource = [link?.building, link?.unit, link?.campus]
    .find(isMeaningfulPsLocation) || '';

  const campusKey = normalizePsLocation(campusSource);
  const campusLabel = normalizePsLocation(campusLabelSource);
  const buildingKey = normalizePsLocation(buildingSource, { building: true });

  // A presença é agrupada pelo prédio físico. Campus/unidade continuam
  // disponíveis como metadados, mas não podem duplicar FEA/FCH/FACE I/FACE II
  // quando a origem dos dados usa grafias diferentes.
  return {
    key: buildingKey || 'SEM PREDIO',
    campus: campusKey,
    campusLabel,
    building: buildingKey || 'SEM PRÉDIO DEFINIDO',
  };
}
