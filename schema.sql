-- Today Mood: Supabase SQL schema
-- Run this entire file in Supabase Dashboard > SQL Editor.
-- The service_role key must NEVER be placed in the browser.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.mood_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mood text not null check (mood in ('happy','calm','loved','neutral','sad','angry','anxious','tired','confused','excited','lonely','overwhelmed')),
  intensity int not null check (intensity between 1 and 5),
  reason text not null default 'เรื่องทั่วไป' check (char_length(reason) <= 100),
  note text check (note is null or char_length(note) <= 1500),
  created_at timestamptz not null default now()
);

create index if not exists mood_entries_user_created_idx
  on public.mood_entries(user_id, created_at desc);

-- Create a profile automatically whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, role) values (new.id, 'user')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.mood_entries enable row level security;

-- Users may read only their own profile. A user cannot update their role.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
for select to authenticated using (id = (select auth.uid()));

-- Entries: each account can access only its own entries.
drop policy if exists "entries_select_own" on public.mood_entries;
create policy "entries_select_own" on public.mood_entries
for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "entries_insert_own" on public.mood_entries;
create policy "entries_insert_own" on public.mood_entries
for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "entries_delete_own" on public.mood_entries;
create policy "entries_delete_own" on public.mood_entries
for delete to authenticated using (user_id = (select auth.uid()));

-- Deliberately no user update policy: mood history is immutable in this MVP.
-- Admin can read aggregate statistics only; the function returns no notes or identities.
create or replace function public.admin_mood_summary()
returns table(user_count bigint, entry_count bigint, average_intensity numeric)
language plpgsql security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  ) then
    raise exception 'not authorized';
  end if;
  return query
    select
      (select count(*) from public.profiles)::bigint,
      (select count(*) from public.mood_entries)::bigint,
      (select round(avg(intensity)::numeric, 2) from public.mood_entries);
end;
$$;

revoke all on function public.admin_mood_summary() from public, anon;
grant execute on function public.admin_mood_summary() to authenticated;

-- Set the first administrator MANUALLY after creating your account:
-- 1) Find your account UUID in Authentication > Users.
-- 2) Run this statement with your actual UUID in the SQL Editor:
-- update public.profiles set role = 'admin' where id = 'YOUR-AUTH-USER-UUID';
-- Do not expose admin role changes in the public-facing app.
