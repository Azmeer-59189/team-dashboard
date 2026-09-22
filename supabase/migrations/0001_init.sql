-- ============================================================
-- Team Dashboard - initial schema
-- Run this in Supabase SQL editor (or via `supabase db push`)
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- DEPARTMENTS ----------
create table if not exists departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

-- ---------- PROFILES ----------
-- One row per auth user. Created by the admin-only API (service role),
-- never by the client directly.
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null,
  role text not null check (role in ('admin', 'member')),
  department_id uuid references departments (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- TASKS ----------
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  department_id uuid references departments (id) on delete set null,
  type text not null check (type in ('text', 'link')),
  content text not null,
  task_date date not null default current_date,
  status text not null default 'pending' check (status in ('pending', 'in-progress', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tasks_user on tasks (user_id);
create index if not exists idx_tasks_department on tasks (department_id);
create index if not exists idx_tasks_date on tasks (task_date);
create index if not exists idx_tasks_status on tasks (status);

-- keep department_id on tasks in sync with the author's profile automatically
create or replace function set_task_department()
returns trigger as $$
begin
  select department_id into new.department_id from profiles where id = new.user_id;
  new.updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_set_task_department on tasks;
create trigger trg_set_task_department
  before insert or update on tasks
  for each row execute function set_task_department();

-- ---------- Helper: is the current user an admin? ----------
-- security definer so it can read `profiles` without recursive RLS issues
create or replace function is_admin()
returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable;

-- ============================================================
-- RLS
-- ============================================================
alter table departments enable row level security;
alter table profiles enable row level security;
alter table tasks enable row level security;

-- departments: any signed-in user can read (needed for dropdowns),
-- only admins can write
create policy "departments_select_all" on departments
  for select using (auth.role() = 'authenticated');

create policy "departments_write_admin" on departments
  for all using (is_admin()) with check (is_admin());

-- profiles: users can read their own profile; admins can read/update all
create policy "profiles_select_own" on profiles
  for select using (id = auth.uid() or is_admin());

create policy "profiles_update_admin" on profiles
  for update using (is_admin()) with check (is_admin());

-- profiles insert/delete happens only via the service-role key
-- (server-side admin API), so no client-facing insert/delete policy.

-- tasks: members manage only their own rows; admins can do everything
create policy "tasks_select_own_or_admin" on tasks
  for select using (user_id = auth.uid() or is_admin());

create policy "tasks_insert_own" on tasks
  for insert with check (user_id = auth.uid());

create policy "tasks_update_own_or_admin" on tasks
  for update using (user_id = auth.uid() or is_admin())
  with check (user_id = auth.uid() or is_admin());

create policy "tasks_delete_own_or_admin" on tasks
  for delete using (user_id = auth.uid() or is_admin());

-- ============================================================
-- Seed: create your first admin manually after running this file.
-- 1. Create the user in Supabase Auth (dashboard or Admin API).
-- 2. Then run:
--    insert into profiles (id, full_name, email, role, department_id)
--    values ('<auth-user-uuid>', 'Your Name', 'you@company.com', 'admin', null);
-- ============================================================
