export type StorageSuggestionInput = {
  storageConfig: { campuses?: Array<{ campus: string; shelves?: Array<{ code: string; label: string; boxes?: Array<{ label: string }> }> }> } | null | undefined;
  campus: string;
  storageCategory: string | null;
  occupancy?: Array<{ campus: string | null; shelf: string | null; box: string | null; box_number: string | null; status: string | null }>;
};

const normalizeLabel = (value: string | null | undefined) =>
  (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const normalizeCategoryKey = (value: string | null | undefined) =>
  (value ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');

const categoryMap: Record<string, string> = {
  documentos_valores: 'Documentos Pessoais',
  garrafas_copos: 'Garrafas e Copos',
  eletronicos: 'Eletrônicos',
  pequenos_pertences: 'Pequenos Pertences',
  roupas: 'Roupas',
  material_academico: 'Material Acadêmico',
  jalecos_pijamas: 'Jalecos e Pijamas',
  vasilhas: 'Vasilhas',
  necessaire_lancheiras: 'Nécessaires e Lancheiras',
  sombrinhas: 'Sombrinhas',
  itens_laboratorio: 'Itens de Laboratório',
  variados: 'Variados',
};

const aliasMap: Record<string, string> = {
  documentos_pessoais: 'documentos_valores',
  documentos_e_pertences_de_valor: 'documentos_valores',
  documentos_pertences_de_valor: 'documentos_valores',
  garrafas: 'garrafas_copos',
  garrafas_e_copos: 'garrafas_copos',
  copos_e_garrafas: 'garrafas_copos',
  copos: 'garrafas_copos',
  pequenos_pertences_e_eletronicos: 'pequenos_pertences',
  pequenos_pertences_eletronicos: 'pequenos_pertences',
  pequenos_pertences: 'pequenos_pertences',
  eletronicos: 'eletronicos',
  eletrônicos: 'eletronicos',
  eletronicos_e_pequenos_pertences: 'eletronicos',
  roupa: 'roupas',
  roupas: 'roupas',
  material_escolar: 'material_academico',
  material_academico: 'material_academico',
  jalecos: 'jalecos_pijamas',
  pijamas: 'jalecos_pijamas',
  jalecos_e_pijamas: 'jalecos_pijamas',
  vasilhas: 'vasilhas',
  necessaire: 'necessaire_lancheiras',
  lancheiras: 'necessaire_lancheiras',
  necessaires_e_lancheiras: 'necessaire_lancheiras',
  necessaires: 'necessaire_lancheiras',
  proteger: 'necessaire_lancheiras',
  guarda_chuvas: 'sombrinhas',
  guarda_chuva: 'sombrinhas',
  sombrinhas: 'sombrinhas',
  itens_de_laboratorio: 'itens_laboratorio',
  material_de_laboratorio: 'itens_laboratorio',
  diversos: 'variados',
  variados: 'variados',
  objetos_variados: 'variados',
  varios: 'variados',
  varios_objetos: 'variados',
};

const categoryPriority = Object.keys(categoryMap);

function resolveCategoryKey(raw: string | null) {
  const key = normalizeCategoryKey(raw);
  if (!key) return null;
  if (Object.prototype.hasOwnProperty.call(categoryMap, key)) return key;
  if (Object.prototype.hasOwnProperty.call(aliasMap, key)) return aliasMap[key];

  const normalizedParts = key.split('_').filter(Boolean);
  const matches = categoryPriority.filter(category => {
    const categoryParts = category.split('_');
    return categoryParts.every(part => normalizedParts.includes(part)) || normalizedParts.every(part => categoryParts.includes(part));
  });

  if (matches.length === 1) return matches[0];
  if (matches.length > 1) return matches.sort((a, b) => a.length - b.length)[0];
  return aliasMap[key] ?? null;
}

function resolveCategoryKeys(raw: string | null | undefined) {
  const text = (raw ?? '').trim();
  if (!text) return [];

  const normalized = normalizeCategoryKey(text);
  if (!normalized) return [];

  const separatorTokens = [' e ', ' e\n', ' e\r', ' e\t', ' e\f'];
  const combined = separatorTokens.some(token => normalized.includes(token))
    ? normalized
    : normalized;

  const exactMatches = [normalized];
  const subMatches = normalized.split(/(?:\s+e\s+|,|\/|;|\|)/).map(part => part.trim()).filter(Boolean);
  const resolved = Array.from(new Set([
    ...exactMatches,
    ...subMatches,
  ].map(part => resolveCategoryKey(part)).filter(Boolean)));

  return resolved;
}

function countAvailableBySlot(occupancy: StorageSuggestionInput['occupancy'], campus: string, shelfCode: string | null, boxLabel: string | null) {
  if (!occupancy) return 0;
  return occupancy.filter(item =>
    item.campus === campus &&
    item.status === 'available' &&
    item.shelf === shelfCode &&
    (boxLabel ? item.box === boxLabel || item.box_number === boxLabel : true)
  ).length;
}

export function inferLostItemStorageCategory(storageCategory: string | null | undefined, description?: string | null) {
  const descriptionText = (description ?? '').trim();
  const normalizedDescription = normalizeLabel(descriptionText);

  if (normalizedDescription) {
    const descriptionHints: Array<[string, string]> = [
      ['documentos_valores', 'documento|cartao|identidade|cpf|rg|cnh|carteira|passaporte|boleto|certidao'],
      ['garrafas_copos', 'garrafa|copo|frasco|botelha|caneca|taça'],
      ['eletronicos', 'celular|telefone|carregador|fones|headphone|earbud|monitor|notebook|tablet|eletronico|teclado|mouse'],
      ['pequenos_pertences', 'chave|relogio|pulseira|colar|anel|oculos|joia|bijuteria|acessorio|mini bolsa|wallet'],
      ['roupas', 'roupa|camiseta|jaqueta|mochila|casaco|calca|sapato|vestimenta|toalha|pijama'],
      ['material_academico', 'caderno|material|livro|apostila|agenda|caneta|lapis|estojo|notebook|manual'],
      ['jalecos_pijamas', 'jaleco|pijama|roupa de dormir|roupa de banho'],
      ['vasilhas', 'vasilha|cesta|bag|sacola|estojo|necessaire|lunch'],
      ['necessaire_lancheiras', 'necessaire|lancheira|almofada|saquinho|bag'],
      ['sombrinhas', 'guarda chuva|sombrinha|guarda-chuva|umbrella'],
      ['itens_laboratorio', 'pipeta|bureta|microscopio|microscópio|vidro|tubo|kit|laboratorio'],
    ];

    const match = descriptionHints.find(([, pattern]) => new RegExp(pattern, 'i').test(normalizedDescription));
    if (match) return match[0];
    return 'variados';
  }

  const categoryKeys = resolveCategoryKeys(storageCategory);
  if (categoryKeys.length) return categoryKeys[0];

  const inferredFromCategory = resolveCategoryKey(storageCategory);
  if (inferredFromCategory) return inferredFromCategory;

  return null;
}

function matchesCategoryLabel(label: string | null | undefined, categoryKey: string) {
  const normalizedLabel = normalizeLabel(label);
  const normalizedCategory = normalizeLabel(categoryMap[categoryKey]);
  if (!normalizedLabel || !normalizedCategory) return false;

  if (normalizedLabel === normalizedCategory) return true;
  if (normalizedLabel.includes(normalizedCategory) || normalizedCategory.includes(normalizedLabel)) return true;

  const explicitKey = resolveCategoryKey(label);
  return explicitKey === categoryKey;
}

export function getLostItemStorageSuggestion(input: StorageSuggestionInput) {
  const { storageConfig, campus, storageCategory, occupancy } = input;
  const key = inferLostItemStorageCategory(storageCategory);
  if (!key || !campus) return null;

  const campusConfig = storageConfig?.campuses?.find(item => item.campus === campus);
  if (!campusConfig?.shelves) return null;

  const categoryLabel = categoryMap[key];
  if (!categoryLabel) return null;

  const compatibleShelves = campusConfig.shelves.filter(shelf => {
    const shelfKey = resolveCategoryKey(shelf.label) ?? resolveCategoryKey(shelf.code) ?? resolveCategoryKey(categoryLabel) ?? null;
    if (shelfKey === key) return true;
    return matchesCategoryLabel(shelf.label, key) || matchesCategoryLabel(shelf.code, key);
  });

  const candidateShelves = [...compatibleShelves].sort((a, b) => {
    const totalA = (a.boxes ?? []).reduce((sum, box) => sum + countAvailableBySlot(occupancy, campus, a.code, box.label), 0);
    const totalB = (b.boxes ?? []).reduce((sum, box) => sum + countAvailableBySlot(occupancy, campus, b.code, box.label), 0);
    return totalA - totalB || a.code.localeCompare(b.code, 'pt-BR');
  });

  const bestShelf = candidateShelves[0];
  if (!bestShelf) return null;

  const boxes = bestShelf.boxes ?? [];
  const compatibleBoxes = boxes.filter(box => {
    const boxLabel = box.label ?? '';
    const explicit = resolveCategoryKey(boxLabel);
    if (explicit && explicit !== key) return false;
    if (explicit === key) return true;
    if (boxes.every(item => !item.label || !resolveCategoryKey(item.label))) {
      return true;
    }
    return matchesCategoryLabel(boxLabel, key) || matchesCategoryLabel(bestShelf.label, key);
  });

  const finalBoxes = compatibleBoxes.length ? compatibleBoxes : boxes;

  const chosenBox = [...finalBoxes].sort((a, b) => {
    const aCount = countAvailableBySlot(occupancy, campus, bestShelf.code, a.label);
    const bCount = countAvailableBySlot(occupancy, campus, bestShelf.code, b.label);
    return aCount - bCount || a.label.localeCompare(b.label, 'pt-BR');
  })[0];

  return {
    shelfCode: bestShelf.code,
    shelfLabel: bestShelf.label,
    boxNumber: chosenBox?.label,
    box: chosenBox?.label,
  };
}
