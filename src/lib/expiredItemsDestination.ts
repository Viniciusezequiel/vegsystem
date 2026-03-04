/**
 * Auto-classifies expired lost items into "doação" (donation) or "descarte" (disposal)
 * based on description keywords.
 * 
 * Rules:
 * - Personal hygiene items, documents, IDs, cards, keys → DESCARTE
 * - Common objects (clothing, bags, bottles, electronics, etc.) → DOAÇÃO
 */

const DISPOSAL_KEYWORDS = [
  // Hygiene / personal
  'escova', 'pasta de dente', 'desodorante', 'shampoo', 'condicionador',
  'sabonete', 'absorvente', 'fralda', 'higiene', 'papel higiênico',
  'lenço', 'máscara', 'toalha de papel', 'creme', 'pomada',
  'pente', 'gilete', 'lâmina', 'cotonete', 'álcool gel',
  // Documents / personal ID
  'documento', 'rg', 'cpf', 'cnh', 'carteira de identidade',
  'carteirinha', 'crachá', 'cracha', 'certidão', 'certidao',
  'passaporte', 'título', 'titulo', 'cartão de vacina', 'receita médica',
  'receita medica', 'atestado', 'declaração', 'declaracao', 'comprovante',
  'boleto', 'nota fiscal', 'cartão de crédito', 'cartão de débito',
  'cartao', 'cartão', 'bilhete',
  // Keys
  'chave', 'chaveiro',
  // Food / perishable
  'comida', 'alimento', 'lanche', 'fruta', 'marmita',
  'garrafa de água', 'squeeze', 'copo descartável',
  // Medicine
  'remédio', 'remedio', 'medicamento', 'comprimido', 'insulina',
];

const DONATION_KEYWORDS = [
  // Clothing
  'blusa', 'camisa', 'camiseta', 'calça', 'calca', 'bermuda', 'short',
  'saia', 'vestido', 'jaqueta', 'casaco', 'moletom', 'agasalho',
  'roupa', 'uniforme', 'jaleco', 'meia', 'cueca', 'calcinha',
  'sutiã', 'sutia', 'pijama', 'boné', 'bone', 'chapéu', 'chapeu',
  'cachecol', 'luva', 'cinto', 'gravata', 'tênis', 'tenis',
  'sapato', 'sandália', 'sandalia', 'chinelo', 'bota',
  // Bags
  'mochila', 'bolsa', 'sacola', 'pochete', 'pasta', 'estojo', 'nécessaire',
  'necessaire', 'maleta', 'lancheira',
  // Common objects
  'garrafa', 'squeeze', 'caneca', 'copo', 'prato', 'talher',
  'guarda-chuva', 'sombrinha', 'óculos de sol', 'oculos de sol',
  'relógio', 'relogio', 'pulseira', 'colar', 'brinco', 'anel',
  'bijuteria', 'acessório', 'acessorio',
  // School / office supplies
  'caderno', 'livro', 'apostila', 'caneta', 'lápis', 'lapis',
  'borracha', 'régua', 'regua', 'tesoura', 'grampeador',
  'calculadora', 'agenda', 'fichário', 'fichario',
  // Electronics (common)
  'carregador', 'fone', 'fone de ouvido', 'cabo', 'pen drive',
  'pendrive', 'mouse', 'teclado', 'caixa de som',
  // Others
  'guarda chuva', 'toalha', 'cobertor', 'travesseiro', 'almofada',
  'pelúcia', 'pelucia', 'brinquedo',
];

export type AutoDestination = 'donation' | 'disposal';

/**
 * Classifies an item description into donation or disposal.
 * Default is "doação" (donation) if no disposal keyword matches.
 */
export function classifyExpiredItem(description: string): AutoDestination {
  if (!description) return 'donation';
  
  const normalized = description.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const descNormalized = description.toLowerCase();

  // Check disposal keywords first (higher priority)
  for (const keyword of DISPOSAL_KEYWORDS) {
    const keyNorm = keyword.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (normalized.includes(keyNorm) || descNormalized.includes(keyword)) {
      return 'disposal';
    }
  }

  // If not disposal, default to donation
  return 'donation';
}

/**
 * Returns the Portuguese label for a destination
 */
export function getDestinationLabel(destination: AutoDestination): string {
  return destination === 'donation' ? 'DOAÇÃO' : 'DESCARTE';
}
