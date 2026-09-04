import { supabase } from '@/integrations/supabase/client';
import type { LostItem } from '@/hooks/useLostItems';
import type { Database } from '@/integrations/supabase/types';

type CampusEnum =
  Database['public']['Enums']['campus_enum'];

export interface SmartLostItemFilters {
  search: string;
  status?: string;
  campus?: CampusEnum | 'all';
  dateFrom?: string;
  dateTo?: string;
  destination?: 'all' | 'donation' | 'disposal';
  limit?: number;
  offset?: number;
}

interface SmartRow extends LostItem {
  search_score: number;
  total_count: number;
}

const STOP_WORDS = new Set([
  'a', 'o', 'as', 'os',
  'de', 'da', 'do', 'das', 'dos',
  'e', 'em', 'na', 'no', 'nas', 'nos',
  'um', 'uma', 'com', 'para',
]);

const GROUPS = [
  ['caneca', 'copo', 'xicara', 'mug'],
  ['celular', 'telefone', 'smartphone'],
  ['fone', 'headset', 'auricular'],
  ['garrafa', 'squeeze'],
  ['carregador', 'fonte', 'charger'],
  ['mochila', 'bolsa', 'backpack'],
  ['carteira', 'porta-cartao', 'portacartao'],
];

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function variants(token: string) {
  return (
    GROUPS.find((group) =>
      group.includes(token)
    ) ?? [token]
  );
}

function editDistance(a: string, b: string) {
  const rows = a.length + 1;
  const cols = b.length + 1;

  const matrix = Array.from(
    { length: rows },
    () => Array<number>(cols).fill(0)
  );

  for (let i = 0; i < rows; i++) matrix[i][0] = i;
  for (let j = 0; j < cols; j++) matrix[0][j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] +
          (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }

  return matrix[a.length][b.length];
}

function fuzzyWordMatch(
  expected: string,
  words: string[]
) {
  if (expected.length < 5) return false;

  const maxDistance =
    expected.length >= 8 ? 2 : 1;

  return words.some(
    (word) =>
      Math.abs(word.length - expected.length) <=
        maxDistance &&
      editDistance(expected, word) <= maxDistance
  );
}

export function matchesSmartLostItemOffline(
  item: Pick<
    LostItem,
    'code' | 'description' | 'found_location'
  >,
  search: string
) {
  const query = normalize(search);

  if (!query) return true;

  const haystack = normalize(
    [
      item.code,
      item.description,
      item.found_location,
    ]
      .filter(Boolean)
      .join(' ')
  );

  const words = haystack.split(' ');

  const tokens = query
    .split(' ')
    .filter(
      (token) =>
        token.length >= 2 &&
        !STOP_WORDS.has(token)
    );

  if (!tokens.length) {
    return haystack.includes(query);
  }

  return tokens.every((token) =>
    variants(token).some(
      (variant) =>
        haystack.includes(variant) ||
        fuzzyWordMatch(variant, words)
    )
  );
}

export async function smartSearchLostItems(
  filters: SmartLostItemFilters
) {
  const { data, error } = await supabase.rpc(
    'search_lost_items_smart' as never,
    {
      p_search: filters.search.trim(),
      p_status:
        !filters.status ||
        filters.status === 'all'
          ? null
          : filters.status,

      p_campus:
        !filters.campus ||
        filters.campus === 'all'
          ? null
          : filters.campus,

      p_date_from: filters.dateFrom || null,
      p_date_to: filters.dateTo || null,

      p_destination:
        !filters.destination ||
        filters.destination === 'all'
          ? null
          : filters.destination,

      p_limit: filters.limit ?? 50,
      p_offset: filters.offset ?? 0,
    } as never
  );

  if (error) throw error;

  const rows =
    (data ?? []) as unknown as SmartRow[];

  const totalCount = rows.length
    ? Number(rows[0].total_count)
    : 0;

  const items = rows.map((row) => {
    const {
      search_score: _searchScore,
      total_count: _totalCount,
      ...item
    } = row;

    return item as LostItem;
  });

  return {
    items,
    totalCount,
  };
}
