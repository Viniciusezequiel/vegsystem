-- Create material requests table
CREATE TABLE public.material_requests (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    requester_id UUID NOT NULL,
    requester_name TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'delivered')),
    admin_notes TEXT,
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.material_requests ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own requests"
ON public.material_requests FOR SELECT
USING (auth.uid() = requester_id OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'collaborator'));

CREATE POLICY "Authenticated users can create requests"
ON public.material_requests FOR INSERT
WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Admins and collaborators can update requests"
ON public.material_requests FOR UPDATE
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'collaborator'));

CREATE POLICY "Only admins can delete requests"
ON public.material_requests FOR DELETE
USING (is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_material_requests_updated_at
BEFORE UPDATE ON public.material_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();