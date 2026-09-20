-- SEO Service Provider - Supabase schema (secure server-side data)
-- Run this in Supabase SQL Editor. This is the migration path that moves
-- accounts/payments off the browser localStorage so nobody can read them
-- by opening DevTools or viewing the frontend source.

create extension if not exists "citext";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email citext unique not null,
  role text not null default 'user' check (role in ('user','admin')),
  blocked boolean not null default false,
  deleted boolean not null default false,
  deleted_at timestamptz,
  phone text,
  phone_verified boolean not null default false,
  plan text,
  plan_name text,
  plan_agents int,
  plan_daily int,
  plan_monthly int,
  premium_since timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  client_ref text unique,
  profile_id uuid references public.profiles(id) on delete set null,
  email citext not null,
  name text,
  plan text,
  plan_name text,
  amount numeric(10,2) not null default 0,
  method text,
  method_id text,
  trx text,
  order_id text,
  proof_image text,
  status text not null default 'pending' check (status in ('pending','auto_verifying','approved','rejected')),
  auto_approved boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists payments_email_idx on public.payments(email);
create index if not exists payments_created_idx on public.payments(created_at desc);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  client_ref text unique,
  profile_id uuid references public.profiles(id) on delete cascade,
  email citext not null,
  primary_keyword text,
  title_count int default 0,
  intent text,
  titles jsonb default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  client_ref text unique,
  email citext not null,
  name text,
  messages jsonb not null default '[]'::jsonb,
  user_unread int not null default 0,
  admin_unread int not null default 0,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- RLS
alter table public.profiles enable row level security;
alter table public.payments enable row level security;
alter table public.reports  enable row level security;
alter table public.chats    enable row level security;

-- A user can read/update only their own profile.
create policy "own profile read" on public.profiles
  for select using (auth.uid() = id);
create policy "own profile insert" on public.profiles
  for insert with check (auth.uid() = id);
create policy "own profile update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Admins can do everything (role stored in profiles).
-- NOTE: policies on profiles must NOT query profiles directly or Postgres
-- raises "infinite recursion detected in policy". Use a SECURITY DEFINER
-- helper, which bypasses RLS for the lookup.
create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
grant execute on function public.is_admin() to authenticated, anon;

drop policy if exists "admin all profiles" on public.profiles;
create policy "admin all profiles" on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

create policy "own payments read" on public.payments
  for select using (auth.uid() in (select id from public.profiles where email = payments.email));
create policy "own payments write" on public.payments
  for insert with check (auth.uid() in (select id from public.profiles where email = payments.email));
create policy "own payments update" on public.payments
  for update using (auth.uid() in (select id from public.profiles where email = payments.email));
drop policy if exists "admin all payments" on public.payments;
create policy "admin all payments" on public.payments
  for all using (public.is_admin()) with check (public.is_admin());

create policy "own reports" on public.reports
  for all using (auth.uid() in (select id from public.profiles where email = reports.email));
drop policy if exists "admin all reports" on public.reports;
create policy "admin all reports" on public.reports
  for all using (public.is_admin()) with check (public.is_admin());

create policy "own chats" on public.chats
  for all using (auth.uid() in (select id from public.profiles where email = chats.email));
drop policy if exists "admin all chats" on public.chats;
create policy "admin all chats" on public.chats
  for all using (public.is_admin()) with check (public.is_admin());

-- Promote the first admin after signing up with Supabase Auth:
-- update public.profiles set role = 'admin' where email = 'admin@seo-service-provider.com';

-- ---------------------------------------------------------------- app settings
-- Server-only key/value store (e.g. admin password hash, recovery email, phone).
-- RLS is enabled with no policies, so only the service-role key (used by the
-- backend) can read or write it. The anon/browser key cannot touch it.
--
-- Keys used by the Admin Panel (written only through backend service-role routes):
--   admin_account   - admin password hash + recovery email/phone (per admin email)
--   site_settings   - { maintenance, allowRegistration, concurrencyLimit }
--   plans           - array of subscription plans (name, price, agents, daily, monthly, features)
--   payment_methods - array of payment gateways (bKash, Nagad, Bank, Binance Pay, crypto...)
--   moderators      - array of moderator accounts (scrypt hash, active, permissions)
--   system_logs     - recent background job logs (SEO/AI jobs, success/failure)
--   audit_logs      - security history (admin/moderator logins, settings, backups, CRUD)
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
