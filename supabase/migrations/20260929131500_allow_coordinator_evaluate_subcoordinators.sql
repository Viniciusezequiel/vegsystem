create or replace function public.ps_evaluator_link_can_access(
  p_event_id uuid,
  p_evaluator_event_collaborator_id uuid,
  p_evaluator_role text,
  p_target_event_collaborator_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select exists (
    select 1
    from public.ps_event_collaborators target
    where target.id = p_target_event_collaborator_id
      and target.event_id = p_event_id
      and coalesce(target.absent, false) = false
      and target.participation_status in ('pending_confirmation','confirmed')
      and target.collaborator_id is not null
      and target.collaborator_id <> (
        select evaluator.collaborator_id
        from public.ps_event_collaborators evaluator
        where evaluator.id = p_evaluator_event_collaborator_id
          and evaluator.event_id = p_event_id
      )
      and exists (
        select 1
        from public.ps_collaborators c
        where c.id = target.collaborator_id
          and coalesce(c.active, true)
      )
      and (
        (
          p_evaluator_role = 'coordinator'
          and (
            public.ps_evaluator_role_for_assignment(target.role_value, target.assigned_role, target.role_name) is null
            or public.ps_evaluator_role_for_assignment(target.role_value, target.assigned_role, target.role_name) = 'subcoordinator'
          )
        )
        or (
          p_evaluator_role = 'subcoordinator'
          and public.ps_evaluator_role_for_assignment(target.role_value, target.assigned_role, target.role_name) is null
          and (
            exists (
              select 1
              from public.ps_event_evaluator_scopes scope
              join public.ps_event_collaborators evaluator
                on evaluator.id = scope.evaluator_event_collaborator_id
              where scope.event_id = p_event_id
                and scope.evaluator_event_collaborator_id = p_evaluator_event_collaborator_id
                and scope.active
                and (
                  scope.scope_type = 'event'
                  or (scope.scope_type = 'campus' and scope.campus = target.campus)
                  or (scope.scope_type = 'building' and scope.campus = target.campus and scope.building = target.building)
                  or (scope.scope_type = 'floor' and scope.campus = target.campus and scope.building = target.building and scope.floor = target.floor)
                )
            )
            or exists (
              select 1
              from public.ps_evaluation_scope_overrides override
              where override.event_id = p_event_id
                and override.evaluator_event_collaborator_id = p_evaluator_event_collaborator_id
                and override.event_collaborator_id = p_target_event_collaborator_id
            )
          )
        )
      )
  );
$function$;
