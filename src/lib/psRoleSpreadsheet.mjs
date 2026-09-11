const STANDARD_GROUPS = Object.freeze([
  { functionCol: 0, valueCol: 1, key: 'pay_value_4h' },
  { functionCol: 3, valueCol: 4, key: 'pay_value_6h' },
  { functionCol: 6, valueCol: 7, key: 'pay_value_7h' },
  { functionCol: 9, valueCol: 10, key: 'pay_value_8h' },
  { functionCol: 12, valueCol: 13, key: 'pay_value_9h' },
  { functionCol: 18, valueCol: 19, key: 'pay_value_integral' },
]);

const SPECIAL_HOUR_FIELD = Object.freeze({
  '04': 'pay_value_special_4h',
  '06': 'pay_value_special_6h',
  '07': 'pay_value_special_7h',
  '08': 'pay_value_special_8h',
  '09': 'pay_value_special_9h',
});

const SPECIAL_FIELDS = Object.freeze([
  'pay_value_special_4h',
  'pay_value_special_6h',
  'pay_value_special_7h',
  'pay_value_special_8h',
  'pay_value_special_9h',
  'pay_value_special_integral',
]);

export function normalizePsRoleSpreadsheetKey(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function slugify(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function titleCaseRole(value) {
  const smallWords = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('pt-BR')
    .split(/\s+/)
    .map((word, index) => {
      if (index > 0 && smallWords.has(word)) return word;
      return word ? `${word.charAt(0).toLocaleUpperCase('pt-BR')}${word.slice(1)}` : word;
    })
    .join(' ');
}

export function normalizePsImportedRole(rawValue) {
  const raw = String(rawValue ?? '').replace(/\s+/g, ' ').trim();
  const key = normalizePsRoleSpreadsheetKey(raw);

  if (key === 'EQUIPE DE APOIO' || key === 'APOIO') return { name: 'Equipe de Apoio', value: 'apoio' };
  if (key === 'FISCAL DE SALA') return { name: 'Fiscal de Sala', value: 'fiscal_sala' };
  if (key === 'SUCOORDENADOR A' || key === 'SUBCOORDENADOR A' || key === 'SUBCOORDENADOR') {
    return { name: 'Subcoordenador', value: 'subcoordenador' };
  }
  if (key === 'ADVOGADO A') return { name: 'Advogado(a)', value: 'advogado' };
  if (key === 'COORDENADOR A') return { name: 'Coordenador(a)', value: 'coordenador' };
  if (key === 'ENFERMEIRO A') return { name: 'Enfermeiro(a)', value: 'enfermeiro' };
  if (key === 'MEDICO A') return { name: 'Médico(a)', value: 'medico' };
  if (key === 'OPERADOR DE SCANER' || key === 'OPERADOR DE SCANNER') {
    return { name: 'Operador de Scanner', value: 'operador_de_scaner' };
  }

  const name = titleCaseRole(raw);
  return { name, value: slugify(raw.replace(/\(A\)/gi, '')) };
}

export function parsePsMoney(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  const text = String(value ?? '').trim();
  if (!text || ['NA', 'N A', 'N/A', '-'].includes(normalizePsRoleSpreadsheetKey(text))) return null;

  const sanitized = text.replace(/[^\d,.-]/g, '');
  const decimal = sanitized.includes(',') ? sanitized.replace(/\./g, '').replace(',', '.') : sanitized;
  const parsed = Number(decimal);
  return Number.isFinite(parsed) ? parsed : null;
}

function emptySpecialRates() {
  return Object.fromEntries(SPECIAL_FIELDS.map(key => [key, null]));
}

function getDefaultValue(rates) {
  return rates.pay_value_8h
    ?? rates.pay_value_9h
    ?? rates.pay_value_7h
    ?? rates.pay_value_6h
    ?? rates.pay_value_4h
    ?? rates.pay_value_integral
    ?? 0;
}

function findBaseRole(rolesByValue, rawRole) {
  const identity = normalizePsImportedRole(rawRole);
  return rolesByValue.get(identity.value) || null;
}

export function parsePsRoleSpreadsheetRows(rows) {
  if (!Array.isArray(rows)) throw new Error('Planilha inválida.');

  const headerIndex = rows.findIndex(row =>
    normalizePsRoleSpreadsheetKey(row?.[0]) === 'FUNCAO'
    && normalizePsRoleSpreadsheetKey(row?.[1]).includes('VALOR PAGO')
  );

  if (headerIndex < 0) {
    throw new Error('Não encontrei a linha com as colunas Função e Valor pago. Use a tabela de valores praticados.');
  }

  const rolesByValue = new Map();
  const dataRows = rows.slice(headerIndex + 1);

  for (const row of dataRows) {
    const rawRole = STANDARD_GROUPS
      .map(group => row?.[group.functionCol])
      .find(value => String(value ?? '').trim());
    if (!rawRole) continue;

    const identity = normalizePsImportedRole(rawRole);
    if (rolesByValue.has(identity.value)) continue;

    const rates = {};
    for (const group of STANDARD_GROUPS) {
      rates[group.key] = parsePsMoney(row?.[group.valueCol]);
    }

    rolesByValue.set(identity.value, {
      ...identity,
      active: true,
      order: rolesByValue.size,
      pay_value: getDefaultValue(rates),
      combined_roles: [],
      ...rates,
      ...emptySpecialRates(),
    });
  }

  // Colunas P/Q: setor especial. Valores sem sufixo de horas representam a faixa de 8h.
  // O Fiscal Líder de Sala vem em linhas próprias (04H, 06H, 07H, 08H e 09H).
  for (const row of dataRows) {
    const rawSpecialRole = String(row?.[15] ?? '').trim();
    if (!rawSpecialRole) continue;

    const specialValue = parsePsMoney(row?.[16]);
    const normalized = normalizePsRoleSpreadsheetKey(rawSpecialRole);
    const hourMatch = normalized.match(/^(.*) (04|06|07|08|09)H$/);

    if (hourMatch) {
      const role = findBaseRole(rolesByValue, hourMatch[1]);
      const field = SPECIAL_HOUR_FIELD[hourMatch[2]];
      if (role && field) role[field] = specialValue;
      continue;
    }

    const role = findBaseRole(rolesByValue, rawSpecialRole);
    if (role) role.pay_value_special_8h = specialValue;
  }

  // Colunas V/W: horário integral do setor especial.
  for (const row of dataRows) {
    const rawSpecialIntegralRole = String(row?.[21] ?? '').trim();
    if (!rawSpecialIntegralRole) continue;
    const role = findBaseRole(rolesByValue, rawSpecialIntegralRole);
    if (role) role.pay_value_special_integral = parsePsMoney(row?.[22]);
  }

  return [...rolesByValue.values()];
}
