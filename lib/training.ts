export const incidentSources=['Health Department Inspection','OER Inspection','Store Visit','Retailer Complaint','Customer Complaint','Follow-Up Training','Other'];
export const resolutionStatuses={open:'Open',corrected:'Corrected Onsite',partial:'Partially Corrected',follow_up:'Follow-Up Required',unable:'Unable to Correct Onsite'};
export const trainingStatuses={not_started:'Not Started',recommended:'Training Recommended',completed:'Training Completed',verified:'Competency Verified'};
export type TrainingIssue={id:string;title:string;observation:string;resolution:string;resolutionStatus:keyof typeof resolutionStatuses;trainingStatus:keyof typeof trainingStatuses;verificationNotes:string;equipmentRequired:boolean;equipmentItems:{name:string;quantity?:number;orderStatus?:string}[];generatedNote?:string;generatedSource?:'ai'|'fallback';editedNote?:string};
export type TrainingAttachment={id:string;path:string;name:string;type:string;category:string};
export type TrainingSections={incident:string;training:string;inventory:string;additional:string};
export type TrainingReport={generatedSource?:'ai'|'fallback';incidentDate:string;employees:string;incidentSource:string;issues:TrainingIssue[];additionalTrainers:''|'yes'|'no';trainerNames:string;inventoryRequired:''|'yes'|'no';inventoryNotes:string;evidenceNotes:string;finalNotes:string;attachments:TrainingAttachment[];sections:TrainingSections;editedSections:Partial<Record<keyof TrainingSections,boolean>>};
export const emptyTrainingIssue=(id:string):TrainingIssue=>({id,title:'',observation:'',resolution:'',resolutionStatus:'open',trainingStatus:'not_started',verificationNotes:'',equipmentRequired:false,equipmentItems:[]});
export const emptyTrainingReport=():TrainingReport=>({incidentDate:'',employees:'',incidentSource:'',issues:[],additionalTrainers:'',trainerNames:'',inventoryRequired:'',inventoryNotes:'',evidenceNotes:'',finalNotes:'',attachments:[],sections:{incident:'',training:'',inventory:'',additional:''},editedSections:{}});
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const str=(v:unknown)=>typeof v==='string'&&v.length<=100000;
export function isTrainingReport(v:unknown):v is TrainingReport {
 if(!obj(v)||v.generatedSource!==undefined&&!['ai','fallback'].includes(String(v.generatedSource))||!['incidentDate','employees','incidentSource','trainerNames','inventoryNotes','evidenceNotes','finalNotes'].every(k=>str(v[k]))||!['','yes','no'].includes(String(v.additionalTrainers))||!['','yes','no'].includes(String(v.inventoryRequired)))return false;
 if(!Array.isArray(v.issues)||!Array.isArray(v.attachments)||!obj(v.sections)||!obj(v.editedSections))return false;
 const ids=new Set<string>();
 return v.issues.every(i=>{if(!obj(i)||!str(i.id)||ids.has(i.id as string))return false;ids.add(i.id as string);return ['title','observation','resolution','verificationNotes'].every(k=>str(i[k]))&&Object.prototype.hasOwnProperty.call(resolutionStatuses,String(i.resolutionStatus))&&Object.prototype.hasOwnProperty.call(trainingStatuses,String(i.trainingStatus))&&typeof i.equipmentRequired==='boolean'&&Array.isArray(i.equipmentItems)&&i.equipmentItems.every(e=>obj(e)&&str(e.name)&&(e.quantity===undefined||typeof e.quantity==='number'&&Number.isFinite(e.quantity)&&e.quantity>0)&&(e.orderStatus===undefined||str(e.orderStatus)))&&(i.generatedSource===undefined||['ai','fallback'].includes(String(i.generatedSource)))&&(i.generatedNote===undefined||str(i.generatedNote))&&(i.editedNote===undefined||str(i.editedNote));})&&v.attachments.every(a=>obj(a)&&['id','path','name','type','category'].every(k=>str(a[k])))&&['incident','training','inventory','additional'].every(k=>str((v.sections as Record<string,unknown>)[k]))&&Object.values(v.editedSections).every(x=>typeof x==='boolean');
}
/** Conservative outage output: quote supplied actions; never reinterpret a plan as completed. */
export function fallbackTrainingSections(r:TrainingReport):TrainingSections {
 const issues=r.issues.filter(i=>i.observation.trim());
 return {
 incident:[r.incidentSource?`Incident source: ${r.incidentSource}.`:'',...issues.map(i=>i.observation.trim())].filter(Boolean).join('\n'),
 training:issues.map(i=>[i.title||'Issue',`Issue status: ${resolutionStatuses[i.resolutionStatus]}. Training status: ${trainingStatuses[i.trainingStatus]}.`,i.resolution?`Supervisor action notes (review completion): ${i.resolution}`:'No corrective action documented.',i.verificationNotes?`Verification recorded: ${i.verificationNotes}`:'',i.resolutionStatus!=='corrected'?'Outstanding action: review and resolve this issue.':''].filter(Boolean).join('\n')).join('\n\n'),
 inventory:[`Equipment / inventory order required: ${r.inventoryRequired|| (issues.some(i=>i.equipmentRequired)?'Suggested yes; confirmation pending':'Not confirmed')}.`,...issues.filter(i=>i.equipmentRequired).flatMap(i=>i.equipmentItems.length?i.equipmentItems.map(e=>`${e.name || 'Item unspecified'}${e.quantity?` · Quantity: ${e.quantity}`:''} · Order status: ${e.orderStatus||'Not confirmed'}`):['Required equipment details pending.']),r.inventoryRequired==='no'&&issues.some(i=>i.equipmentRequired)?'Review required: issue equipment needs conflict with the inventory confirmation.':'',r.inventoryNotes].filter(Boolean).join('\n'),
 additional:[...issues.filter(i=>i.equipmentRequired).flatMap(i=>i.equipmentItems.filter(e=>!/^(received|delivered|complete|completed)$/i.test(e.orderStatus||'')).map(e=>`Equipment still required: ${e.name||'Item unspecified'} · Order status: ${e.orderStatus||'Not confirmed'}`)),...issues.filter(i=>i.trainingStatus==='recommended').map(i=>`Follow-up training recommended: ${i.title||i.observation}`),...issues.filter(i=>i.resolutionStatus!=='corrected').map(i=>`${i.title||i.observation}: ${resolutionStatuses[i.resolutionStatus]}`),...issues.filter(i=>i.verificationNotes).map(i=>`Verification: ${i.verificationNotes}`),r.finalNotes].filter(Boolean).join('\n')
 };
}
export const trainingText=(r:TrainingReport)=>[
 'IMPROVEMENT TRAINING RECORD',
 r.incidentDate?`Incident date: ${r.incidentDate}`:'',
 r.employees?`Chef / Employees: ${r.employees}`:'',
 r.incidentSource?`Incident source: ${r.incidentSource}`:'',
 ...Object.entries({incident:'Describe the Incident in Detail',training:'Describe the Training That Was Provided',inventory:'Equipment and Inventory',additional:'Additional Notes'}).map(([key,label])=>`${label}\n${r.sections[key as keyof TrainingSections]}`),
 `Additional trainers present: ${r.additionalTrainers||'Not confirmed'}`,
 r.additionalTrainers==='yes'?`Name of Others Present: ${r.trainerNames||'Not recorded'}`:'',
 `Inventory / equipment order required: ${r.inventoryRequired||'Not confirmed'}`,
 r.evidenceNotes?`Notes and Extra Documents for the Record: ${r.evidenceNotes}`:'',
 r.finalNotes?`Final Notes: ${r.finalNotes}`:''
].filter(Boolean).join('\n\n');
