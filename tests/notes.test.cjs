const {test}=require('node:test');
const assert=require('node:assert/strict');
const notes=require('../.test-build/lib/notes.js');
const provider=require('../.test-build/lib/server/note-provider.js');
const oer=require('../.test-build/lib/oer.js');
const visit=require('../.test-build/lib/questions.js');
const input=observation=>({question:'Inspection finding',answer:'no',observation,findings:[]});
test('fallback responds to actual observation across six daily scenarios',()=>{
 const cases=[['Franchisee doesn\'t have name badge.',/FZ.*name badge/,/ordering/],["Chef doesn't know how to calibrate thermometer.",/thermometer calibration/,/hands-on training/],["Chef doesn't know how to calibrate pH meter.",/pH meter calibration/,/approved Hissho/],["Chef didn't put proper shelf life labels on ingredients.",/labels/,/labelling/],['Raw salmon was stored above vegetables.',/cross-contamination/,/separation/],['Chef forgot to complete temperature logbook.',/temperature logbook/,/Do not backfill/]];
 for(const [raw,observation,action]of cases){const n=notes.fallbackNote(input(raw));assert.match(n.observation,observation);assert.match(n.recommendedAction,action);assert.equal(n.completedAction,'');assert.equal(n.source,'fallback');}
 assert.notEqual(notes.fallbackNote(input(cases[0][0])).observation,notes.fallbackNote(input(cases[1][0])).observation);
});
test('arbitrary observation is preserved instead of replaced by question template',()=>{
 const n=notes.fallbackNote({...input('Loose handle on the rice warmer'),baseline:'All equipment satisfactory.'});
 assert.equal(n.observation,'Loose handle on the rice warmer.');assert.doesNotMatch(n.observation,/satisfactory/);
});
test('resolution demands actual action and verification; training alone does not resolve issue',()=>{
 for(const r of [{status:'Corrected Onsite'},{status:'Corrected Onsite',training:'Training Completed'},{status:'Corrected Onsite',actionTaken:'Reviewed training'},{status:'Corrected Onsite',actionTaken:'Storage reorganised',verification:'Other'}]){assert.equal(notes.verifiedResolution(r),false);assert.ok(notes.resolutionErrors(r).length);assert.doesNotMatch(notes.completedAction(r),/Verified onsite correction/);}
 const r={status:'Corrected Onsite',actionTaken:'Raw salmon relocated below vegetables',verification:'Observed correction',training:'Competency Verified'};
 assert.equal(notes.verifiedResolution(r),true);assert.ok(notes.resolutionErrors(r).length);r.training='Training Completed';assert.equal(notes.resolutionErrors(r).length,0);assert.match(notes.completedAction(r),/Verified onsite correction/);
});
test('competency requires independently confirmed demonstration, recommendations stay proposed',()=>{
 assert.equal(notes.completedAction({training:'Training Recommended'}),'');
 assert.doesNotMatch(notes.completedAction({training:'Competency Verified'}),/independently demonstrated/);
 assert.match(notes.completedAction({training:'Competency Verified',verification:'Chef demonstration'}),/independently demonstrated/);
 assert.match(notes.followUpNote({followUpRequired:true,followUpDate:'2026-11-20'}),/2026-11-20/);
});
test('runtime validation rejects malformed payloads, invalid dates and invalid resolved claims',()=>{
 for(const data of [null,[],{...input('x'),findings:'bad'},{...input('x'),observation:'x'.repeat(4001)},{...input('x'),resolution:{status:'Done'}},{...input('x'),resolution:{followUpDate:'2026-02-31'}},{...input('x'),resolution:{status:'Corrected Onsite'}}])assert.throws(()=>notes.parseNoteInput(data));
 assert.deepEqual(notes.parseNoteInput(input('name badge missing')).findings,[]);
 assert.throws(()=>notes.parseGeneratedNote({observation:'only one field'}));
});
test('minimal provider context omits identifiers, resolution narrative and redundant baseline',()=>{
 const data=provider.minimalInput({...input('Chef contacted person@example.com at (206) 555-0188'),baseline:'Store 123 contact secret',resolution:{actionTaken:'Called Simon 2065550188',followUpDate:'2026-11-20'},user_id:'secret',store:'secret'});
 assert.doesNotMatch(JSON.stringify(data),/person@example|555|Simon|secret|2026-11/);assert.equal(data.baseline,undefined);assert.equal(data.resolution,undefined);
});
test('provider outages and malformed/ungrounded AI notes get labelled fallback',async()=>{
 const data=input('Raw salmon stored above vegetables');
 const fails={generate:async()=>{throw new Error('timeout')}};
 assert.equal((await provider.generateInspectionNote(data,fails)).source,'fallback');
 const invents={generate:async()=>({observation:'Salmon measured 52°F.',recommendedAction:'Training was completed.',completedAction:'Resolved.',followUp:'',confidence:'high'})};
 assert.equal((await provider.generateInspectionNote(data,invents)).source,'fallback');
});
test('AI receives latest observations and cannot supply completed actions or followup dates',async()=>{
 const received=[];
 const fake={generate:async i=>{received.push(i.observation);return {observation:i.observation,recommendedAction:'Review approved procedures.',completedAction:'Training was completed.',followUp:'Follow-up on 2099-01-01.',confidence:'high'}}};
 const a=await provider.generateInspectionNote(input('Name badge missing'),fake);
 const b=await provider.generateInspectionNote(input('Thermometer unavailable'),fake);
 assert.notEqual(a.observation,b.observation);assert.deepEqual(received,['Name badge missing','Thermometer unavailable']);assert.equal(a.completedAction,'');assert.equal(a.followUp,'');assert.equal(a.source,'ai');
});
test('edited and intentionally blank notes survive answer changes and JSON round trips',()=>{
 const q=visit.questions[0];const data={answer:'no',note:'My manual wording',observationInput:'new observation'};
 assert.equal(visit.effectiveNote(q,JSON.parse(JSON.stringify(data))),'My manual wording');data.note='';assert.equal(visit.effectiveNote(q,data),'');
 const r=oer.emptyReport();r.presence='present';r.answers[6]={answer:'no',note:'Manual OER edit',resolution:{status:'Open',training:'Training Recommended'}};assert.match(oer.fullReport(oer.prepareReport(r)),/Manual OER edit/);
});
test('executive summary never infers resolution from legacy corrected flag or training',()=>{
 const r=oer.emptyReport();r.answers[11]={answer:'no',corrective:{corrected:'yes',action:'Reviewed storage'},resolution:{status:'Open',training:'Training Completed',actionTaken:'Reviewed storage'}};
 assert.doesNotMatch(oer.generateSummary(r),/Corrected during inspection|Verified onsite correction/);
 r.answers[11].resolution={status:'Corrected Onsite',actionTaken:'Salmon relocated',verification:'Observed correction'};
 assert.match(oer.generateSummary(r),/Verified onsite correction: Salmon relocated/);
});
test('persisted generation cannot retain an old verified correction when resolution changes',()=>{
 const generated={observation:'Missing badge.',recommendedAction:'Review uniform requirements.',completedAction:'Verified onsite correction: Replacement supplied.',followUp:'Follow-up by 2099-01-01.',confidence:'Review required',source:'fallback'};
 const a={answer:'no',generated,resolution:{status:'Open',training:'Training Recommended'}};
 assert.doesNotMatch(visit.effectiveNote(visit.questions[7],a),/Verified onsite correction|2099/);
 assert.doesNotMatch(oer.effectiveNote(oer.questions[5],a,'present'),/Verified onsite correction|2099/);
 a.note='Manual supervisor note';assert.equal(visit.effectiveNote(visit.questions[7],a),'Manual supervisor note');
});
test('Store summary/full report include observations and current actions without generating first',()=>{
 const q=visit.questions[7];const a={answer:'no',observationInput:'Missing name badge',resolution:{status:'Corrected Onsite',actionTaken:'Replacement badge supplied',verification:'Observed correction'}};
 assert.match(visit.effectiveNote(q,a),/name badge/);assert.match(visit.effectiveNote(q,a),/Verified onsite correction: Replacement badge supplied/);assert.match(visit.fullReport({8:a}),/Replacement badge/);
});
