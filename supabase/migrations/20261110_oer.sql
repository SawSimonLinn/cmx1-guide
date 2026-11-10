-- Existing per-user RLS policies continue to protect both report types.
begin;
alter table public.visit_reports drop constraint if exists visit_reports_form_type_check;
alter table public.visit_reports add constraint visit_reports_form_type_check
  check (form_type in ('Store Visit', 'Operational Excellence Review'));
alter table public.visit_reports add column if not exists oer_data jsonb;
commit;
