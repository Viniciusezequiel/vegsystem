-- Drop the old constraint
ALTER TABLE external_equipment_requests 
DROP CONSTRAINT external_equipment_requests_status_check;

-- Add new constraint with awaiting_pickup status
ALTER TABLE external_equipment_requests 
ADD CONSTRAINT external_equipment_requests_status_check 
CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'awaiting_pickup'::text, 'loaned'::text, 'returned'::text]));