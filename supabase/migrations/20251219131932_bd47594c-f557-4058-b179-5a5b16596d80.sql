-- Create archive table for delivered lost items (same structure as lost_items)
CREATE TABLE public.lost_items_archive (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL,
    description text NOT NULL,
    image_url text,
    campus public.campus_enum NOT NULL,
    found_location text NOT NULL,
    found_date date NOT NULL,
    received_date date NOT NULL,
    delivered_by_name text NOT NULL,
    delivered_by_contact text,
    delivered_by_team_member uuid,
    owner_name text,
    owner_phone text,
    owner_email text,
    owner_signature text,
    status text NOT NULL DEFAULT 'delivered',
    delivered_at timestamp with time zone,
    registered_by uuid,
    shelf text,
    box text,
    seal_number text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    -- Archive metadata
    archived_at timestamp with time zone NOT NULL DEFAULT now(),
    archived_by uuid,
    archived_by_name text,
    original_id uuid NOT NULL
);

-- Enable RLS
ALTER TABLE public.lost_items_archive ENABLE ROW LEVEL SECURITY;

-- RLS Policies for archive table
CREATE POLICY "Internal users can view archived items"
ON public.lost_items_archive
FOR SELECT
USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'analista'::app_role) OR 
    has_role(auth.uid(), 'assistente'::app_role) OR 
    has_role(auth.uid(), 'supervisor'::app_role)
);

CREATE POLICY "Admins and analistas can insert archived items"
ON public.lost_items_archive
FOR INSERT
WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'analista'::app_role)
);

CREATE POLICY "Only admins can delete archived items"
ON public.lost_items_archive
FOR DELETE
USING (is_admin(auth.uid()));

-- Index for faster queries
CREATE INDEX idx_lost_items_archive_archived_at ON public.lost_items_archive(archived_at DESC);
CREATE INDEX idx_lost_items_archive_code ON public.lost_items_archive(code);
CREATE INDEX idx_lost_items_archive_campus ON public.lost_items_archive(campus);