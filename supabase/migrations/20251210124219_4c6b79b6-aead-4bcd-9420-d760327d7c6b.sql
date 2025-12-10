-- Create external equipment loan requests table
CREATE TABLE public.external_equipment_requests (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    equipment_id UUID REFERENCES public.equipment(id) ON DELETE CASCADE,
    equipment_name TEXT NOT NULL,
    quantity_requested INTEGER NOT NULL DEFAULT 1,
    requester_name TEXT NOT NULL,
    requester_email TEXT NOT NULL,
    requester_phone TEXT NOT NULL,
    requester_organization TEXT,
    purpose TEXT NOT NULL,
    requested_date DATE NOT NULL,
    expected_return_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'loaned', 'returned')),
    admin_notes TEXT,
    processed_by UUID,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.external_equipment_requests ENABLE ROW LEVEL SECURITY;

-- Policies - anyone can create requests (external users)
CREATE POLICY "Anyone can create external equipment requests"
ON public.external_equipment_requests FOR INSERT
WITH CHECK (true);

-- Anyone can view their own requests by email
CREATE POLICY "Anyone can view requests by email"
ON public.external_equipment_requests FOR SELECT
USING (true);

-- Admins and collaborators can update requests
CREATE POLICY "Admins and collaborators can update external requests"
ON public.external_equipment_requests FOR UPDATE
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'collaborator'));

-- Only admins can delete
CREATE POLICY "Only admins can delete external requests"
ON public.external_equipment_requests FOR DELETE
USING (is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_external_equipment_requests_updated_at
BEFORE UPDATE ON public.external_equipment_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();