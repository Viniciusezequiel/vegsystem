export type StorageSuggestionInput = {
  storageConfig: { campuses?: Array<{ campus: string; shelves?: Array<{ code: string; label: string; boxes?: Array<{ label: string }> }> }> } | null | undefined;
  campus: string;
  storageCategory: string | null;
  occupancy?: Array<{ campus: string | null; shelf: string | null; box: string | null; box_number: string | null; status: string | null }>;
};

const normalizeLabel = (value: string | null | undefined) =>
  (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

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


const aliases: Record<string, string[]> = {
  documentos_valores: ['documentos pessoais', 'documentos e pertences de valor'],
  garrafas_copos: ['garrafas e copos', 'copos e garrafas', 'garrafas', 'copos'],
  eletronicos: ['eletronicos'],
  pequenos_pertences: ['pequenos pertences'],
  roupas: ['roupas', 'roupa'],
  material_academico: ['material academico', 'material escolar'],
  jalecos_pijamas: ['jalecos e pijamas', 'jalecos', 'pijamas'],
  vasilhas: ['vasilhas'],
  necessaire_lancheiras: ['necessaires e lancheiras', 'necessaires', 'necessaire', 'lancheiras'],
  sombrinhas: ['sombrinhas', 'guarda chuva', 'guarda chuvas'],
  itens_laboratorio: ['itens de laboratorio', 'material de laboratorio'],
  variados: ['diversos', 'variados', 'objetos variados', 'varios objetos'],
};

// Match explicit normalized phrases; composed labels may resolve to several categories.
export function resolveCategoryKeys(raw: string | null | undefined): string[] {
  const text = ' ' + normalizeLabel(raw) + ' ';
  return Object.keys(categoryMap).filter(key =>
    [normalizeLabel(key), normalizeLabel(categoryMap[key]), ...(aliases[key] || [])]
      .some(label => text.includes(' ' + label + ' '))
  );
}

export function inferLostItemStorageCategoryFromDescription(description?: string | null) {
  const text = normalizeLabel(description);
  if (!text) return null;
  const hints: Array<[string, string]> = [
    ['jalecos_pijamas', 'jalecos?|pijamas?'],
    ['itens_laboratorio', 'pipetas?|buretas?|material de laboratorio'],
    ['documentos_valores', 'rg|cnh|documento pessoal|documentos pessoais|identidade|passaporte'],
    ['garrafas_copos', 'garrafas?|squeezes?|copos?|canecas?'],
    ['eletronicos', 'celular|carregadores?|carregador|fones?|headphones?|mouse|teclado|power bank|cabo eletronico|notebook|tablet'],
    ['pequenos_pertences', 'chaves?|oculos|relogios?|bijuterias?|anel|pulseira|colar'],
    ['roupas', 'camisas?|camisetas?|blusas?|casacos?|calcas?|bermudas?|vestidos?'],
    ['material_academico', 'cadernos?|livros?|apostilas?|agendas?|canetas?'],
    ['vasilhas', 'vasilhas?|potes?|marmitas?'],
    ['necessaire_lancheiras', 'necessaires?|lancheiras?'],
    ['sombrinhas', 'sombrinhas?|guarda chuva'],
  ];
  return hints.find(([, pattern]) => new RegExp('(?:^| )(?:' + pattern + ')(?: |$)').test(text))?.[0] ?? 'variados';
}

export function inferLostItemStorageCategory(category: string | null | undefined, description?: string | null) {
  return inferLostItemStorageCategoryFromDescription(description) || resolveCategoryKeys(category)[0] || null;
}

function countSlot(occupancy: StorageSuggestionInput['occupancy'], campus: string, shelf: string, box: string) {
  return (occupancy || []).filter(item => item.status === 'available' && item.campus === campus &&
    item.shelf === shelf && (item.box === box || item.box_number === box)).length;
}

export function getLostItemStorageSuggestion({ storageConfig, campus, storageCategory, occupancy }: StorageSuggestionInput) {
  const key = resolveCategoryKeys(storageCategory)[0];
  if (!key || !campus) return null;
  const shelves = storageConfig?.campuses?.find(entry => entry.campus === campus)?.shelves || [];
  const candidates = shelves.map(shelf => {
    const shelfKeys = resolveCategoryKeys(shelf.label);
    const boxes = (shelf.boxes || []).filter(box => {
      const boxKeys = resolveCategoryKeys(box.label);
      if (boxKeys.length) return boxKeys.includes(key);
      // Numeric boxes inherit only an unambiguous shelf category.
      return /^\d+$/.test(box.label.trim()) && shelfKeys.length === 1 && shelfKeys[0] === key;
    });
    return { shelf, boxes, occupancy: boxes.reduce((sum, box) => sum + countSlot(occupancy, campus, shelf.code, box.label), 0) };
  }).filter(candidate => candidate.boxes.length > 0);
  candidates.sort((a, b) => a.occupancy - b.occupancy || a.shelf.code.localeCompare(b.shelf.code, 'pt-BR'));
  const chosen = candidates[0];
  if (!chosen) return null;
  const box = [...chosen.boxes].sort((a, b) => countSlot(occupancy, campus, chosen.shelf.code, a.label) -
    countSlot(occupancy, campus, chosen.shelf.code, b.label) || a.label.localeCompare(b.label, 'pt-BR'))[0];
  return { shelfCode: chosen.shelf.code, shelfLabel: chosen.shelf.label, boxNumber: box.label, box: box.label };
}

export function automaticStorageFields(manualOverride: boolean, suggestion: ReturnType<typeof getLostItemStorageSuggestion>) {
  if (manualOverride) return null;
  return { shelfCode: suggestion?.shelfCode || '', shelf: suggestion?.shelfCode || '', boxNumber: suggestion?.boxNumber || '', box: suggestion?.box || '' };
}
