/** Shared inspection-only contract. Never include account, store, or contact identifiers. */
export type Resolution = {
  status?: 'Open' | 'Corrected Onsite' | 'Follow-Up Required' | 'Unable to Correct Onsite';
  actionTaken?: string;
  training?: 'Not Started' | 'Training Recommended' | 'Training Completed' | 'Competency Verified';
  verification?: 'Observed correction' | 'Chef demonstration' | 'Document review' | 'Other';
  verificationDetails?: string;
  followUpRequired?: boolean;
  followUpDate?: string;
};
export type NoteInput = {question:string;answer:string;observation:string;findings:string[];resolution?:Resolution;baseline?:string};
export type GeneratedNote = {observation:string;recommendedAction:string;completedAction:string;followUp:string;confidence:string;source:'ai'|'fallback'};
export const resolutionStatuses = ['Open','Corrected Onsite','Follow-Up Required','Unable to Correct Onsite'] as const;
export const trainingStatuses = ['Not Started','Training Recommended','Training Completed','Competency Verified'] as const;
export const verificationMethods = ['Observed correction','Chef demonstration','Document review','Other'] as const;
export function verifiedResolution(r?:Resolution):boolean {
  return r?.status === 'Corrected Onsite' && Boolean(r.actionTaken?.trim()) && Boolean(r.verification) && (r.verification !== 'Other' || Boolean(r.verificationDetails?.trim()));
}
export function resolutionErrors(r?:Resolution):string[] {
  if (!r) return [];
  const errors:string[]=[];
  if(r.status==='Corrected Onsite' && !verifiedResolution(r)) errors.push('Corrected Onsite requires a documented action and verification of the correction.');
  if(r.training==='Competency Verified' && r.verification!=='Chef demonstration') errors.push('Competency verification requires an independent chef demonstration.');
  return errors;
}
const sentence = (s:string) => s.trim() ? s.trim().replace(/[.!?]+$/,'') + '.' : '';
export function completedAction(r?:Resolution):string {
  if(!r) return '';
  return [verifiedResolution(r)?`Verified onsite correction: ${sentence(r.actionTaken!)}`:r.actionTaken?.trim()?`Recorded action; issue resolution not verified: ${sentence(r.actionTaken)}`:'',
    r.training==='Training Completed'?'Training was confirmed completed; competency has not been independently verified.':'',
    r.training==='Competency Verified'&&r.verification==='Chef demonstration'?'Training was confirmed completed and the chef independently demonstrated the procedure.':'',
  ].filter(Boolean).join(' ');
}
export function followUpNote(r?:Resolution):string {
  return r?.followUpRequired || r?.status==='Follow-Up Required' ? `Follow-up is required${r.followUpDate?` by ${r.followUpDate}`:''}.` : r?.status==='Unable to Correct Onsite'?'The issue could not be corrected onsite; arrange follow-up.':'';
}
/** Completion claims always reflect current verified fields, never a previous generation snapshot. */
export function currentGeneratedNote(n:GeneratedNote,resolution?:Resolution):GeneratedNote {
  return {...n,completedAction:completedAction(resolution),followUp:followUpNote(resolution)};
}
export function formatNote(n:GeneratedNote):string {
  const action=n.completedAction.replace(/^Verified onsite correction:\s*/,'').replace(/^Recorded action; issue resolution not verified:\s*/,'Recorded action, with resolution unverified: ');
  return [n.observation,action,n.followUp].filter(Boolean).join('\n');
}
/** Conservative local fallback: supplied observation takes precedence over generic question text. */
export function fallbackNote(input:NoteInput):GeneratedNote {
  const raw=input.observation.trim();
  const context=(raw || input.findings.join(' ')).toLowerCase();
  const actor=/\bfz\b|franchisee/i.test(raw)?'FZ':'chef';
  let observation=raw?sentence(raw):input.findings.length?input.findings.map(sentence).join(' '):sentence(input.baseline||`${input.question}: ${input.answer || 'response not recorded'}`);
  let recommendedAction=raw||input.findings.length?'Review the observed issue with the '+actor+', follow the approved Hissho process, and verify the corrective action.':'';
  if(/name\s*badge/.test(context)&&/doesn.?t|does not|no |missing|not |without|lack/.test(context)) {
    observation=`The ${actor} was not wearing the required name badge during the inspection.`;
    recommendedAction=`Review the uniform requirements with the ${actor} and provide guidance on ordering the required name badge. Verify compliance during the next visit.`;
  } else if(/thermometer/.test(context)&&/calibrat/.test(context)&&/doesn.?t know|does not know|unable|cannot|can.t|not know/.test(context)) {
    observation=`The ${actor} was unable to demonstrate the proper thermometer calibration procedure.`;
    recommendedAction=`Provide hands-on training on thermometer calibration using the approved Hissho training process, and have the ${actor} repeat the procedure independently to verify understanding.`;
  } else if(/ph\s*meter/.test(context)&&/calibrat/.test(context)&&/doesn.?t know|does not know|unable|cannot|can.t|not know/.test(context)) {
    observation=`The ${actor} was unable to demonstrate the proper pH meter calibration procedure.`;
    recommendedAction=`Retrain the ${actor} on the approved Hissho pH meter calibration procedure and verify understanding through an independent demonstration.`;
  } else if(/shelf.?life|label/.test(context)&&/didn.?t|did not|missing|without|improper|not |no /.test(context)) {
    // Do not add scope, quantities, or ingredients that were not supplied.
    observation=/ingredient/.test(context)&&/shelf.?life/.test(context)?'Ingredients did not have the required shelf-life labels.':raw?sentence(raw):observation;
    recommendedAction=`Review the applicable labelling requirements with the ${actor} and correct missing or incorrect labels following approved procedures. Verify the labels against the available records; do not invent dates.`;
  } else if(/raw/.test(context)&&/above|over/.test(context)&&/vegetable|ready.to.eat|cooked/.test(context)) {
    observation=sentence(raw||input.findings.join('; '))+' This presents a potential cross-contamination risk.';
    recommendedAction=`Reorganise ingredients to maintain proper separation between raw and ready-to-eat foods. Review approved storage procedures with the ${actor} and verify correct placement.`;
  } else if(/logbook|temperature log|log book/.test(context)&&/forgot|incomplete|missing|not |didn.?t/.test(context)) {
    observation=/temperature/.test(context)?'The required temperature logbook was incomplete at the time of inspection.':'The required logbook was incomplete at the time of inspection.';
    recommendedAction=`Review daily documentation requirements with the ${actor} and verify that future entries are completed accurately and on time. Do not backfill or invent historical readings.`;
  }
  if(!raw && !input.findings.length && !['no','Fail'].includes(input.answer)) recommendedAction='';
  return {observation,recommendedAction,completedAction:completedAction(input.resolution),followUp:followUpNote(input.resolution),confidence:'Review required',source:'fallback'};
}

