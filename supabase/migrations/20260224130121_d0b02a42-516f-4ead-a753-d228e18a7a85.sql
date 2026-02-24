
-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Anyone can view their submitted call by ID" ON public.classroom_calls;

-- Add a scoped policy: only recent calls (last 30 minutes) are visible to non-internal users
-- This allows the classroom call form's real-time subscription to work
-- while preventing full table enumeration
CREATE POLICY "Recent calls visible for real-time updates"
ON public.classroom_calls FOR SELECT
USING (
  -- Internal users can see everything (covered by existing policy)
  -- Non-internal/anonymous users can only see calls created in the last 30 minutes
  created_at > NOW() - INTERVAL '30 minutes'
  AND status IN ('pending', 'accepted')
);
