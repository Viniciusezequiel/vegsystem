// Shared select list for Lost & Found list queries.
// IMPORTANT: We exclude image_url from the main query because base64 images cause database timeouts.
// Images are loaded separately only for items with Storage URLs.

export const LOST_ITEMS_LIST_SELECT = [
  'id',
  'code',
  'description',
  'campus',
  'found_location',
  'found_date',
  'received_date',
  'shelf',
  'box',
  'seal_number',
  'delivered_by_name',
  'delivered_by_contact',
  'registered_by',
  'status',
  'owner_name',
  'owner_email',
  'owner_phone',
  'owner_signature',
  'delivered_at',
  'delivered_by_team_member',
  'created_at',
  'updated_at',
].join(',');

// Minimal select for counting (avoids loading any large data)
export const LOST_ITEMS_COUNT_SELECT = 'id';
