-- Private evidence. Paths are <owner uuid>/<report uuid>/<file uuid>.<extension>.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('training-evidence','training-evidence',false,20971520,array['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf'])
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "Training evidence read" on storage.objects;
create policy "Training evidence read" on storage.objects for select to authenticated using (
 bucket_id='training-evidence' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "Training evidence upload" on storage.objects;
create policy "Training evidence upload" on storage.objects for insert to authenticated with check (
 bucket_id='training-evidence' and (storage.foldername(name))[1]=auth.uid()::text
 and exists(select 1 from public.visit_reports r where r.id::text=(storage.foldername(name))[2] and r.user_id=auth.uid() and r.form_type='Improvement Training Record'));
drop policy if exists "Training evidence delete" on storage.objects;
create policy "Training evidence delete" on storage.objects for delete to authenticated using (
 bucket_id='training-evidence' and (storage.foldername(name))[1]=auth.uid()::text);
commit;
