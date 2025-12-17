-- Add borrower_signature column to locker_loans table
ALTER TABLE public.locker_loans 
ADD COLUMN borrower_signature text;