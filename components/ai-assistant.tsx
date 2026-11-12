'use client';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { type NoteInput } from '@/lib/notes';
import { questions as storeQuestions } from '@/lib/questions';
import { questions as oerQuestions } from '@/lib/oer';
import type { FieldReport } from './report-journal';
import type { AssistantContext } from '@/lib/assistant';
type Target={id:string;input:()=>NoteInput;note:()=>string;apply:(text:string)=>void};
const Assistant=createContext<{open:(target?:Target)=>void}|null>(null);
export const useAssistant=()=>useContext(Assistant);
type Message={role:string;content:string;note?:string;source?:string};
export function AssistantProvider({report,onSummary,children}:{report?:FieldReport;onSummary:(text:string)=>void;children:React.ReactNode}){
  const [opened,setOpened]=useState(false),[target,setTarget]=useState<Target>(),[mode,setMode]=useState<'question'|'report'>('report');
  const [messages,setMessages]=useState<Message[]>([]),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState('');
  const dialog=useRef<HTMLDialogElement>(null),inputRef=useRef<HTMLTextAreaElement>(null),scroll=useRef<HTMLDivElement>(null);
  const request=useRef<AbortController|null>(null);
  const questionId=mode==='question'?target?.id:undefined;
  const scope=`${report?.id||'global'}:${questionId||'report'}`;
  const currentScope=useRef(scope);currentScope.current=scope;
  useEffect(()=>{setOpened(false);setTarget(undefined);request.current?.abort();},[report?.id]);
  useEffect(()=>{if(opened){dialog.current?.showModal();inputRef.current?.focus();}else dialog.current?.close();},[opened]);
  useEffect(()=>{if(!opened)return;let disposed=false;setMessages([]);setError('');setStatus('');setBusy(true);
    request.current?.abort();
    void (async()=>{const db=supabase();const result=await db!.from('ai_messages').select('role,content,note,source').eq('scope',scope).order('created_at',{ascending:false}).limit(100);if(disposed)return;if(result.error)setError('Unable to load history. Apply the AI conversations migration.');else setMessages((result.data||[]).reverse());setBusy(false);})();
    return()=>{disposed=true;request.current?.abort();};
  },[opened,scope]);
  useEffect(()=>{scroll.current?.scrollTo({top:scroll.current.scrollHeight,behavior:'smooth'});},[messages,busy]);
  const context=():AssistantContext=>{
    if(mode==='question'&&target)return {reportType:report?.form_type||'Inspection',items:[{id:target.id,input:target.input(),note:target.note()}],summary:''};
    const answers=report?.form_type==='Store Visit'?report.answers:report?.oer_data?.answers;
    const qs=report?.form_type==='Store Visit'?storeQuestions:oerQuestions;
    const items=Object.entries(answers||{}).filter(([id])=>!(report?.form_type==='Operational Excellence Review'&&id==='29')).map(([id,a])=>({id,input:{question:qs.find(q=>String(q.id)===id)?.label||'Inspection item',answer:a.answer||a.value||'',observation:a.observationInput||'',findings:('findings' in a?a.findings:undefined)||a.selectedFindings||[],resolution:a.resolution},note:a.note||a.generated?.observation||''}));
    // Exclude identities, attachment URLs and account/store metadata.
    const training=report?.training_data;
    return {reportType:report?.form_type||'General writing assistance',items,summary:training?JSON.stringify({sections:training.sections,issues:training.issues.map(i=>({title:i.title,observation:i.observation,resolutionStatus:i.resolutionStatus,verificationNotes:i.verificationNotes}))}):report?.executive_summary||''};
  };
  const send=async(text=message)=>{
    if(busy||!text.trim())return;const snapshotScope=scope;setBusy(true);setError('');setStatus('');
    const abort=new AbortController();request.current=abort;
    try{const db=supabase();const {data}=await db!.auth.getSession();if(!data.session)throw new Error('Sign in again.');
      const response=await fetch('/api/assistant',{method:'POST',signal:AbortSignal.any([abort.signal,AbortSignal.timeout(30000)]),headers:{'Content-Type':'application/json',Authorization:`Bearer ${data.session.access_token}`},body:JSON.stringify({reportId:report?.id,questionId,scope,message:text,context:context()})});const result=await response.json();if(!response.ok)throw new Error(result.error||'Unable to send message.');
      if(currentScope.current!==snapshotScope)return;setMessages(m=>[...m,{role:'user',content:text},{role:'assistant',content:result.reply,note:result.note,source:result.source}]);setMessage('');
    }catch(e){if(!abort.signal.aborted)setError(e instanceof Error?e.message:'Assistant unavailable.');}finally{if(currentScope.current===snapshotScope)setBusy(false);}
  };
  const clear=async()=>{if(!window.confirm('Clear this conversation?'))return;setBusy(true);const result=await supabase()!.from('ai_messages').delete().eq('scope',scope);if(result.error)setError('Unable to clear conversation.');else setMessages([]);setBusy(false);};
  const open=(t?:Target)=>{setTarget(t);setMode(t?'question':'report');setOpened(true);};
  return <Assistant.Provider value={{open}}>{children}<dialog ref={dialog} className="ai-dialog" onCancel={()=>setOpened(false)} onClose={()=>setOpened(false)} onKeyDown={e=>{if(e.key==='Tab'){const nodes=dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),textarea,select');if(!nodes?.length)return;const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}} aria-labelledby="ai-title">
    <header><h2 id="ai-title">AI Assistant</h2><button className="icon-button" aria-label="Close AI Assistant" onClick={()=>setOpened(false)}><X size={20}/></button></header>
    <div className="ai-context"><p>{report?.form_type||'Field operations writing assistant'}</p><select aria-label="Assistant scope" value={mode} onChange={e=>setMode(e.target.value as typeof mode)}><option value="question" disabled={!target}>Current Question</option><option value="report">Entire Report</option></select><button disabled={busy} onClick={()=>void clear()}>Clear conversation</button></div>
    <div className="ai-messages" ref={scroll} aria-live="polite">{!messages.length&&<p>Ask for a professional note, a shorter description, or help explaining corrective actions. Suggestions are applied only when you choose.</p>}{messages.map((m,i)=><article key={i} className={`ai-message ${m.role}`}><small>{m.role==='user'?'You':m.source==='fallback'?'Template fallback':'AI Assistant'}</small><p>{m.content}</p>{m.note&&<><pre>{m.note}</pre><div className="note-actions"><button onClick={()=>{if(mode==='question'&&target){target.apply(m.note!);setStatus('Note applied. Autosave will save your change.');}else if(report&&report.form_type!=='Improvement Training Record'){onSummary(m.note!);setStatus('Summary applied. Autosave will save your change.');}}} disabled={!report||(mode!=='question'&&report.form_type==='Improvement Training Record')}>{mode==='question'?'Use This Note':'Use as Summary'}</button><button onClick={()=>void navigator.clipboard.writeText(m.note!).then(()=>setStatus('Copied.')).catch(()=>setError('Clipboard unavailable. Select and copy the suggestion.'))}>Copy</button><button disabled={busy} onClick={()=>void send([...messages.slice(0,i)].reverse().find(x=>x.role==='user')?.content||'Generate another version.')}>Try Again</button></div></>}</article>)}{busy&&<p role="status">Working…</p>}</div>
    <form className="ai-input" onSubmit={e=>{e.preventDefault();void send();}}>{mode==='question'&&target&&<p className="ai-question">{target.input().question}</p>}{error&&<p className="error-box" role="alert">{error}</p>}{status&&<p role="status">{status}</p>}<textarea ref={inputRef} className="input-field" aria-label="Message AI Assistant" maxLength={4000} rows={3} value={message} onChange={e=>setMessage(e.target.value)} placeholder="Make this more professional…"/><button className="primary" disabled={busy||!message.trim()}>Send</button></form>
  </dialog></Assistant.Provider>;
}
export function AssistantButton(){const assistant=useAssistant();return <button type="button" className="text-action" onClick={()=>assistant?.open()}>AI Assistant</button>;}
