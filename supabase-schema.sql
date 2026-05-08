create table if not exists public.tracker_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.tracker_states enable row level security;

drop policy if exists "Users can read their tracker state" on public.tracker_states;
create policy "Users can read their tracker state"
on public.tracker_states
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert their tracker state" on public.tracker_states;
create policy "Users can insert their tracker state"
on public.tracker_states
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their tracker state" on public.tracker_states;
create policy "Users can update their tracker state"
on public.tracker_states
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
