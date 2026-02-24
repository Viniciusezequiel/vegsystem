-- Create tasks/demands table
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT NOT NULL DEFAULT 'normal',
    status TEXT NOT NULL DEFAULT 'pending',
    category TEXT,
    due_date DATE,
    created_by UUID,
    assigned_to UUID,
    created_by_name TEXT NOT NULL,
    assigned_to_name TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    estimated_hours NUMERIC(5,2),
    actual_hours NUMERIC(5,2),
    tags TEXT[],
    attachments JSONB DEFAULT '[]'::jsonb,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create task comments table
CREATE TABLE IF NOT EXISTS public.task_comments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id UUID,
    user_name TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create task history table
CREATE TABLE IF NOT EXISTS public.task_history (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id UUID,
    user_name TEXT NOT NULL,
    action TEXT NOT NULL,
    field_changed TEXT,
    old_value TEXT,
    new_value TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for tasks
DROP POLICY IF EXISTS "Admins and analistas can manage tasks" ON public.tasks;
CREATE POLICY "Admins and analistas can manage tasks"
ON public.tasks FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'analista'::app_role));

DROP POLICY IF EXISTS "Assigned users can view their tasks" ON public.tasks;
CREATE POLICY "Assigned users can view their tasks"
ON public.tasks FOR SELECT
USING (assigned_to = auth.uid());

DROP POLICY IF EXISTS "Assigned users can update their tasks" ON public.tasks;
CREATE POLICY "Assigned users can update their tasks"
ON public.tasks FOR UPDATE
USING (assigned_to = auth.uid());

-- RLS policies for task_comments
DROP POLICY IF EXISTS "Authenticated users can view comments" ON public.task_comments;
CREATE POLICY "Authenticated users can view comments"
ON public.task_comments FOR SELECT
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert comments" ON public.task_comments;
CREATE POLICY "Authenticated users can insert comments"
ON public.task_comments FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can delete their own comments" ON public.task_comments;
CREATE POLICY "Users can delete their own comments"
ON public.task_comments FOR DELETE
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for task_history
DROP POLICY IF EXISTS "Authenticated users can view task history" ON public.task_history;
CREATE POLICY "Authenticated users can view task history"
ON public.task_history FOR SELECT
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "System can insert task history" ON public.task_history;
CREATE POLICY "System can insert task history"
ON public.task_history FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Create trigger for updated_at if not exists
DROP TRIGGER IF EXISTS update_tasks_updated_at ON public.tasks;
CREATE TRIGGER update_tasks_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();