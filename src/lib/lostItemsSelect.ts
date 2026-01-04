// Shared select list for Lost & Found list queries.
// Now includes image_url since we'll load it in a single query for better performance.

export const LOST_ITEMS_LIST_SELECT = [
  'id',
  'code',
  'description',
  'image_url',
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
