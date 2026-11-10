-- Run once in Supabase SQL Editor. Each signed-in user sees only their own records.
create table if not exists public.visit_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  form_type text not null default 'Store Visit' check (form_type in ('Store Visit', 'Operational Excellence Review')),
  status text not null default 'draft' check (status in ('draft','completed')),
  answers jsonb not null default '{}'::jsonb,
  oer_data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists visit_reports_user_updated_idx on public.visit_reports (user_id, updated_at desc);
alter table public.visit_reports enable row level security;
create policy "Read own reports" on public.visit_reports for select to authenticated using ((select auth.uid()) = user_id);
create policy "Create own reports" on public.visit_reports for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own reports" on public.visit_reports for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own reports" on public.visit_reports for delete to authenticated using ((select auth.uid()) = user_id);
-- Production teams should also establish retention and access policies before storing operational records.
