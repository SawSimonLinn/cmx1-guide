const {test}=require('node:test');
const assert=require('node:assert/strict');
const {acknowledgePending,parsePendingJournal}=require('../.test-build/components/report-journal.js');
const uid='11111111-1111-4111-8111-111111111111',id='33333333-3333-4333-8333-333333333333';
const row={id,user_id:uid,form_type:'Store Visit',title:'Current title',status:'draft',answers:{8:{answer:'no',note:'Manual edit',generated:{source:'fallback',observation:'Missing badge'},resolution:{status:'Open',training:'Training Recommended',followUpRequired:true}}},oer_data:null,executive_summary:'Custom summary',created_at:'2026-11-11T12:00:00Z',updated_at:'2026-11-11T12:01:00Z',revision:3};
test('save acknowledgment clears exactly the snapshot confirmed by Supabase',()=>{const pending={report:row,token:'one',expectedRevision:2};assert.equal(acknowledgePending(pending,'one',row),undefined);});
test('an older save response advances revision without overwriting newer edits',()=>{
 const newer={report:{...row,title:'Newest title',answers:{8:{answer:'no',note:'Newest manual edit'}}},token:'two',expectedRevision:2};
 const result=acknowledgePending(newer,'one',{...row,revision:4,title:'Old title'});
 assert.equal(result.report.title,'Newest title');assert.equal(result.report.answers[8].note,'Newest manual edit');assert.equal(result.expectedRevision,4);assert.equal(result.token,'two');assert.equal(newer.expectedRevision,2);
});
test('refresh recovery preserves the entire pending report and idempotency token',()=>{const value={[id]:{report:row,token:'retry-token',expectedRevision:3}};assert.deepEqual(parsePendingJournal(JSON.parse(JSON.stringify(value)),uid),value);});
test('journal isolates accounts and rejects malformed responses and drafts',()=>{
 const valid={report:row,token:'retry-token',expectedRevision:3};
 for(const value of [null,[],{[id]:{...valid,report:{...row,user_id:'other'}}},{[id]:{...valid,expectedRevision:-1}},{[id]:{...valid,report:{...row,answers:{8:{findings:'not an array'}}}}},{[id]:{...valid,report:{...row,created_at:'invalid'}}}])assert.deepEqual(parsePendingJournal(value,uid),{});
});
test('OER pending recovery retains presence, manual notes, resolutions and generated sections',()=>{
 const report={...row,form_type:'Operational Excellence Review',oer_data:{presence:'absent',answers:{17:{answer:'no',observations:'Cannot calibrate meter',note:'Manual',resolution:{status:'Open',followUpRequired:true}}},deepCleaning:{note:'Manual deep cleaning'},wrapUp:'Manual wrap-up',summary:'Manual executive summary'}};
 const value={[id]:{report,token:'oer-token',expectedRevision:3}};assert.deepEqual(parsePendingJournal(JSON.parse(JSON.stringify(value)),uid),value);
});
