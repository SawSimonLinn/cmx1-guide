const {test}=require('node:test');const assert=require('node:assert/strict');const {PGlite}=require('@electric-sql/pglite');const {readFileSync}=require('node:fs');
test('private evidence migration enforces owner path, existing report and cross-user isolation',async()=>{
 const db=new PGlite();const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',id='33333333-3333-4333-8333-333333333333';
 try{
  await db.exec(`create role authenticated;create schema auth;create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id serial primary key,bucket_id text,name text);alter table storage.objects enable row level security;create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name,'/') $$;grant usage on schema storage to authenticated;grant select,insert,delete on storage.objects to authenticated;grant usage,select on sequence storage.objects_id_seq to authenticated;create table public.visit_reports(id uuid primary key,user_id uuid,form_type text);alter table public.visit_reports enable row level security;create policy own_reports on public.visit_reports for select to authenticated using(user_id=auth.uid());grant select on public.visit_reports to authenticated;insert into visit_reports values('${id}','${a}','Improvement Training Record');`);
  const migration=readFileSync('supabase/migrations/20261111_training_evidence.sql','utf8');await db.exec(migration);await db.exec(migration);
  assert.equal((await db.query('select public from storage.buckets')).rows[0].public,false);
  await db.exec(`set role authenticated;set request.jwt.claim.sub='${a}';`);
  const path=`${a}/${id}/evidence.jpg`;
  await db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['training-evidence',path]);
  assert.equal((await db.query('select * from storage.objects')).rows.length,1);
  await assert.rejects(()=>db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['training-evidence',`${b}/${id}/bad.jpg`]),e=>e.code==='42501');
  await assert.rejects(()=>db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['training-evidence',`${a}/missing-report/bad.jpg`]),e=>e.code==='42501');
  await db.exec(`set request.jwt.claim.sub='${b}';`);assert.equal((await db.query('select * from storage.objects')).rows.length,0);assert.equal((await db.query('delete from storage.objects returning id')).rows.length,0);
  await db.exec(`set request.jwt.claim.sub='${a}';`);assert.equal((await db.query('delete from storage.objects returning id')).rows.length,1);
 }finally{await db.close();}
});
