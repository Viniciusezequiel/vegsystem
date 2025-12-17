-- Add signature column to equipment_loans table for pickup signature
ALTER TABLE equipment_loans ADD COLUMN IF NOT EXISTS borrower_signature text;