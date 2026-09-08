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
  garrafas: 'garrafas_copos',
  garrafas_e_copos: 'garrafas_copos',
  copos: 'garrafas_copos',
  pequenos_pertences_e_eletronicos: 'pequenos_pertences',
  pequenos_pertences_eletronicos: 'pequenos_pertences',
  eletrônicos: 'eletronicos',
  eletronicos_e_pequenos_pertences: 'eletronicos',
  roupa: 'roupas',
  material_escolar: 'material_academico',
  jalecos: 'jalecos_pijamas',
  pijamas: 'jalecos_pijamas',
  vasilhas_jalecos_pijamas: 'vasilhas',
  necessaire: 'necessaire_lancheiras',
  lancheiras: 'necessaire_lancheiras',
  necessaires_e_lancheiras: 'necessaire_lancheiras',
  guarda_chuvas: 'sombrinhas',
  itens_de_laboratorio: 'itens_laboratorio',
  material_de_laboratorio: 'itens_laboratorio',
  diversos: 'variados',
  objetos_variados: 'variados',
};

function resolveCategoryKey(raw: string | null) {
  const key = normalizeCategoryKey(raw);
  if (!key) return null;
  if (Object.prototype.hasOwnProperty.call(categoryMap, key)) return key;
  return aliasMap[key] ?? null;
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

export function getLostItemStorageSuggestion(input: StorageSuggestionInput) {
  const { storageConfig, campus, storageCategory, occupancy } = input;
  const key = resolveCategoryKey(storageCategory);
  if (!key || !campus) return null;

  const campusConfig = storageConfig?.campuses?.find(item => item.campus === campus);
  if (!campusConfig?.shelves) return null;

  const categoryLabel = categoryMap[key];
  if (!categoryLabel) return null;

  const matchingShelves = campusConfig.shelves.filter(shelf => {
    const shelfLabel = normalizeLabel(shelf.label);
    const categoryText = normalizeLabel(categoryLabel);
    if (shelfLabel === categoryText) return true;
    if (shelfLabel.includes(categoryText) || categoryText.includes(shelfLabel)) return true;
    return false;
  });

  const candidateShelves = [...matchingShelves].sort((a, b) => a.code.localeCompare(b.code, 'pt-BR'));
  if (!candidateShelves.length) return null;

  const scoredShelves = candidateShelves.map(shelf => ({
    shelf,
    score: shelf.boxes?.reduce((sum, box) => sum + countAvailableBySlot(occupancy, campus, shelf.code, box.label), 0) ?? 0,
  })).sort((a, b) => a.score - b.score || a.shelf.code.localeCompare(b.shelf.code, 'pt-BR'));

  const bestShelf = scoredShelves[0]?.shelf;
  if (!bestShelf) return null;

  const boxes = bestShelf.boxes ?? [];
  const candidateBoxes = boxes.filter(box => {
    const boxText = normalizeLabel(box.label);
    const categoryText = normalizeLabel(categoryLabel);
    if (!boxText) return false;
    if (boxText.includes(categoryText) || categoryText.includes(boxText)) return true;
    if (bestShelf.label && (normalizeLabel(bestShelf.label) === categoryText)) return true;
    return true;
  });

  const chosenBox = [...(candidateBoxes.length ? candidateBoxes : boxes)]
    .sort((a, b) => {
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