function object(value:unknown):value is Record<string,unknown> {return Boolean(value)&&typeof value==='object'&&!Array.isArray(value)}
function text(value:unknown,max:number,required=false):string {
  if(value===undefined&&!required)return '';
  if(typeof value!=='string'||value.length>max||(required&&!value.trim()))throw new Error('Invalid inspection text.');
  return value.trim();
}
export function parseNoteInput(value:unknown):NoteInput {
  if(!object(value))throw new Error('Expected inspection data.');
  const findings=value.findings??[];
  if(!Array.isArray(findings)||findings.length>25)throw new Error('Invalid findings.');
  const input:NoteInput={question:text(value.question,1000,true),answer:text(value.answer,100),observation:text(value.observation,4000),findings:findings.map(f=>text(f,500)),baseline:text(value.baseline,2500)};
  if(value.resolution!==undefined) {
    if(!object(value.resolution))throw new Error('Invalid resolution.');
    const r=value.resolution;
    const enums:Record<string,readonly string[]>={status:resolutionStatuses,training:trainingStatuses,verification:verificationMethods};
    for(const [key,options] of Object.entries(enums))if(r[key]!==undefined&&r[key]!==''&&!options.includes(String(r[key])))throw new Error(`Invalid ${key}.`);
    if(r.followUpRequired!==undefined&&typeof r.followUpRequired!=='boolean')throw new Error('Invalid follow-up.');
    const date=text(r.followUpDate,10);
    if(date && (!/^\d{4}-\d{2}-\d{2}$/.test(date)||new Date(date).toISOString().slice(0,10)!==date))throw new Error('Invalid follow-up date.');
    input.resolution={status:r.status? r.status as Resolution['status']:undefined,training:r.training?r.training as Resolution['training']:undefined,verification:r.verification?r.verification as Resolution['verification']:undefined,actionTaken:text(r.actionTaken,2000),verificationDetails:text(r.verificationDetails,1000),followUpRequired:r.followUpRequired as boolean|undefined,followUpDate:date||undefined};
    const errors=resolutionErrors(input.resolution);if(errors.length)throw new Error(errors.join(' '));
  }
  return input;
}
export function parseGeneratedNote(value:unknown):Omit<GeneratedNote,'source'> {
  if(!object(value))throw new Error('Invalid generated note.');
  return {observation:text(value.observation,4000,true),recommendedAction:text(value.recommendedAction,4000),completedAction:text(value.completedAction,4000),followUp:text(value.followUp,1000),confidence:text(value.confidence,100,true)};
}
