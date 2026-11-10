export type Presence = '' | 'present' | 'absent';
export type OerChoice = '' | 'yes' | 'no' | 'na' | 'unverified' | 'Pass' | 'Fail' | 'Not Determined';
export type CorrectiveAction = {issue?:string; corrected?:string; action?:string; coaching?:string; retraining?:string; followUp?:string; date?:string; assigned?:string; notes?:string};
export type OerAnswer = {answer?:OerChoice; value?:string; findings?:string[]; observations?:string; measurement?:string; evidence?:string; corrective?:CorrectiveAction; generatedNote?:string; note?:string};
export type OerReport = {presence:Presence; answers:Record<number,OerAnswer>; summary?:string; generatedSummary?:string; wrapUp?:string; generatedWrapUp?:string; deepCleaning:{answer?:string; date?:string; evidence?:string; findings?:string; action?:string; note?:string; generatedNote?:string}};
export type OerQuestion = {id:number; label:string; short:string; points:number; options:OerChoice[]; compliant:string; noncompliant:string; findings?:string[]; direct?:boolean; kind?:'text'|'select'; evidence?:boolean; measurement?:boolean};
const yn:OerChoice[]=['yes','no'];
const rows: [string,string,number,string,string][] = [
['Cold finished products','Are cold finished products held below 41°F?',5,'Cold finished products were held below 41°F.','Cold finished products were not held below 41°F.'],
['Finished-product labelling','Are finished products properly labelled in the retail case?',5,'Finished products were properly labelled, with required product and allergen information verified.','Finished-product labelling did not meet requirements.'],
['Product quality','Does the quality of finished products meet Hissho standards?',5,'Finished-product quality met Hissho standards.','Finished-product quality did not meet Hissho standards.'],
['Required documents','Are all required documents onsite, and does the operator know how to access the digital file? Is the terminal synced?',4,'Required documents were onsite, digital access was verified, and the terminal was synced.','Required documents, digital access, or terminal synchronization did not meet requirements.'],
['Handwashing','Does the operator demonstrate proper handwashing, and is the handwashing station correctly equipped?',4,'Proper handwashing was demonstrated and the station was correctly equipped.','Handwashing practices or station supplies did not meet requirements.'],
['Uniform and hygiene','Is the operator wearing the proper uniform and following personal hygiene requirements?',5,'The operator wore the proper uniform and followed personal hygiene requirements.','Uniform or personal hygiene requirements were not met.'],
['Hot bar cooling','Is the proper cooling method used for hot bar ingredients?',5,'Proper cooling methods were used for hot bar ingredients.','Hot bar ingredients were not cooled using the required method.'],
['Ingredient temperatures','Are ingredients held below 41°F in coolers and at 0°F in freezers?',5,'Ingredients met the required cooler and freezer temperature limits.','Ingredient temperatures did not meet the required cooler or freezer limits.'],
['Approved suppliers','Are all products purchased from approved suppliers and/or Hissho?',5,'Products were purchased from approved suppliers and/or Hissho.','Unapproved products were identified.'],
['Thawing','Are proper thawing practices followed?',5,'Proper thawing practices were followed.','Thawing practices did not meet requirements.'],
['Ingredient storage','Are ingredients stored properly to prevent cross-contamination?',4,'Ingredients were stored properly to prevent cross-contamination.','Ingredient storage presented a potential cross-contamination risk.'],
['Utensil storage','Are utensils properly stored?',4,'Utensils were properly stored.','Utensils were not properly stored.'],
['Clean food-contact surfaces','Are food-contact surfaces, equipment, and utensils clean?',4,'Food-contact surfaces, equipment, and utensils were clean.','Food-contact surfaces, equipment, or utensils required cleaning.'],
['Expired ingredients','Are there any expired ingredients?',3,'No expired ingredients were identified.','Expired ingredients were identified.'],
['Personal items and chemicals','Are personal items and chemicals stored away from food and food-contact surfaces?',3,'Personal items and chemicals were stored away from food and food-contact surfaces.','Personal items or chemicals were stored near food or food-contact surfaces.'],
['Thermometer','Does the operator have access to a working, accurate thermometer?',5,'A working, accurate thermometer was available.','A working, accurate thermometer was not available.'],
['pH meter','Does the operator have access to a working, accurate pH meter?',5,'A working, accurate pH meter was available.','A working, accurate pH meter was not available.'],
['Logbooks','Are logbooks complete and accurately filled out?',5,'Logbooks were complete and accurately filled out.','Logbook records were incomplete or inaccurate.'],
['Produce supplier','Where does the chef purchase produce?',0,'',''],
['Three-compartment sinks','Are three-compartment sinks available, properly stocked, and used with correct wash, rinse, and sanitizing procedures?',4,'Three-compartment sinks were available, properly stocked, and used with correct wash, rinse, and sanitizing procedures.','Three-compartment sink availability, supplies, or procedures did not meet requirements.'],
['Sanitizer','Is sanitizer properly used at an acceptable concentration of 200–400 ppm?',5,'Sanitizer was properly used at an acceptable concentration of 200–400 ppm.','Sanitizer use or concentration did not meet requirements.'],
['Product delivery','Are finished products properly cooled and delivered in a well-maintained cooler with sufficient ice blankets?',3,'Finished products were properly cooled and delivered in a well-maintained cooler with sufficient ice blankets.','Product cooling or delivery conditions did not meet requirements.'],
['Customer engagement','Does the operator engage with customers?',3,'The operator engaged with customers.','Customer engagement did not meet expectations.'],
['Planogram','Does the operator follow the planogram, including POP, required varieties, quantities, and retail items?',4,'The planogram, POP, required varieties, quantities, and retail items met requirements.','Planogram, POP, variety, quantity, or retail-item requirements were not met.'],
['Health inspection report','Can the most recent Health Department inspection report be attached?',0,'The most recent Health Department inspection report was reported available for attachment.','The most recent Health Department inspection report was not available for attachment.'],
['Health permit','Can the most recent Health Department permit be attached?',0,'The most recent Health Department permit was reported available for attachment.','The most recent Health Department permit was not available for attachment.'],
['Annual refresher','Has the Person in Charge completed the annual refresher training and quiz?',0,'The Person in Charge completed the annual refresher training and quiz.','The Person in Charge has not completed the annual refresher training and quiz.'],
['Bodily fluid kit','Does the store have an unexpired bodily fluid cleaning kit?',0,'An unexpired bodily fluid cleaning kit was available.','An unexpired bodily fluid cleaning kit was not available.'],
['Store representative','Store representative',0,'',''],
['Operator fined','Operator fined?',0,'An operator fine was recorded.','No operator fine was recorded.']
];
const findingMap:Record<number,string[]>={2:['Incorrect ingredient declaration','Incorrect allergen declaration','Inaccurate net weight','Incorrect expiration date','Missing product label','Other'],9:['Unapproved sauces','Unapproved packaging','Unapproved ingredients','Other'],10:['Improper thawing','Unopened packaging when opening is required','Improper refreezing','Incorrect portioning'],11:['Raw ingredients stored above cooked food','Improper separation','Uncovered ingredients'],12:['Improper knife storage','Improper rice scoop storage','Containers not inverted'],14:['Expired shelf-life stickers','Expired ingredients','Sauces improperly left at room temperature'],15:['Personal drinks near food','Clothing near packaging','Chemicals stored improperly'],18:['Missing records','Incomplete records','Inaccurate entries']};
export const questions:OerQuestion[]=rows.map<OerQuestion>(([short,label,points,compliant,noncompliant],i)=>{const id=i+1;return {id,short,label,points,compliant,noncompliant,options:[...yn,...([1,7,22].includes(id)?['na' as const]:[]),...([4,5,6,7,10,23,27,19].includes(id)?['unverified' as const]:[])],findings:findingMap[id],direct:[4,5,6,7,10,19,23,27].includes(id),kind:[19,29].includes(id)?'text':undefined,evidence:[6,25,26].includes(id),measurement:[1,8,21].includes(id)}}).concat([{id:32,short:'Rating',label:'Rating',points:0,options:['Pass','Fail','Not Determined'],compliant:'',noncompliant:'',kind:'select'}]);
export const categories=['Cross Contamination','Food Safety Policy','Operational Standards','Personal Hygiene','Sanitation','Time & Temp'];
export const emptyReport=():OerReport=>({presence:'',answers:{},deepCleaning:{}});
export const isAnswered=(q:OerQuestion,a?:OerAnswer)=>q.kind==='text'?!!a?.value?.trim()||a?.answer==='unverified':!!a?.answer;
export const isNoncompliant=(q:OerQuestion,a?:OerAnswer)=>q.id<=28&&q.id!==19&&a?.answer===(q.id===14?'yes':'no');
const sentence=(s?:string)=>s?.trim()?s.trim().replace(/[.!?]*$/,'')+'.':'';
export function actionNote(c?:CorrectiveAction):string {if(!c)return '';return [c.issue?`Issue observed: ${sentence(c.issue)}`:'',c.corrected==='yes'?'Corrected during inspection.':c.corrected==='no'?'The issue was not corrected during inspection.':'',c.action?`${c.corrected==='yes'?'Action taken':'Recorded action (completion not confirmed)'}: ${sentence(c.action)}`:'',c.coaching==='yes'?'Coaching was provided.':'',c.retraining==='yes'?'Retraining is required.':'',c.followUp==='yes'?`Follow-up is required${c.date?` by ${c.date}`:''}${c.assigned?`, assigned to ${c.assigned}`:''}.`:'',sentence(c.notes)].filter(Boolean).join(' ')}
export function generateNote(q:OerQuestion,a:OerAnswer|undefined,presence:Presence):string {
 if(!a||!isAnswered(q,a))return '';
 let base='';
 if(a.answer==='unverified')base=presence==='absent'?`The chef was not present during the inspection; ${q.id===19?'produce supplier information could not be verified':`${q.short.toLowerCase()} could not be directly verified`}.`:`${q.short} could not be verified during the inspection.`;
 else if(a.answer==='na')base=`${q.short} was recorded as not applicable.`;
 else if(q.kind==='text')base=`${q.short}: ${sentence(a.value)}`;
 else if(q.id===32)base=`Supervisor rating: ${a.answer}.`;
 else base=isNoncompliant(q,a)?q.noncompliant:q.compliant;
 const finding=isNoncompliant(q,a)?(a.findings||[]).filter(f=>f!=='Other').map(f=>f==='Raw ingredients stored above cooked food'?'Raw ingredients were observed stored above cooked and ready-to-eat products, creating a potential cross-contamination risk.':sentence(f)).join(' '):'';
 return [base,finding,a.value&&q.kind!=='text'?`Details: ${sentence(a.value)}`:'',a.measurement?`Recorded measurement: ${sentence(a.measurement)}`:'',sentence(a.observations),a.evidence?`Evidence reference: ${sentence(a.evidence)}`:'',isNoncompliant(q,a)?actionNote(a.corrective):''].filter(Boolean).join(' ');
}
export const effectiveNote=(q:OerQuestion,a:OerAnswer|undefined,p:Presence)=>a?.note??generateNote(q,a,p);
export const completion=(r:OerReport)=>questions.filter(q=>isAnswered(q,r.answers[q.id])).length;
export function scoreReport(r:OerReport){let earned=0,possible=0;const total=questions.reduce((n,q)=>n+q.points,0);for(const q of questions){const a=r.answers[q.id];if(q.points&&['yes','no'].includes(a?.answer||'')){possible+=q.points;if(!isNoncompliant(q,a))earned+=q.points}}return {earned,possible,total,percentage:possible?Math.round(earned/possible*100):null,provisional:true as const};}
export function generateSummary(r:OerReport):string {
 const compliant=questions.filter(q=>q.points&&['yes','no'].includes(r.answers[q.id]?.answer||'')&&!isNoncompliant(q,r.answers[q.id]));
 const findings=questions.filter(q=>isNoncompliant(q,r.answers[q.id]));
 const actions=findings.map(q=>actionNote(r.answers[q.id]?.corrective)).filter(Boolean);
 return [r.presence==='present'?'The chef was present during the inspection.':r.presence==='absent'?'The chef was not present during the inspection.':'Chef presence has not been recorded.',compliant.length?`Verified compliant areas included ${compliant.map(q=>q.short.toLowerCase()).join(', ')}.`:'',findings.length?`Areas requiring attention included ${findings.map(q=>q.short.toLowerCase()).join(', ')}.`:'',...findings.map(q=>r.answers[q.id]?.findings?.length?`${q.short}: ${r.answers[q.id].findings!.filter(f=>f!=='Other').join(', ')}.`:''),...actions,r.deepCleaning.answer==='yes'?`The location underwent deep cleaning during the audit${r.deepCleaning.date?` (recorded date: ${r.deepCleaning.date})`:''}.`:r.deepCleaning.answer==='no'?'The location did not undergo deep cleaning during the audit.':'Deep cleaning during the audit has not been confirmed.',sentence(r.deepCleaning.findings),r.deepCleaning.action?`Deep-cleaning action recorded: ${sentence(r.deepCleaning.action)}`:'',completion(r)<questions.length?'The review is incomplete; unanswered and unverified items are not evidence of compliance.':Object.values(r.answers).some(a=>a.answer==='unverified')?'Some items could not be verified and are not evidence of compliance.':''].filter(Boolean).join(' ');
}
export function generateWrapUp(r:OerReport):string {
 const inspected=questions.filter(q=>q.id<=28&&isAnswered(q,r.answers[q.id]));
 const findings=inspected.filter(q=>isNoncompliant(q,r.answers[q.id]));
 const unverified=inspected.filter(q=>r.answers[q.id]?.answer==='unverified');
 return [r.presence==='present'?'The chef was present during the inspection.':r.presence==='absent'?'The chef was not present during the inspection.':'Chef presence has not been recorded.',
 `${inspected.length} of 28 inspection questions have recorded responses.`,
 findings.length?`Areas requiring attention: ${findings.map(q=>q.short.toLowerCase()).join(', ')}.`:inspected.length?'No noncompliant responses have been recorded in the answered inspection questions.':'No inspection findings have been recorded.',
 ...findings.map(q=>{const action=actionNote(r.answers[q.id]?.corrective);return action?`${q.short}: ${action}`:''}),
 unverified.length?`Unable to verify: ${unverified.map(q=>q.short.toLowerCase()).join(', ')}.`:'',
 ...questions.filter(q=>[29,30,32].includes(q.id)).map(q=>generateNote(q,r.answers[q.id],r.presence))
 ].filter(Boolean).join(' ');
}
export function generateDeepCleaningNote(r:OerReport):string {
 const d=r.deepCleaning;
 const cleaningFindings=questions.filter(q=>[12,13,15,20,21].includes(q.id)&&isNoncompliant(q,r.answers[q.id]));
 return [d.answer==='yes'?'The location underwent deep cleaning during the audit.':d.answer==='no'?'The location did not undergo deep cleaning during the audit.':'Deep cleaning during the audit has not been confirmed.',
 d.date?`Recorded deep-cleaning date: ${d.date}.`:'',
 cleaningFindings.length?`Inspection findings requiring cleaning or sanitation attention included ${cleaningFindings.map(q=>q.short.toLowerCase()).join(', ')}.`:'',
 ...cleaningFindings.map(q=>{const a=r.answers[q.id];return [a.findings?.filter(f=>f!=='Other').map(sentence).join(' '),sentence(a.observations),actionNote(a.corrective)].filter(Boolean).join(' ')}),
 sentence(d.findings),d.action?`Deep-cleaning action recorded: ${sentence(d.action)}`:'',d.evidence?`Evidence reference: ${sentence(d.evidence)}`:''
 ].filter(Boolean).join(' ');
}
export function fullReport(r:OerReport):string {
 return ['OPERATIONAL EXCELLENCE REVIEW',`EXECUTIVE SUMMARY\n${r.summary??generateSummary(r)}`,
 ...questions.map(q=>{const note=effectiveNote(q,r.answers[q.id],r.presence);return note?`${q.id}. ${q.label}\n${note}`:''}),
 `WRAP-UP\n${r.wrapUp??generateWrapUp(r)}`,`DEEP CLEANING\n${r.deepCleaning.note??generateDeepCleaningNote(r)}`].filter(Boolean).join('\n\n');
}
export function prepareReport(r:OerReport):OerReport{return {...r,generatedSummary:generateSummary(r),generatedWrapUp:generateWrapUp(r),deepCleaning:{...r.deepCleaning,generatedNote:generateDeepCleaningNote(r)},answers:Object.fromEntries(questions.filter(q=>r.answers[q.id]).map(q=>[q.id,{...r.answers[q.id],generatedNote:generateNote(q,r.answers[q.id],r.presence)}]))}}
