alter table public._grants_backup_virada enable row level security;
revoke all on public._grants_backup_virada from anon, authenticated;