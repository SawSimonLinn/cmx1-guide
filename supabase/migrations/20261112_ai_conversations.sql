-- Chat is private working material, never official report observation data.
create table if not exists public.ai_messages (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 report_id uuid references public.visit_reports(id) on delete cascade,
 question_id text,
 scope text not null check (length(scope)<=180),
 role text not null check (role in ('user','assistant')),
 content text not null check (length(content)<=8000),
 note text not null default '' check (length(note)<=6000),
 source text check (source in ('ai','fallback')),
 created_at timestamptz not null default clock_timestamp()
);
create index if not exists ai_messages_scope on public.ai_messages(user_id,scope,created_at);
alter table public.ai_messages enable row level security;
drop policy if exists ai_messages_owner on public.ai_messages;
create policy ai_messages_owner on public.ai_messages for all to authenticated
 using (user_id=auth.uid()) with check (
 user_id=auth.uid() and (report_id is null or exists (
 select 1 from public.visit_reports r where r.id=report_id and r.user_id=auth.uid()
 )) and scope=coalesce(report_id::text,'global')||':'||coalesce(question_id,'report')
);
grant select,insert,delete on public.ai_messages to authenticated;

-- Refresh the REST schema cache after installing this table.
notify pgrst, 'reload schema';
