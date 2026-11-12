const {test}=require('node:test');const assert=require('node:assert/strict');const {readFileSync}=require('node:fs');const {PGlite}=require('@electric-sql/pglite');
const {fallbackNote,formatNote}=require('../.test-build/lib/notes.js');
test('CMX1 separates observation and completed action, with no automatic recommendation or follow-up',()=>{
 const input={question:'Name badge present?',answer:'no',observation:'Chef missing name badge',findings:[],resolution:{status:'Corrected Onsite',actionTaken:'Replacement badge supplied',verification:'Observed correction'}};
 const text=formatNote(fallbackNote(input));assert.equal(text.split('\n').length,2);assert.doesNotMatch(text,/Recommended|next visit|Follow-up/);
 assert.equal(formatNote(fallbackNote({...input,resolution:{...input.resolution,followUpRequired:true}})).split('\n').length,3);
 const positive=formatNote(fallbackNote({question:'Products held below 41°F?',answer:'yes',observation:'Products verified below 41°F',findings:[]}));assert.equal(positive,'Products verified below 41°F.');
});
test('AI conversations enforce ownership and valid report scopes, and remain separate from reports',async()=>{
 const db=new PGlite();const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',id='33333333-3333-4333-8333-333333333333';
 try{await db.exec(`create role authenticated;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${a}'),('${b}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;create table visit_reports(id uuid primary key,user_id uuid);insert into visit_reports values('${id}','${a}');alter table visit_reports enable row level security;create policy own on visit_reports for select using(user_id=auth.uid());grant select on visit_reports to authenticated;`);
 await db.exec(readFileSync('supabase/migrations/20261112_ai_conversations.sql','utf8'));
 await db.exec(`set role authenticated;set request.jwt.claim.sub='${a}';`);
 await db.query('insert into ai_messages(user_id,report_id,question_id,scope,role,content) values($1,$2,$3,$4,$5,$6)',[a,id,'store-1',`${id}:store-1`,'user','Help with this note']);
 await assert.rejects(()=>db.query("insert into ai_messages(user_id,scope,role,content) values($1,'wrong','user','x')",[a]));
 await db.exec(`set request.jwt.claim.sub='${b}';`);assert.equal((await db.query('select * from ai_messages')).rows.length,0);assert.equal((await db.query('delete from ai_messages returning id')).rows.length,0);
 await assert.rejects(()=>db.query("insert into ai_messages(user_id,report_id,scope,role,content) values($1,$2,$3,'user','x')",[b,id,`${id}:report`]));
 await db.exec(`set request.jwt.claim.sub='${a}';`);assert.equal((await db.query('delete from ai_messages returning id')).rows.length,1);assert.equal((await db.query('select * from visit_reports')).rows.length,1);
 }finally{await db.close();}
});
