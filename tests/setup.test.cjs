const {test}=require('node:test');const assert=require('node:assert/strict');const {PGlite}=require('@electric-sql/pglite');const {readFileSync}=require('node:fs');
test('single SQL setup installs an empty project and reruns without losing reports',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id serial primary key,bucket_id text,name text);alter table storage.objects enable row level security;create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name,'/') $$;`);
 const sql=readFileSync('supabase/setup.sql','utf8');await db.exec(sql);
 assert.equal((await db.query("select count(*)::int as n from pg_policies where tablename='ai_messages'")).rows[0].n,1);
 const uid='11111111-1111-4111-8111-111111111111';await db.query('insert into auth.users values($1)',[uid]);
 await db.query("insert into visit_reports(user_id,title,form_type,training_data) values($1,'Keep this report','Improvement Training Record','{\"issues\":[]}'::jsonb)",[uid]);
 await db.exec(sql);assert.equal((await db.query('select title from visit_reports')).rows[0].title,'Keep this report');
 assert.equal((await db.query("select count(*)::int as n from pg_policies where tablename='visit_reports'")).rows[0].n,4);
 assert.equal((await db.query("select public from storage.buckets where id='training-evidence'")).rows[0].public,false);
 await db.exec(`grant select,insert,update,delete on visit_reports to authenticated;set role authenticated;set request.jwt.claim.sub='${uid}';`);
 const result=await db.query("select * from save_field_report('33333333-3333-4333-8333-333333333333',0,$1::jsonb)",[JSON.stringify({form_type:'Improvement Training Record',status:'draft',answers:{},training_data:{issues:[]},save_token:'test'})]);assert.equal(result.rows[0].revision,1);
 }finally{await db.close();}
});
