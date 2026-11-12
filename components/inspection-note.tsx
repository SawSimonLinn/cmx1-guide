'use client';
import { useEffect, useRef, useState } from 'react';
import { useAssistant } from './ai-assistant';
import { Copy, RotateCcw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { currentGeneratedNote, formatNote, verifiedResolution, type GeneratedNote, type NoteInput, type Resolution } from '@/lib/notes';

type NoteFields = {observationInput?:string;note?:string;generated?:GeneratedNote;resolution?:Resolution};
type Props = {id:string;question:string;answer:string;findings?:string[];baseline:string;generationBaseline?:string;value:NoteFields;negative:boolean;onChange:(patch:Partial<NoteFields>)=>void;onCopy:(text:string)=>void};
export function ResolutionFields({value={},onChange}:{value?:Resolution;onChange:(value:Resolution)=>void}) {
  const patch=(part:Partial<Resolution>)=>onChange({...value,...part});
  const canVerify=!!value.actionTaken?.trim() && !!value.verification && (value.verification!=='Other'||!!value.verificationDetails?.trim());
  return <details className="oer-correction" open={value.status==='Corrected Onsite'&&!verifiedResolution(value)?true:undefined}><summary>Resolution{value.status?` · ${value.status}`:''}</summary>
    <p className="oer-help">Document the action and how you verified the correction before marking it corrected onsite. Training alone does not resolve a food safety issue.</p>
    <label className="oer-field"><span>Action taken</span><textarea className="input-field" value={value.actionTaken||''} onChange={e=>patch({actionTaken:e.target.value})} placeholder="Record only actions actually completed"/></label>
    <label className="oer-field"><span>Verification method</span><select className="input-field" value={value.verification||''} onChange={e=>patch({verification:e.target.value as Resolution['verification'],...(value.training==='Competency Verified'&&e.target.value!=='Chef demonstration'?{training:'Training Completed' as const}:{})})}><option value="">Not verified</option>{['Observed correction','Chef demonstration','Document review','Other'].map(v=><option key={v}>{v}</option>)}</select></label>
    {value.verification==='Other'&&<label className="oer-field"><span>Verification details</span><input className="input-field" value={value.verificationDetails||''} onChange={e=>patch({verificationDetails:e.target.value})}/></label>}
    <div className="oer-grid"><label className="oer-field"><span>Issue status</span><select className="input-field" value={value.status||'Open'} onChange={e=>patch({status:e.target.value as Resolution['status']})}>{['Open','Corrected Onsite','Follow-Up Required','Unable to Correct Onsite'].map(v=><option key={v} disabled={v==='Corrected Onsite'&&!canVerify}>{v}</option>)}</select></label>
    <label className="oer-field"><span>Training status</span><select className="input-field" value={value.training||'Not Started'} onChange={e=>patch({training:e.target.value as Resolution['training']})}>{['Not Started','Training Recommended','Training Completed','Competency Verified'].map(v=><option key={v} disabled={v==='Competency Verified'&&value.verification!=='Chef demonstration'}>{v}</option>)}</select></label></div>
    {value.status==='Corrected Onsite'&&!verifiedResolution(value)&&<p className="error-box" role="alert">Document an action and verification to confirm this correction.</p>}
    <label className="oer-field"><span>Follow-up</span><select className="input-field" value={value.followUpRequired===true?'yes':value.followUpRequired===false?'no':''} onChange={e=>patch({followUpRequired:e.target.value===''?undefined:e.target.value==='yes'})}><option value="">Select follow-up requirement</option><option value="yes">Required</option><option value="no">Not Required</option></select></label>
    {value.followUpRequired&&<label className="oer-field"><span>Follow-up date (optional)</span><input type="date" className="input-field" value={value.followUpDate||''} onChange={e=>patch({followUpDate:e.target.value})}/></label>}
  </details>;
}

export function InspectionNote(props:Props) {
  const {id,question,answer,findings=[],baseline,value,negative,onChange,onCopy}=props;
  const assistant=useAssistant();
  const [preview,setPreview]=useState<GeneratedNote>();
  const [success,setSuccess]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [sourceChanged,setSourceChanged]=useState(false);
  const current=useRef(props);current.current=props;
  const controller=useRef<AbortController|null>(null);
  useEffect(()=>()=>controller.current?.abort(),[]);
  const input=(p:Props):NoteInput=>({question:p.question,answer:p.answer,observation:p.value.observationInput||'',findings:p.findings||[],resolution:p.value.resolution,baseline:p.generationBaseline??p.baseline});
  const source=JSON.stringify(input(props));
  const previousSource=useRef({source,generated:value.generated});
  useEffect(()=>{
    const previous=previousSource.current;
    if(value.generated&&value.generated!==previous.generated)setSourceChanged(false);
    else if(previous.source!==source&&(previous.generated||value.note!==undefined))setSourceChanged(true);
    previousSource.current={source,generated:value.generated};
  },[source,value.generated,value.note]);
  const generate=async()=>{
    if(busy)return;
    const snapshot=JSON.stringify(input(current.current));
    const originalNote=value.note;
    setBusy(true);setError('');setSuccess('');setPreview(undefined);
    const abort=new AbortController();controller.current=abort;
    const timeout=setTimeout(()=>abort.abort(),30000);
    try {
      const client=supabase();
      const {data}=await client!.auth.getSession();
      if(!data.session)throw new Error('Sign in again before generating a note.');
      const response=await fetch('/api/notes',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${data.session.access_token}`},body:snapshot,signal:abort.signal});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||'Note generation is unavailable. Try again.');
      if(JSON.stringify(input(current.current))!==snapshot||current.current.value.note!==originalNote)throw new Error('The inspection changed while generating. Your edits are preserved; generate again to use the latest details.');
      if(originalNote!==undefined)setPreview(result as GeneratedNote);
      else current.current.onChange({generated:result as GeneratedNote,note:undefined});
      setSuccess(originalNote!==undefined?'Suggestion ready. Review before replacing your edited note.':'Note generated.');
    }catch(cause){if(!abort.signal.aborted)setError(cause instanceof Error?cause.message:'Unable to generate a note.');else setError('Generation timed out. Your edits are preserved.');}
    finally{clearTimeout(timeout);setBusy(false);controller.current=null;}
  };
  const generated=value.generated?currentGeneratedNote(value.generated,value.resolution):undefined;
  const text=value.note??(generated?formatNote(generated):baseline);
  return <>
    <button type="button" className="text-action" onClick={()=>assistant?.open({id,input:()=>input(current.current),note:()=>current.current.value.note??(current.current.value.generated?formatNote(currentGeneratedNote(current.current.value.generated,current.current.value.resolution)):current.current.baseline),apply:note=>current.current.onChange({note})})}>AI Assistant</button>
    <label className="oer-field"><span>What did you observe? <small>(optional)</small></span><textarea id={`${id}-observation`} className="input-field observation-input" rows={2} value={value.observationInput||''} onChange={e=>onChange({observationInput:e.target.value})} placeholder="Describe what you saw in your own words."/></label>
    {(negative||value.resolution)&&<ResolutionFields value={value.resolution} onChange={resolution=>onChange({resolution})}/>}
    <section className="note-box" aria-label={`Note for ${question}`}><div className="note-header"><span>{value.note!==undefined?'Edited note':value.generated?(value.generated.source==='fallback'?'Template fallback · review before copying':'AI suggestion · review before copying'):'Inspection note'}</span><button type="button" disabled={busy||(!answer&&!value.observationInput?.trim())} onClick={()=>void generate()}><RotateCcw size={14}/>{busy?'Generating…':value.generated||value.note!==undefined?'Regenerate':'Generate Note'}</button></div>
      {success&&<p role="status">{success}</p>}
      {preview&&<div className="note-preview"><pre>{formatNote(preview)}</pre><button type="button" onClick={()=>{onChange({generated:preview,note:undefined});setPreview(undefined);}}>Use This Note</button><button type="button" onClick={()=>setPreview(undefined)}>Keep my note</button></div>}
      {error&&<p className="error-box" role="alert">{error}</p>}
      {sourceChanged&&<p className="oer-help" role="status">Source details changed. {value.note!==undefined?'Review your edited note against the latest responses.':'The previous suggestion was cleared. Generate a new note from the latest responses.'}</p>}
      <textarea aria-label={`Editable note for ${question}`} rows={Math.max(3,Math.min(10,Math.ceil(text.length/70)))} value={text} onChange={e=>onChange({note:e.target.value})}/>
      <div className="note-actions copy-actions"><button type="button" disabled={!generated?.observation} onClick={()=>onCopy(generated!.observation)}><Copy size={14}/>Copy Observation</button><button type="button" disabled={!generated} onClick={()=>onCopy([generated?.recommendedAction,generated?.completedAction,generated?.followUp].filter(Boolean).join(' '))}><Copy size={14}/>Copy Corrective Action</button><button type="button" disabled={!text} onClick={()=>onCopy(text)}><Copy size={14}/>Copy Full Note</button></div>
      {value.note!==undefined&&<p>Your manual edits are preserved. Check them against the latest responses before copying. Regenerate asks before replacing them.</p>}
    </section>
  </>;
}
