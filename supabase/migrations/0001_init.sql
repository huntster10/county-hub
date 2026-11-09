-- =============================================================================
--  County Hub — initial database schema
--  Run this whole file in the Supabase SQL editor (Dashboard → SQL → New query)
--  or with `supabase db push`. It is safe to run on a brand-new project.
-- =============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- -----------------------------------------------------------------------------
-- 1. Enums
-- -----------------------------------------------------------------------------
create type public.app_role as enum ('owner', 'admin', 'staff', 'department_leader', 'member');
create type public.channel_type as enum ('text', 'announcement', 'dm');
create type public.member_status as enum ('active', 'loa', 'inactive', 'suspended');
create type public.shift_status as enum ('active', 'on_break', 'ended');
create type public.punishment_type as enum ('warning', 'kick', 'ban', 'note', 'bolo');
create type public.application_status as enum ('pending', 'accepted', 'denied');
create type public.session_status as enum ('scheduled', 'active', 'ended');
create type public.cad_status as enum ('pending', 'dispatched', 'on_scene', 'resolved', 'cancelled');

-- -----------------------------------------------------------------------------
-- 2. Tables
-- -----------------------------------------------------------------------------

-- One row per logged-in person. `id` matches auth.users.id.
create table public.profiles (
  id                  uuid primary key references auth.users (id) on delete cascade,
  roblox_id           bigint unique,
  roblox_username     text not null,
  roblox_display_name text,
  avatar_url          text,
  role                public.app_role not null default 'member',
  bio                 text,
  dashboard_layout    jsonb,                       -- saved widget order/visibility
  verified_at         timestamptz,                 -- when Roblox ownership was proven
  is_dev_account      boolean not null default false,
  last_seen_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index profiles_username_idx on public.profiles using gin (roblox_username gin_trgm_ops);

create table public.departments (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  slug           text not null unique,
  description    text,
  color          text not null default '#3987e5',   -- accent colour used in the UI
  icon           text not null default 'shield',    -- lucide icon name
  leader_id      uuid references public.profiles (id) on delete set null,
  quota_minutes  integer not null default 0,        -- weekly shift quota (0 = none)
  position       integer not null default 0,
  created_at     timestamptz not null default now()
);

create table public.department_ranks (
  id            uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  name          text not null,
  level         integer not null default 0,         -- higher = more senior
  created_at    timestamptz not null default now()
);

create table public.department_members (
  id            uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  profile_id    uuid not null references public.profiles (id) on delete cascade,
  rank_id       uuid references public.department_ranks (id) on delete set null,
  callsign      text,
  status        public.member_status not null default 'active',
  joined_at     timestamptz not null default now(),
  unique (department_id, profile_id)
);

create table public.channel_categories (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  position      integer not null default 0,
  department_id uuid references public.departments (id) on delete cascade,
  created_at    timestamptz not null default now()
);

create table public.channels (
  id            uuid primary key default gen_random_uuid(),
  category_id   uuid references public.channel_categories (id) on delete set null,
  department_id uuid references public.departments (id) on delete cascade,
  name          text not null,
  slug          text not null,
  topic         text,
  type          public.channel_type not null default 'text',
  is_private    boolean not null default false,     -- private => only channel_members can see
  min_role      public.app_role,                    -- e.g. 'staff' => staff and above only
  position      integer not null default 0,
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (slug)
);

-- Membership for DMs and private channels.
create table public.channel_members (
  channel_id uuid not null references public.channels (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (channel_id, profile_id)
);

create table public.messages (
  id          uuid primary key default gen_random_uuid(),
  channel_id  uuid not null references public.channels (id) on delete cascade,
  author_id   uuid references public.profiles (id) on delete set null,
  content     text not null default '',
  attachments jsonb not null default '[]'::jsonb,  -- [{url,name,size,type}]
  embeds      jsonb not null default '[]'::jsonb,  -- [{title,description,url,color}]
  mentions    uuid[] not null default '{}',
  reply_to_id uuid references public.messages (id) on delete set null,
  pinned      boolean not null default false,
  edited_at   timestamptz,
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  search      tsvector generated always as (to_tsvector('english', coalesce(content, ''))) stored
);
create index messages_channel_created_idx on public.messages (channel_id, created_at desc);
create index messages_search_idx on public.messages using gin (search);

create table public.message_reactions (
  message_id uuid not null references public.messages (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  emoji      text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, profile_id, emoji)
);

create table public.channel_read_states (
  channel_id   uuid not null references public.channels (id) on delete cascade,
  profile_id   uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (channel_id, profile_id)
);

create table public.shifts (
  id                  uuid primary key default gen_random_uuid(),
  profile_id          uuid not null references public.profiles (id) on delete cascade,
  department_id       uuid references public.departments (id) on delete set null,
  status              public.shift_status not null default 'active',
  started_at          timestamptz not null default now(),
  ended_at            timestamptz,
  total_break_seconds integer not null default 0,
  notes               text,
  created_at          timestamptz not null default now()
);
create index shifts_profile_idx on public.shifts (profile_id, started_at desc);
create index shifts_active_idx on public.shifts (status) where status <> 'ended';

create table public.shift_breaks (
  id         uuid primary key default gen_random_uuid(),
  shift_id   uuid not null references public.shifts (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at   timestamptz
);

create table public.punishments (
  id               uuid primary key default gen_random_uuid(),
  type             public.punishment_type not null,
  target_roblox_id bigint,
  target_username  text not null,
  reason           text not null,
  evidence_url     text,
  moderator_id     uuid references public.profiles (id) on delete set null,
  duration_minutes integer,
  expires_at       timestamptz,
  active           boolean not null default true,
  created_at       timestamptz not null default now()
);
create index punishments_target_idx on public.punishments using gin (target_username gin_trgm_ops);
create index punishments_created_idx on public.punishments (created_at desc);

create table public.application_forms (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text,
  department_id uuid references public.departments (id) on delete cascade,
  questions     jsonb not null default '[]'::jsonb,  -- [{id,label,type,required,options}]
  is_open       boolean not null default true,
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);

create table public.applications (
  id           uuid primary key default gen_random_uuid(),
  form_id      uuid not null references public.application_forms (id) on delete cascade,
  applicant_id uuid not null references public.profiles (id) on delete cascade,
  answers      jsonb not null default '{}'::jsonb,   -- {questionId: answer}
  status       public.application_status not null default 'pending',
  reviewer_id  uuid references public.profiles (id) on delete set null,
  review_note  text,
  created_at   timestamptz not null default now(),
  reviewed_at  timestamptz
);

create table public.sessions (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  host_id       uuid references public.profiles (id) on delete set null,
  status        public.session_status not null default 'scheduled',
  scheduled_for timestamptz,
  started_at    timestamptz,
  ended_at      timestamptz,
  peak_players  integer not null default 0,
  notes         text,
  created_at    timestamptz not null default now()
);

create table public.polls (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid references public.sessions (id) on delete cascade,
  question   text not null,
  options    jsonb not null default '[]'::jsonb,     -- ["Yes","No"]
  closes_at  timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.poll_votes (
  poll_id      uuid not null references public.polls (id) on delete cascade,
  profile_id   uuid not null references public.profiles (id) on delete cascade,
  option_index integer not null,
  created_at   timestamptz not null default now(),
  primary key (poll_id, profile_id)
);

create table public.cad_calls (
  id            uuid primary key default gen_random_uuid(),
  department_id uuid references public.departments (id) on delete set null,
  title         text not null,
  description   text,
  location      text,
  priority      integer not null default 2,          -- 1 = high, 2 = medium, 3 = low
  status        public.cad_status not null default 'pending',
  created_by    uuid references public.profiles (id) on delete set null,
  assigned_to   uuid[] not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Single-row table of community-wide settings. The ER:LC key lives here and
-- is only ever read on the server.
create table public.server_settings (
  id                       integer primary key default 1 check (id = 1),
  community_name           text not null default 'County Hub',
  erlc_api_key             text,
  roblox_group_id          bigint,
  require_group_membership boolean not null default false,
  default_role             public.app_role not null default 'member',
  weekly_quota_minutes     integer not null default 0,
  join_code_visible_to     public.app_role not null default 'member',
  updated_at               timestamptz not null default now()
);

-- Cached copy of ER:LC game events so the feed has history and charts have data.
create table public.game_events (
  id          bigserial primary key,
  kind        text not null,                          -- join | leave | kill | command | modcall
  payload     jsonb not null,
  occurred_at timestamptz not null,
  created_at  timestamptz not null default now(),
  unique (kind, occurred_at, payload)
);
create index game_events_occurred_idx on public.game_events (occurred_at desc);

create table public.audit_log (
  id         bigserial primary key,
  actor_id   uuid references public.profiles (id) on delete set null,
  action     text not null,
  target     text,
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 3. Helper functions (used by RLS policies and the app)
-- -----------------------------------------------------------------------------

-- Numeric weight for each role so we can compare them.
create or replace function public.role_rank(r public.app_role)
returns integer language sql immutable as $$
  select case r
    when 'owner' then 100
    when 'admin' then 80
    when 'staff' then 60
    when 'department_leader' then 50
    when 'member' then 10
  end;
$$;

create or replace function public.current_app_role()
returns public.app_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.has_role_at_least(min_role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.role_rank(public.current_app_role()) >= public.role_rank(min_role), false);
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role_at_least('admin');
$$;

-- "Staff" for moderation purposes = owner, admin, staff.
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_app_role() in ('owner', 'admin', 'staff'), false);
$$;

create or replace function public.is_department_leader(dept uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or exists (select 1 from public.departments d where d.id = dept and d.leader_id = auth.uid());
$$;

create or replace function public.is_department_member(dept uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.department_members m
    where m.department_id = dept and m.profile_id = auth.uid() and m.status <> 'suspended'
  );
$$;

create or replace function public.can_view_channel(chan uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.channels c
    where c.id = chan
      and (
        public.is_admin()
        or (c.is_private and exists (
              select 1 from public.channel_members cm where cm.channel_id = c.id and cm.profile_id = auth.uid()))
        or (not c.is_private
            and (c.min_role is null or public.has_role_at_least(c.min_role))
            and (c.department_id is null or public.is_department_member(c.department_id)))
      )
  );
$$;

-- Keeps updated_at fresh.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger cad_calls_touch before update on public.cad_calls for each row execute function public.touch_updated_at();
create trigger settings_touch before update on public.server_settings for each row execute function public.touch_updated_at();

-- Only admins may change someone's role; the very first account becomes owner.
create or replace function public.guard_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.role is distinct from old.role then
    if not public.is_admin() and auth.uid() is not null then
      raise exception 'Only admins can change roles';
    end if;
    -- Nobody may demote the owner except the owner.
    if old.role = 'owner' and public.current_app_role() <> 'owner' and auth.uid() is not null then
      raise exception 'Only the owner can change the owner role';
    end if;
  end if;
  return new;
end;
$$;
create trigger profiles_guard_role before update on public.profiles for each row execute function public.guard_profile_role();

-- Create a profile automatically whenever an auth user is created.
-- The app stores Roblox details in auth.users.raw_user_meta_data.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  first_user boolean := not exists (select 1 from public.profiles);
begin
  insert into public.profiles (id, roblox_id, roblox_username, roblox_display_name, avatar_url, role, verified_at, is_dev_account)
  values (
    new.id,
    nullif(meta->>'roblox_id', '')::bigint,
    coalesce(meta->>'roblox_username', 'user_' || left(new.id::text, 8)),
    meta->>'roblox_display_name',
    meta->>'avatar_url',
    case when first_user then 'owner'::public.app_role else coalesce((meta->>'role')::public.app_role, 'member') end,
    case when coalesce(meta->>'verified', 'false') = 'true' then now() else null end,
    coalesce((meta->>'is_dev_account')::boolean, false)
  )
  on conflict (id) do update set
    roblox_username     = excluded.roblox_username,
    roblox_display_name = excluded.roblox_display_name,
    avatar_url          = coalesce(excluded.avatar_url, public.profiles.avatar_url);
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Shift leaderboard: minutes on duty per person since a given time.
create or replace function public.shift_leaderboard(since timestamptz)
returns table (profile_id uuid, roblox_username text, avatar_url text, total_minutes integer, shift_count integer)
language sql stable security definer set search_path = public as $$
  select p.id, p.roblox_username, p.avatar_url,
         coalesce(sum(extract(epoch from (coalesce(s.ended_at, now()) - s.started_at)) / 60 - s.total_break_seconds / 60), 0)::integer,
         count(s.id)::integer
  from public.profiles p
  join public.shifts s on s.profile_id = p.id and s.started_at >= since
  group by p.id
  order by 4 desc;
$$;

-- Daily shift minutes for charts.
create or replace function public.shift_minutes_by_day(since timestamptz)
returns table (day date, total_minutes integer, unique_staff integer)
language sql stable security definer set search_path = public as $$
  select date_trunc('day', s.started_at)::date,
         coalesce(sum(extract(epoch from (coalesce(s.ended_at, now()) - s.started_at)) / 60 - s.total_break_seconds / 60), 0)::integer,
         count(distinct s.profile_id)::integer
  from public.shifts s
  where s.started_at >= since
  group by 1 order by 1;
$$;

-- Shift minutes per department for charts.
create or replace function public.department_activity(since timestamptz)
returns table (department_id uuid, name text, color text, total_minutes integer, members integer)
language sql stable security definer set search_path = public as $$
  select d.id, d.name, d.color,
         coalesce((select sum(extract(epoch from (coalesce(s.ended_at, now()) - s.started_at)) / 60 - s.total_break_seconds / 60)
                   from public.shifts s where s.department_id = d.id and s.started_at >= since), 0)::integer,
         (select count(*) from public.department_members m where m.department_id = d.id and m.status = 'active')::integer
  from public.departments d
  order by d.position;
$$;

-- Unread message counts for the current user, one row per channel.
create or replace function public.unread_counts()
returns table (channel_id uuid, unread integer)
language sql stable security definer set search_path = public as $$
  select c.id,
         (select count(*) from public.messages m
           where m.channel_id = c.id
             and m.deleted_at is null
             and m.author_id is distinct from auth.uid()
             and m.created_at > coalesce((select r.last_read_at from public.channel_read_states r
                                           where r.channel_id = c.id and r.profile_id = auth.uid()), 'epoch'))::integer
  from public.channels c
  where public.can_view_channel(c.id);
$$;

-- Find (or create) a DM channel between the current user and another person.
create or replace function public.get_or_create_dm(other uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  existing uuid;
  new_id uuid;
begin
  if me is null then raise exception 'Not signed in'; end if;
  if other = me then raise exception 'Cannot DM yourself'; end if;

  select c.id into existing
  from public.channels c
  where c.type = 'dm'
    and exists (select 1 from public.channel_members a where a.channel_id = c.id and a.profile_id = me)
    and exists (select 1 from public.channel_members b where b.channel_id = c.id and b.profile_id = other)
  limit 1;
  if existing is not null then return existing; end if;

  insert into public.channels (name, slug, type, is_private, created_by)
  values ('dm', 'dm-' || gen_random_uuid()::text, 'dm', true, me)
  returning id into new_id;
  insert into public.channel_members (channel_id, profile_id) values (new_id, me), (new_id, other);
  return new_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles            enable row level security;
alter table public.departments         enable row level security;
alter table public.department_ranks    enable row level security;
alter table public.department_members  enable row level security;
alter table public.channel_categories  enable row level security;
alter table public.channels            enable row level security;
alter table public.channel_members     enable row level security;
alter table public.messages            enable row level security;
alter table public.message_reactions   enable row level security;
alter table public.channel_read_states enable row level security;
alter table public.shifts              enable row level security;
alter table public.shift_breaks        enable row level security;
alter table public.punishments         enable row level security;
alter table public.application_forms   enable row level security;
alter table public.applications        enable row level security;
alter table public.sessions            enable row level security;
alter table public.polls               enable row level security;
alter table public.poll_votes          enable row level security;
alter table public.cad_calls           enable row level security;
alter table public.server_settings     enable row level security;
alter table public.game_events         enable row level security;
alter table public.audit_log           enable row level security;

-- profiles
create policy "profiles: anyone signed in can read" on public.profiles for select to authenticated using (true);
create policy "profiles: edit own or admin" on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

-- departments
create policy "departments: read" on public.departments for select to authenticated using (true);
create policy "departments: admin insert" on public.departments for insert to authenticated with check (public.is_admin());
create policy "departments: admin/leader update" on public.departments for update to authenticated
  using (public.is_department_leader(id));
create policy "departments: admin delete" on public.departments for delete to authenticated using (public.is_admin());

create policy "ranks: read" on public.department_ranks for select to authenticated using (true);
create policy "ranks: leader write" on public.department_ranks for all to authenticated
  using (public.is_department_leader(department_id)) with check (public.is_department_leader(department_id));

create policy "dept members: read" on public.department_members for select to authenticated using (true);
create policy "dept members: leader write" on public.department_members for all to authenticated
  using (public.is_department_leader(department_id)) with check (public.is_department_leader(department_id));

-- channels
create policy "categories: read" on public.channel_categories for select to authenticated using (true);
create policy "categories: admin write" on public.channel_categories for all to authenticated
  using (public.is_admin() or (department_id is not null and public.is_department_leader(department_id)))
  with check (public.is_admin() or (department_id is not null and public.is_department_leader(department_id)));

create policy "channels: read visible" on public.channels for select to authenticated using (public.can_view_channel(id));
create policy "channels: admin/leader insert" on public.channels for insert to authenticated
  with check (public.is_admin() or (department_id is not null and public.is_department_leader(department_id)) or type = 'dm');
create policy "channels: admin/leader update" on public.channels for update to authenticated
  using (public.is_admin() or (department_id is not null and public.is_department_leader(department_id)));
create policy "channels: admin delete" on public.channels for delete to authenticated using (public.is_admin());

create policy "channel members: read" on public.channel_members for select to authenticated
  using (profile_id = auth.uid() or public.is_admin() or public.can_view_channel(channel_id));
create policy "channel members: admin or creator add" on public.channel_members for insert to authenticated
  with check (public.is_admin() or exists (select 1 from public.channels c where c.id = channel_id and c.created_by = auth.uid()));
create policy "channel members: leave or admin remove" on public.channel_members for delete to authenticated
  using (profile_id = auth.uid() or public.is_admin());

-- messages
create policy "messages: read visible channels" on public.messages for select to authenticated using (public.can_view_channel(channel_id));
create policy "messages: post in visible channels" on public.messages for insert to authenticated
  with check (
    author_id = auth.uid()
    and public.can_view_channel(channel_id)
    and not exists (select 1 from public.channels c where c.id = channel_id and c.type = 'announcement' and not public.is_staff())
  );
create policy "messages: edit own or staff" on public.messages for update to authenticated
  using (author_id = auth.uid() or public.is_staff());
create policy "messages: delete own or staff" on public.messages for delete to authenticated
  using (author_id = auth.uid() or public.is_staff());

create policy "reactions: read" on public.message_reactions for select to authenticated
  using (exists (select 1 from public.messages m where m.id = message_id and public.can_view_channel(m.channel_id)));
create policy "reactions: add own" on public.message_reactions for insert to authenticated with check (profile_id = auth.uid());
create policy "reactions: remove own" on public.message_reactions for delete to authenticated using (profile_id = auth.uid());

create policy "read states: own" on public.channel_read_states for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- shifts
create policy "shifts: read" on public.shifts for select to authenticated using (true);
create policy "shifts: start own" on public.shifts for insert to authenticated with check (profile_id = auth.uid());
create policy "shifts: update own or admin" on public.shifts for update to authenticated
  using (profile_id = auth.uid() or public.is_admin());
create policy "shifts: admin delete" on public.shifts for delete to authenticated using (public.is_admin());

create policy "breaks: read" on public.shift_breaks for select to authenticated using (true);
create policy "breaks: own shift" on public.shift_breaks for all to authenticated
  using (exists (select 1 from public.shifts s where s.id = shift_id and (s.profile_id = auth.uid() or public.is_admin())))
  with check (exists (select 1 from public.shifts s where s.id = shift_id and (s.profile_id = auth.uid() or public.is_admin())));

-- punishments
create policy "punishments: staff read" on public.punishments for select to authenticated using (public.is_staff());
create policy "punishments: staff insert" on public.punishments for insert to authenticated with check (public.is_staff() and moderator_id = auth.uid());
create policy "punishments: admin or author update" on public.punishments for update to authenticated
  using (public.is_admin() or moderator_id = auth.uid());
create policy "punishments: admin delete" on public.punishments for delete to authenticated using (public.is_admin());

-- applications
create policy "forms: read" on public.application_forms for select to authenticated using (true);
create policy "forms: admin/leader write" on public.application_forms for all to authenticated
  using (public.is_admin() or (department_id is not null and public.is_department_leader(department_id)))
  with check (public.is_admin() or (department_id is not null and public.is_department_leader(department_id)));

create policy "applications: own or reviewer read" on public.applications for select to authenticated
  using (applicant_id = auth.uid() or public.is_staff()
         or exists (select 1 from public.application_forms f where f.id = form_id and f.department_id is not null and public.is_department_leader(f.department_id)));
create policy "applications: submit own" on public.applications for insert to authenticated with check (applicant_id = auth.uid());
create policy "applications: reviewer update" on public.applications for update to authenticated
  using (public.is_staff()
         or exists (select 1 from public.application_forms f where f.id = form_id and f.department_id is not null and public.is_department_leader(f.department_id)));

-- sessions & polls
create policy "sessions: read" on public.sessions for select to authenticated using (true);
create policy "sessions: staff write" on public.sessions for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "polls: read" on public.polls for select to authenticated using (true);
create policy "polls: staff write" on public.polls for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "votes: read" on public.poll_votes for select to authenticated using (true);
create policy "votes: own" on public.poll_votes for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- CAD
create policy "cad: read" on public.cad_calls for select to authenticated using (true);
create policy "cad: anyone can create a call" on public.cad_calls for insert to authenticated with check (created_by = auth.uid());
create policy "cad: staff or department update" on public.cad_calls for update to authenticated
  using (public.is_staff() or (department_id is not null and public.is_department_member(department_id)) or created_by = auth.uid());
create policy "cad: staff delete" on public.cad_calls for delete to authenticated using (public.is_staff());

-- settings / events / audit — admin only from the client; the server uses the service role.
create policy "settings: admin read" on public.server_settings for select to authenticated using (public.is_admin());
create policy "settings: admin update" on public.server_settings for update to authenticated using (public.is_admin());
create policy "events: staff read" on public.game_events for select to authenticated using (public.is_staff());
create policy "audit: admin read" on public.audit_log for select to authenticated using (public.is_admin());

-- -----------------------------------------------------------------------------
-- 5. Realtime — broadcast row changes for the live features
-- -----------------------------------------------------------------------------
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.message_reactions;
alter publication supabase_realtime add table public.shifts;
alter publication supabase_realtime add table public.cad_calls;
alter publication supabase_realtime add table public.channels;

-- Realtime needs the full old row to filter deletes/updates by channel.
alter table public.messages replica identity full;
alter table public.message_reactions replica identity full;

-- -----------------------------------------------------------------------------
-- 6. Storage bucket for chat attachments
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('attachments', 'attachments', true, 10485760,
        array['image/png','image/jpeg','image/gif','image/webp','application/pdf','text/plain'])
on conflict (id) do nothing;

create policy "attachments: public read" on storage.objects for select using (bucket_id = 'attachments');
create policy "attachments: signed-in upload" on storage.objects for insert to authenticated with check (bucket_id = 'attachments');
create policy "attachments: owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'attachments' and owner = auth.uid());

-- -----------------------------------------------------------------------------
-- 7. Seed data — a sensible starting layout
-- -----------------------------------------------------------------------------
insert into public.server_settings (id, community_name) values (1, 'County Hub') on conflict do nothing;

insert into public.departments (name, slug, description, color, icon, position) values
  ('Police Department', 'police', 'Liberty County law enforcement.', '#3987e5', 'shield', 1),
  ('Fire & EMS', 'fire-ems', 'Fire suppression and emergency medical services.', '#e66767', 'flame', 2),
  ('Department of Transportation', 'dot', 'Road maintenance, towing and traffic control.', '#c98500', 'truck', 3),
  ('Civilian Operations', 'civilian', 'Civilian roleplay coordination.', '#199e70', 'users', 4);

insert into public.department_ranks (department_id, name, level)
select d.id, r.name, r.level
from public.departments d
cross join lateral (values
  ('Chief', 100), ('Deputy Chief', 90), ('Captain', 80), ('Lieutenant', 70),
  ('Sergeant', 60), ('Corporal', 50), ('Officer', 40), ('Probationary', 10)
) as r(name, level)
where d.slug = 'police';

insert into public.department_ranks (department_id, name, level)
select d.id, r.name, r.level
from public.departments d
cross join lateral (values
  ('Fire Chief', 100), ('Battalion Chief', 80), ('Captain', 70), ('Lieutenant', 60),
  ('Firefighter / Paramedic', 40), ('Probationary', 10)
) as r(name, level)
where d.slug = 'fire-ems';

insert into public.department_ranks (department_id, name, level)
select d.id, r.name, r.level
from public.departments d
cross join lateral (values ('Director', 100), ('Supervisor', 70), ('Operator', 40), ('Trainee', 10)) as r(name, level)
where d.slug in ('dot', 'civilian');

-- Channel categories + channels
insert into public.channel_categories (name, position) values ('Community', 1), ('Staff', 2);

insert into public.channels (category_id, name, slug, topic, type, position, min_role)
select c.id, v.name, v.slug, v.topic, v.type::public.channel_type, v.pos, v.min_role::public.app_role
from public.channel_categories c
join lateral (values
  ('Community', 'announcements', 'announcements', 'Official community announcements.', 'announcement', 1, null),
  ('Community', 'general', 'general', 'Chat about anything ER:LC.', 'text', 2, null),
  ('Community', 'off-topic', 'off-topic', 'Everything that is not ER:LC.', 'text', 3, null),
  ('Community', 'session-updates', 'session-updates', 'Session starts, polls and votes.', 'text', 4, null),
  ('Staff', 'staff-chat', 'staff-chat', 'Staff-only discussion.', 'text', 1, 'staff'),
  ('Staff', 'mod-logs', 'mod-logs', 'Automatic moderation log feed.', 'text', 2, 'staff'),
  ('Staff', 'leadership', 'leadership', 'Admins and owner only.', 'text', 3, 'admin')
) as v(category, name, slug, topic, type, pos, min_role) on v.category = c.name;

-- One category + one channel per department
insert into public.channel_categories (name, position, department_id)
select d.name, 10 + d.position, d.id from public.departments d;

insert into public.channels (category_id, department_id, name, slug, topic, type, position)
select c.id, d.id, 'dept-' || d.slug, 'dept-' || d.slug, d.name || ' department chat.', 'text', 1
from public.departments d join public.channel_categories c on c.department_id = d.id;

insert into public.channels (category_id, department_id, name, slug, topic, type, position)
select c.id, d.id, d.slug || '-announcements', d.slug || '-announcements', d.name || ' announcements.', 'announcement', 0
from public.departments d join public.channel_categories c on c.department_id = d.id;

-- Starter application form
insert into public.application_forms (title, description, department_id, questions)
select 'Staff Application', 'Apply to join the moderation team.', null,
  '[{"id":"age","label":"How old are you?","type":"short","required":true},
    {"id":"experience","label":"Describe your previous moderation experience.","type":"long","required":true},
    {"id":"hours","label":"How many hours per week can you dedicate?","type":"short","required":true},
    {"id":"why","label":"Why do you want to join our staff team?","type":"long","required":true}]'::jsonb;
