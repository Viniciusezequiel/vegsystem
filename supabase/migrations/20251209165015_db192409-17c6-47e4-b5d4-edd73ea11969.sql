-- Create app_settings table for global settings like blocking external bookings
CREATE TABLE public.app_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key text UNIQUE NOT NULL,
    value jsonb NOT NULL DEFAULT '{}',
    description text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can manage settings
CREATE POLICY "Admins can manage settings" 
ON public.app_settings 
FOR ALL 
USING (is_admin(auth.uid()));

-- Anyone can read settings (needed for external booking page to check if blocked)
CREATE POLICY "Anyone can read settings" 
ON public.app_settings 
FOR SELECT 
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default setting for external booking
INSERT INTO public.app_settings (key, value, description) VALUES 
('external_booking_blocked', '{"blocked": false, "blocked_until": null, "message": ""}', 'Settings for blocking external reservations');

-- Create lost_items table for achados e perdidos
CREATE TABLE public.lost_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text UNIQUE NOT NULL,
    description text NOT NULL,
    image_url text,
    campus public.campus_enum NOT NULL,
    found_location text NOT NULL,
    found_date date NOT NULL,
    received_date date NOT NULL,
    shelf text,
    box text,
    seal_number text,
    delivered_by_name text NOT NULL,
    delivered_by_contact text,
    registered_by uuid REFERENCES auth.users(id),
    status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'pending', 'delivered', 'expired')),
    owner_name text,
    owner_email text,
    owner_phone text,
    owner_signature text,
    delivered_at timestamp with time zone,
    delivered_by_team_member uuid REFERENCES auth.users(id),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lost_items ENABLE ROW LEVEL SECURITY;

-- Anyone can view lost items (public search)
CREATE POLICY "Anyone can view lost items" 
ON public.lost_items 
FOR SELECT 
USING (true);

-- Admins and collaborators can insert
CREATE POLICY "Admins and collaborators can insert lost items" 
ON public.lost_items 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'collaborator'));

-- Admins and collaborators can update
CREATE POLICY "Admins and collaborators can update lost items" 
ON public.lost_items 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'collaborator'));

-- Only admins can delete
CREATE POLICY "Only admins can delete lost items" 
ON public.lost_items 
FOR DELETE 
USING (is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_lost_items_updated_at
BEFORE UPDATE ON public.lost_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to auto-expire items older than 90 days
CREATE OR REPLACE FUNCTION public.expire_old_lost_items()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.lost_items
    SET status = 'expired', updated_at = now()
    WHERE status = 'available'
      AND received_date < CURRENT_DATE - INTERVAL '90 days';
END;
$$;