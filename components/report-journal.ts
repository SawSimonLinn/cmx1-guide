import type { Answers } from '../lib/questions';
import { isTrainingReport, type TrainingReport } from '../lib/training';
import type { OerReport } from '../lib/oer';
export type FieldReport = {
  id: string; user_id: string; form_type: string; title: string; status: 'draft' | 'completed';
  training_data?: TrainingReport | null; answers: Answers; oer_data: OerReport | null; executive_summary: string;
  created_at: string; updated_at: string; revision: number; completed_at?: string | null;
};
export type PendingReport = {report:FieldReport;token:string;expectedRevision:number;conflict?:boolean};
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const text=(value:unknown,max=100000)=>value===undefined||typeof value==='string'&&value.length<=max;
function responses(value:unknown):boolean {
  return object(value)&&Object.entries(value).every(([key,a])=>/^\d+$/.test(key)&&object(a)&&
    Object.entries(a).every(([field,v])=>{
      if(['findings','selectedFindings'].includes(field))return Array.isArray(v)&&v.length<=100&&v.every(s=>typeof s==='string'&&s.length<=10000);
      if(['resolution','corrective','generated'].includes(field))return object(v)&&Object.values(v).every(s=>s===null||['string','boolean','undefined'].includes(typeof s));
      return text(v);
    }));
}
/** Ignore malformed or differently owned local entries rather than opening untrusted browser data. */
export function parsePendingJournal(value:unknown,userId:string):Record<string,PendingReport> {
  const result:Record<string,PendingReport>={};
  if(!object(value))return result;
  for(const [id,entry] of Object.entries(value)) {
    if(!/^[a-f\d-]{36}$/i.test(id)||!object(entry)||!object(entry.report))continue;
    const r=entry.report;
    if(r.id!==id||r.user_id!==userId||!['Store Visit','Operational Excellence Review','Improvement Training Record'].includes(String(r.form_type))||!['draft','completed'].includes(String(r.status)))continue;
    if(!text(r.title,160)||!text(r.executive_summary)||!responses(r.answers)||!Number.isInteger(entry.expectedRevision)||Number(entry.expectedRevision)<0||typeof entry.token!=='string'||entry.token.length>100)continue;
    if(typeof r.created_at!=='string'||!Number.isFinite(Date.parse(r.created_at))||typeof r.updated_at!=='string'||!Number.isFinite(Date.parse(r.updated_at)))continue;
    if(r.form_type==='Operational Excellence Review'&&(!object(r.oer_data)||!['','present','absent'].includes(String(r.oer_data.presence))||!responses(r.oer_data.answers)||!object(r.oer_data.deepCleaning)))continue;
    if(r.form_type==='Improvement Training Record'&&!isTrainingReport(r.training_data))continue;
    result[id]=entry as unknown as PendingReport;
  }
  return result;
}
/** A server ACK for an older snapshot must never replace a newer local edit. */
export function acknowledgePending(current:PendingReport|undefined,snapshotToken:string,saved:FieldReport):PendingReport|undefined {
  if(!current||current.token===snapshotToken)return undefined;
  return {...current,expectedRevision:saved.revision,report:{...current.report,revision:saved.revision,created_at:saved.created_at}};
}
