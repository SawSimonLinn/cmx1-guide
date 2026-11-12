const {test}=require('node:test');
const assert=require('node:assert/strict');
const {emptyTrainingReport,emptyTrainingIssue,isTrainingReport,fallbackTrainingSections}=require('../.test-build/lib/training.js');
const {parseTrainingRequest,generateTraining}=require('../.test-build/lib/server/training-provider.js');
const {parsePendingJournal,acknowledgePending}=require('../.test-build/components/report-journal.js');
const issue=(id,patch={})=>({...emptyTrainingIssue(id),observation:'Chef cannot calibrate pH meter',...patch});
test('training starts blank without sample PDF names or findings',()=>{const r=emptyTrainingReport();assert.ok(isTrainingReport(r));assert.deepEqual(r.issues,[]);assert.equal(r.incidentDate,'');assert.equal(r.employees,'');assert.deepEqual(r.attachments,[]);});
test('training parser rejects invalid status, duplicates and malformed equipment',()=>{
 for(const i of [issue('a',{resolutionStatus:'fake'}),issue('a',{equipmentItems:[{name:'Meter',quantity:-1}]}),issue('a',{generatedNote:123})])assert.throws(()=>parseTrainingRequest({kind:'training_issue',issue:i}));
 assert.equal(isTrainingReport({...emptyTrainingReport(),issues:[issue('a'),issue('a')]}),false);
});
test('fallback preserves planned actions as attributed notes and flags outstanding work',async()=>{
 const r={...emptyTrainingReport(),incidentSource:'Health Department Inspection',issues:[issue('a',{resolution:'Will teach calibration tomorrow',resolutionStatus:'open',trainingStatus:'recommended'}),issue('b',{observation:'Open drink on prep table',resolution:'Moved drink to break room',resolutionStatus:'corrected',trainingStatus:'completed'})]};
 const {sections,source}=await generateTraining(parseTrainingRequest({kind:'training',report:r}));assert.equal(source,'fallback');assert.match(sections.incident,/Health Department/);assert.match(sections.training,/Supervisor action notes \(review completion\): Will teach/);assert.match(sections.training,/Outstanding action/);assert.doesNotMatch(sections.training,/successfully|independently|training was completed/i);
});
test('inventory fallback preserves quantities and pending orders; no assumed order or test result',()=>{
 const r={...emptyTrainingReport(),issues:[issue('a',{equipmentRequired:true,equipmentItems:[{name:'Name badge',quantity:2,orderStatus:'Pending'}]})]};
 const sections=fallbackTrainingSections(r);assert.match(sections.inventory,/Suggested yes; confirmation pending/);assert.match(sections.inventory,/Quantity: 2/);assert.match(sections.inventory,/Pending/);assert.doesNotMatch(sections.inventory,/ordered|functioning|tested successfully/);
 r.inventoryRequired='no';assert.match(fallbackTrainingSections(r).inventory,/required: no/);
});
test('AI receives latest entered evidence, excluding manual/generated outputs, names and attachments',async()=>{
 const r={...emptyTrainingReport(),employees:'Private name',attachments:[{id:'a',path:'secret',name:'secret.pdf',type:'application/pdf',category:'Other'}],issues:[issue('a',{observation:'Latest observation',generatedNote:'Old generated content',editedNote:'Hand edit'})]};
 let received;
 const result=await generateTraining(parseTrainingRequest({kind:'training',report:r}),async(data,keys)=>{received=JSON.stringify(data);assert.deepEqual(keys,['incident','training','inventory','additional']);return {incident:'Latest observation',training:'Not documented.',inventory:'Not confirmed.',additional:''};});
 assert.equal(result.source,'ai');assert.match(received,/Latest observation/);assert.doesNotMatch(received,/Hand edit|Old generated|secret|Private name/);
});
test('provider errors and invalid outputs safely fall back; individual notes use current issue',async()=>{
 const input=parseTrainingRequest({kind:'training_issue',issue:issue('a',{observation:'Missing badge',resolution:'Explained ordering steps'})});
 for(const provider of [async()=>{throw Error('offline')},async()=>({note:123})]){const result=await generateTraining(input,provider);assert.equal(result.source,'fallback');assert.match(result.note,/Missing badge/);assert.match(result.note,/Explained ordering steps/);}
 const ai=await generateTraining(input,async()=>({note:'The badge was missing. Ordering instructions were provided.'}));assert.equal(ai.source,'ai');
});
test('training journal recovery keeps reorder/removal, hand edits, sections, evidence and trainers',()=>{
 const user='11111111-1111-4111-8111-111111111111',id='33333333-3333-4333-8333-333333333333';
 const a=issue('a',{editedNote:'Manual A'}),b=issue('b',{editedNote:'Manual B'});
 const data={...emptyTrainingReport(),issues:[b,a],additionalTrainers:'yes',trainerNames:'Trainer One, Trainer Two',sections:{incident:'Manual incident',training:'Manual training',inventory:'Manual inventory',additional:'Manual extra'},editedSections:{incident:true},attachments:[{id:'file',path:`${user}/${id}/file.jpg`,name:'file.jpg',type:'image/jpeg',category:'Corrected issue'}]};
 const report={id,user_id:user,form_type:'Improvement Training Record',status:'draft',title:'',answers:{},oer_data:null,training_data:data,executive_summary:'',created_at:'2026-11-11T12:00:00Z',updated_at:'2026-11-11T12:00:00Z',revision:1};
 const entry={report,token:'latest',expectedRevision:1};assert.deepEqual(parsePendingJournal(JSON.parse(JSON.stringify({[id]:entry})),user),{[id]:entry});
 const newer={...entry,report:{...report,training_data:{...data,issues:[a]}}};const ack=acknowledgePending(newer,'older',{...report,revision:2});assert.deepEqual(ack.report.training_data.issues,[a]);assert.equal(ack.expectedRevision,2);
});
test('AI output cannot infer demonstrated competency, tested equipment or placed orders from selectors',async()=>{
 const r={...emptyTrainingReport(),issues:[issue('a',{trainingStatus:'verified',resolutionStatus:'corrected',equipmentRequired:true,equipmentItems:[{name:'Meter',orderStatus:'Pending'}]})]};
 for(const note of ['The chef independently demonstrated understanding.','The meter was functioning correctly.','The replacement was ordered.','Training was provided.','Calibration reading was 7.23.']){
  const result=await generateTraining({kind:'training_issue',issue:r.issues[0]},async()=>({note}));assert.equal(result.source,'fallback',note);
 }
});
test('CMX1 copy includes incident fields, trainers, manual sections and final/evidence notes',()=>{
 const {trainingText}=require('../.test-build/lib/training.js');
 const text=trainingText({...emptyTrainingReport(),incidentDate:'2026-11-11',employees:'Chef One, Chef Two',additionalTrainers:'yes',trainerNames:'Trainer One',inventoryRequired:'no',evidenceNotes:'See corrected photo',finalNotes:'Follow up next visit',sections:{incident:'Manual incident',training:'Manual training',inventory:'No order required',additional:'Verified process'}});
 for(const value of ['2026-11-11','Chef One, Chef Two','Trainer One','Manual incident','Manual training','See corrected photo','Follow up next visit'])assert.ok(text.includes(value));
});
