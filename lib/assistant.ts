import { parseNoteInput, type NoteInput } from './notes';
export type AssistantContext={reportType:string;items:{id:string;input:NoteInput;note:string}[];summary:string};
export function parseAssistantContext(value:unknown):AssistantContext {
  const v=value as AssistantContext;
  if(!v||typeof v.reportType!=='string'||v.reportType.length>100||!Array.isArray(v.items)||v.items.length>100||typeof v.summary!=='string'||v.summary.length>10000)throw new Error('Invalid report context.');
  return {reportType:v.reportType,summary:v.summary,items:v.items.map(i=>{if(typeof i.id!=='string'||i.id.length>100||typeof i.note!=='string'||i.note.length>6000)throw new Error('Invalid question context.');return {id:i.id,input:parseNoteInput(i.input),note:i.note};})};
}
