const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const userA='11111111-1111-4111-8111-111111111111';
const userB='22222222-2222-4222-8222-222222222222';
const reportId='33333333-3333-4333-8333-333333333333';
const payload=(changes={})=>({form_type:'Store Visit',status:'draft',answers:{1:{answer:'no',note:'Edited note',observationInput:'Missing badge',resolution:{status:'Open',training:'Training Recommended'}}},title:'Daily visit',executive_summary:'Recorded findings',save_token:'save-one',...changes});
test('Postgres migration: idempotent drafts, ordered saves, timestamp ownership and RLS',async t=>{
 const db=new PGlite();
 try {
 await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated; insert into auth.users values ('${userA}'),('${userB}');`);
 await db.exec(readFileSync('supabase/schema.sql','utf8'));
 const migration=readFileSync('supabase/migrations/20261111_daily_operations.sql','utf8');
 await db.exec(migration);await db.exec(migration);
 const trainingMigration=readFileSync('supabase/migrations/20261111_improvement_training.sql','utf8');await db.exec(trainingMigration);await db.exec(trainingMigration);
 await db.exec(`grant select,insert,update,delete on public.visit_reports to authenticated; set role authenticated; set request.jwt.claim.sub='${userA}';`);
 const save=async(revision,p=payload(),id=reportId)=>(await db.query('select * from public.save_field_report($1,$2,$3::jsonb)',[id,revision,JSON.stringify(p)])).rows[0];
 let row;
 await t.test('new draft auto-create is stable and retry does not duplicate',async()=>{
  row=await save(0);assert.equal(row.id,reportId);assert.equal(row.user_id,userA);assert.equal(row.revision,1);assert.equal(row.status,'draft');assert.ok(row.created_at);assert.ok(row.updated_at);
  const duplicate=await save(0);assert.equal(duplicate.revision,1);assert.equal((await db.query('select count(*)::int as n from visit_reports')).rows[0].n,1);
 });
 await t.test('JSON round trip preserves selected answers, edits, generated content, resolution and summary',async()=>{
  assert.equal(row.answers[1].note,'Edited note');assert.equal(row.answers[1].observationInput,'Missing badge');assert.equal(row.answers[1].resolution.training,'Training Recommended');assert.equal(row.executive_summary,'Recorded findings');
  const data=payload({form_type:'Operational Excellence Review',oer_data:{presence:'absent',answers:{6:{answer:'no',findings:['Missing badge'],observations:'No name badge',note:'Hand edited',generated:{observation:'No badge',source:'fallback'}}},deepCleaning:{note:'Manual'},summary:'Executive',wrapUp:'Wrap-up'},save_token:'save-two'});
  row=await save(1,data);assert.equal(row.revision,2);assert.equal(row.oer_data.presence,'absent');assert.equal(row.oer_data.answers[6].note,'Hand edited');assert.equal(row.oer_data.summary,'Executive');
 });
 await t.test('outdated save is rejected and cannot overwrite newer answers',async()=>{
  await assert.rejects(()=>save(1,payload({save_token:'late-save',answers:{1:{answer:'yes'}}})),error=>error.code==='40001');
  const current=(await db.query('select * from visit_reports')).rows[0];assert.equal(current.revision,2);assert.equal(current.answers[1].answer,'no');
 });
 await t.test('explicit completion and reopen use database timestamps',async()=>{
  row=await save(2,payload({status:'completed',save_token:'complete',created_at:'2000-01-01',updated_at:'2000-01-01'}));assert.ok(row.completed_at);assert.notEqual(new Date(row.created_at).getUTCFullYear(),2000);assert.equal(row.revision,3);
  row=await save(3,payload({status:'draft',save_token:'reopen'}));assert.equal(row.completed_at,null);assert.equal(row.revision,4);
 });
 await t.test('second user cannot read, update, delete or replay another user save token',async()=>{
  await db.exec(`set request.jwt.claim.sub='${userB}';`);
  assert.equal((await db.query('select * from visit_reports')).rows.length,0);
  assert.equal((await db.query('update visit_reports set title=$1 where id=$2 returning id',['stolen',reportId])).rows.length,0);
  assert.equal((await db.query('delete from visit_reports where id=$1 returning id',[reportId])).rows.length,0);
  await assert.rejects(()=>save(0,payload({save_token:'reopen'})));
  await assert.rejects(()=>db.query('insert into visit_reports(user_id) values ($1)',[userA]),error=>error.code==='42501');
  await db.exec(`set request.jwt.claim.sub='${userA}';`);assert.equal((await db.query('select title from visit_reports')).rows[0].title,'Daily visit');
 });
 await t.test('training drafts round trip, copy, complete and reopen under existing concurrency checks',async()=>{
  const {emptyTrainingReport,emptyTrainingIssue}=require('../.test-build/lib/training.js');
  const training_data={...emptyTrainingReport(),employees:'Chef A, Chef B',additionalTrainers:'yes',trainerNames:'Trainer',inventoryRequired:'yes',issues:[{...emptyTrainingIssue('issue-a'),observation:'Missing badge',resolution:'Explained how to order',resolutionStatus:'follow_up',generatedNote:'Ordering guidance provided',editedNote:'Manual note',equipmentRequired:true,equipmentItems:[{name:'Badge',quantity:1,orderStatus:'Pending'}]},{...emptyTrainingIssue('issue-b'),observation:'Open drink',resolution:'Moved drink',resolutionStatus:'corrected'}],attachments:[{id:'photo',path:userA+'/photo.jpg',name:'photo.jpg',type:'image/jpeg',category:'Original issue'}],sections:{incident:'Manual incident',training:'Manual training',inventory:'Pending badge',additional:'Follow-up required'},editedSections:{incident:true}};
  const p=payload({form_type:'Improvement Training Record',training_data,save_token:'training-create'}),tid='44444444-4444-4444-8444-444444444444';
  let r=await save(0,p,tid);assert.deepEqual(r.training_data,training_data);assert.equal(r.revision,1);
  r=await save(1,{...p,status:'completed',save_token:'training-complete'},tid);assert.ok(r.completed_at);
  r=await save(2,{...p,save_token:'training-reopen',training_data:{...training_data,issues:[training_data.issues[1],training_data.issues[0]]}},tid);assert.equal(r.completed_at,null);assert.equal(r.training_data.issues[1].editedNote,'Manual note');
  await assert.rejects(()=>save(1,{...p,save_token:'stale'},tid),e=>e.code==='40001');
  const copy=await save(0,{...p,save_token:'training-copy',training_data:{...training_data,attachments:[]}},'55555555-5555-4555-8555-555555555555');assert.equal(copy.training_data.issues[0].editedNote,'Manual note');
  await db.query('delete from visit_reports where id in ($1,$2)',[tid,copy.id]);
 });
 await t.test('invalid payloads and signed-out writes rejected',async()=>{
  await assert.rejects(()=>save(4,payload({answers:[]})),error=>error.code==='22023');
  await assert.rejects(()=>save(4,payload({form_type:'Other'})),error=>error.code==='22023');
  await assert.rejects(()=>save(4,payload({title:'a'.repeat(201)})),error=>error.code==='22023');
  await db.exec(`set request.jwt.claim.sub='';`);await assert.rejects(()=>save(4),error=>error.code==='42501');
 });
 }finally {await db.close();}
});
