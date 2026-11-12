-- Additive: existing Store Visit / OER data, RLS, tokens and revision checks retained.
begin;
alter table public.visit_reports add column if not exists training_data jsonb;
alter table public.visit_reports drop constraint if exists visit_reports_form_type_check;
alter table public.visit_reports add constraint visit_reports_form_type_check check (form_type in ('Store Visit','Operational Excellence Review','Improvement Training Record'));
create or replace function public.save_field_report(p_id uuid, p_expected_revision integer, p_payload jsonb)
returns setof public.visit_reports language plpgsql security invoker set search_path = public as $$
declare
  current_report public.visit_reports;
  token text := p_payload->>'save_token';
  found_row boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_id is null or p_expected_revision is null or p_expected_revision < 0 then raise exception 'Invalid report revision' using errcode = '22023'; end if;
  if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text) > 1000000 then raise exception 'Invalid report payload' using errcode = '22023'; end if;
  if coalesce(p_payload->>'form_type','') not in ('Store Visit','Operational Excellence Review','Improvement Training Record') or coalesce(p_payload->>'status','') not in ('draft','completed') then raise exception 'Invalid report type or status' using errcode = '22023'; end if;
  if jsonb_typeof(p_payload->'answers') is distinct from 'object' or (p_payload->'oer_data' is not null and p_payload->'oer_data' <> 'null'::jsonb and jsonb_typeof(p_payload->'oer_data') <> 'object') then raise exception 'Invalid answers' using errcode = '22023'; end if;
  if p_payload->>'form_type' = 'Improvement Training Record' and (jsonb_typeof(p_payload->'training_data') is distinct from 'object' or jsonb_typeof(p_payload->'training_data'->'issues') is distinct from 'array') then raise exception 'Invalid training report' using errcode = '22023'; end if;
  if length(coalesce(p_payload->>'title','')) > 200 or length(coalesce(p_payload->>'executive_summary','')) > 20000 or length(coalesce(token,'')) > 100 then raise exception 'Report text too long' using errcode = '22023'; end if;
  -- Serialise even the first INSERT for this UUID, including overlapping Strict Mode requests.
  perform pg_advisory_xact_lock(hashtextextended(p_id::text, 0));
  select * into current_report from public.visit_reports where id = p_id for update;
  found_row := found;
  if found_row and token is not null and token <> '' and current_report.last_save_token = token then
    return next current_report; return;
  end if;
  if found_row and current_report.revision <> p_expected_revision then
    raise exception 'This report changed in another session. Review the latest version before replacing it.' using errcode = '40001';
  end if;
  if not found_row then
    if p_expected_revision <> 0 then raise exception 'Report no longer exists' using errcode = '40001'; end if;
    insert into public.visit_reports(id,user_id,form_type,status,answers,oer_data,training_data,title,executive_summary,revision,last_save_token)
    values(p_id,auth.uid(),p_payload->>'form_type',p_payload->>'status',p_payload->'answers',nullif(p_payload->'oer_data','null'::jsonb),nullif(p_payload->'training_data','null'::jsonb),coalesce(p_payload->>'title',''),coalesce(p_payload->>'executive_summary',''),1,token)
    returning * into current_report;
  else
    update public.visit_reports set form_type=p_payload->>'form_type',status=p_payload->>'status',answers=p_payload->'answers',oer_data=nullif(p_payload->'oer_data','null'::jsonb),training_data=nullif(p_payload->'training_data','null'::jsonb),title=coalesce(p_payload->>'title',''),executive_summary=coalesce(p_payload->>'executive_summary',''),revision=revision+1,last_save_token=token
    where id=p_id and user_id=auth.uid() returning * into current_report;
  end if;
  return next current_report;
end;
$$;
revoke all on function public.save_field_report(uuid,integer,jsonb) from public, anon;
grant execute on function public.save_field_report(uuid,integer,jsonb) to authenticated;
commit;
