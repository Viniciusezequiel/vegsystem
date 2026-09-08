export type StorageSuggestionInput = {
  storageConfig: { campuses?: Array<{ campus: string; shelves?: Array<{ code: string; label: string; boxes?: Array<{ label: string }> }> }> } | null | undefined;
  campus: string;
  storageCategory: string | null;
};

const categoryMap: Record<string, string> = {
  garrafas_copos: 'Garrafas e copos',
  material_academico: 'Material acadêmico',
  pequenos_pertences_eletronicos: 'Pequenos pertences e eletrônicos',
  roupas: 'Roupas',
  necessaire_lancheiras: 'Necessaire e lancheiras',
  vasilhas_jalecos_pijamas: 'Vasilhas/Jalecos e pijamas',
  sombrinhas: 'Sombrinhas',
  documentos_valores: 'Documentos pessoais e pertences de valor',
  variados: 'Variados',
};

export function getLostItemStorageSuggestion(input: StorageSuggestionInput) {
  const { storageConfig, campus, storageCategory } = input;
  const normalizedCategory = (storageCategory ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_');
  const mapped = categoryMap[normalizedCategory] ?? null;
  if (!mapped || !campus) return null;

  const campusConfig = storageConfig?.campuses?.find(item => item.campus === campus);
  if (!campusConfig?.shelves) return null;

  const matches = campusConfig.shelves.filter(shelf => shelf.label && shelf.label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === mapped.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
  if (matches.length !== 1) return null;

  const shelf = matches[0];
  const boxNumber = shelf.boxes && shelf.boxes.length === 1 ? shelf.boxes[0].label : undefined;

  return {
    shelfCode: shelf.code,
    shelfLabel: shelf.label,
    boxNumber,
    box: boxNumber,
  };
}
