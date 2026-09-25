// Shared select list for Lost & Found list queries.
// image_url agora é um locator curto do R2. Incluí-lo na listagem elimina dezenas de
// consultas individuais sem transferir os bytes da imagem pelo Supabase.

export const LOST_ITEMS_LIST_SELECT = [
  'id',
  'code',
  'description',
  'campus',
  'found_location',
  'found_date',
  'received_date',
  'status',
  'shelf',
  'box',
  'box_number',
  'seal_number',
  'search_metadata',
  'image_url',
].join(',');

// Minimal select for counting (avoids loading any large data)
export const LOST_ITEMS_COUNT_SELECT = 'id';
