DO $$
DECLARE
  tables_to_add text[] := ARRAY[
    'locker_exchanges','lost_items_archive','classroom_call_rooms','classroom_call_responses',
    'classroom_call_room_issues','task_comments','task_team_members','task_history',
    'rooms','room_checklists','checklist_questions','checklist_answers',
    'shift_handovers','shift_handover_tasks','shift_handover_incidents',
    'reservations','reservation_rooms','inventory_movements','activity_logs','app_settings'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY tables_to_add LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;