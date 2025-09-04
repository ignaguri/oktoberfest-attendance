-- Reservations table
create table if not exists public.reservations (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  festival_id uuid not null references public.festivals(id) on delete cascade,
  tent_id uuid not null references public.tents(id) on delete restrict,
  start_at timestamptz not null,
  end_at timestamptz null,
  status text not null default 'scheduled', -- scheduled|canceled|completed|failed
  reminder_offset_minutes int not null default 1440,
  reminder_sent_at timestamptz null,
  prompt_sent_at timestamptz null,
  processed_at timestamptz null,
  visible_to_groups boolean not null default true,
  auto_checkin boolean not null default false,
  note text null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes
create index if not exists idx_reservations_user_start_at on public.reservations(user_id, start_at);
create index if not exists idx_reservations_festival_start_at on public.reservations(festival_id, start_at);
create index if not exists idx_reservations_status_start_at on public.reservations(status, start_at);
create index if not exists idx_reservations_visible_to_groups on public.reservations(visible_to_groups);
create index if not exists idx_reservations_tent on public.reservations(tent_id);

-- updated_at trigger
create or replace function public.update_updated_at_column() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_reservations_updated_at on public.reservations;
create trigger update_reservations_updated_at
before update on public.reservations
for each row execute function public.update_updated_at_column();

-- RLS policies
alter table public.reservations enable row level security;

-- Owner CRUD
drop policy if exists "Users can view own reservations" on public.reservations;
create policy "Users can view own reservations" on public.reservations
for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own reservations" on public.reservations;
create policy "Users can insert own reservations" on public.reservations
for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own reservations" on public.reservations;
create policy "Users can update own reservations" on public.reservations
for update using (auth.uid() = user_id);

drop policy if exists "Users can delete own reservations" on public.reservations;
create policy "Users can delete own reservations" on public.reservations
for delete using (auth.uid() = user_id);

-- Group visibility (read-only) - users who share a group in same festival
-- This relies on group_members(group_id,user_id) and groups(id,festival_id)
create or replace view public.v_user_shared_group_members as
select gm1.user_id as owner_id, gm2.user_id as viewer_id, g.festival_id
from public.group_members gm1
join public.group_members gm2 on gm1.group_id = gm2.group_id and gm1.user_id <> gm2.user_id
join public.groups g on g.id = gm1.group_id;

drop policy if exists "Group members can view visible reservations in same festival" on public.reservations;
create policy "Group members can view visible reservations in same festival" on public.reservations
for select using (
  visible_to_groups = true and exists (
    select 1 from public.v_user_shared_group_members v
    where v.owner_id = reservations.user_id
      and v.viewer_id = auth.uid()
      and v.festival_id = reservations.festival_id
  )
);
