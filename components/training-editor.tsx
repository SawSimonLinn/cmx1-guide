'use client';
import { useAssistant } from './ai-assistant';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { emptyTrainingIssue, incidentSources, resolutionStatuses, trainingStatuses, trainingText, type TrainingAttachment, type TrainingIssue, type TrainingReport, type TrainingSections } from '@/lib/training';

type Props={report:TrainingReport;onChange:(report:TrainingReport)=>void;onComplete:()=>void;onCopy:(text:string)=>void;userId:string;reportId:string};
const db=supabase();
const sectionLabels:Record<keyof TrainingSections,string>={incident:'Describe the Incident in Detail',training:'Describe the Training That Was Provided',inventory:'Equipment and Inventory',additional:'Additional Notes'};
const categories=['Original issue','Corrected issue','Equipment','Inspection document','Other supporting evidence'];
function TextField({label,value,onChange,multiline=false,type='text',placeholder}:{label:string;value:string;onChange:(v:string)=>void;multiline?:boolean;type?:string;placeholder?:string}){
 return <label className="oer-field training-field"><span>{label}</span>{multiline?<textarea aria-label={label} className="input-field" rows={3} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/>:<input aria-label={label} className="input-field" type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/>}</label>;
}
function YesNo({label,value,onChange}:{label:string;value:string;onChange:(v:'yes'|'no')=>void}){
 return <fieldset className="oer-choice training-choice"><legend>{label}</legend><div className="segmented">{(['yes','no'] as const).map(v=><button type="button" key={v} aria-pressed={value===v} className={value===v?'selected':''} onClick={()=>onChange(v)}>{v==='yes'?'Yes':'No'}</button>)}</div></fieldset>;
}
async function generate(body:unknown){
 if(!db)throw new Error('Connect Supabase before generating notes.');
 const {data:{session}}=await db.auth.getSession();
 if(!session)throw new Error('Sign in again to generate a note.');
 const response=await fetch('/api/notes',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify(body),signal:AbortSignal.timeout(45000)});
 const result=await response.json();
 if(!response.ok)throw new Error(result.error||'Unable to generate. Please try again.');
 return result;
}
const issueInput=(i:TrainingIssue)=>JSON.stringify({...i,generatedNote:undefined,editedNote:undefined});

export function TrainingIssueCard({issue,index,total,onChange,onRemove,onMove,onCopy}:{issue:TrainingIssue;index:number;total:number;onChange:(patch:Partial<TrainingIssue>)=>void;onRemove:()=>void;onMove:(direction:number)=>void;onCopy:(text:string)=>void}){
 const assistant=useAssistant();
 const changeRef=useRef(onChange);changeRef.current=onChange;
 const [preview,setPreview]=useState<{note:string;source:'ai'|'fallback'}>();
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[editing,setEditing]=useState(false);
 const latest=useRef(issue);latest.current=issue;
 const mounted=useRef(true);useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const run=async()=>{
  if(busy)return;
  const snapshot=latest.current;

  setBusy(true);setError('');
  try{
   const result=await generate({kind:'training_issue',issue:snapshot});
   if(!mounted.current)return;
   if(issueInput(latest.current)!==issueInput(snapshot)||latest.current.editedNote!==snapshot.editedNote){setError('This issue changed while generating. Generate again to use the latest details.');return;}
   if(typeof result.note!=='string')throw new Error('No issue note was returned. Please try again.');
   if(snapshot.editedNote!==undefined)setPreview({note:result.note,source:result.source==='ai'?'ai':'fallback'});else onChange({generatedNote:result.note,editedNote:undefined,generatedSource:result.source==='ai'?'ai':'fallback'});setEditing(false);
  }catch(e){if(mounted.current)setError(e instanceof Error?e.message:'Unable to generate note.');}
  finally{if(mounted.current)setBusy(false);}
 };
 const note=issue.editedNote??issue.generatedNote??'';
 const hasOutput=issue.editedNote!==undefined||issue.generatedNote!==undefined;
 return <article className="question-card training-issue" aria-labelledby={`training-issue-${issue.id}`}>
  <div className="training-issue-heading"><h3 id={`training-issue-${issue.id}`}>Issue {index+1}</h3><div className="training-reorder"><button type="button" className="text-action" aria-label={`Move issue ${index+1} up`} disabled={index===0} onClick={()=>onMove(-1)}>Move up</button><button type="button" className="text-action" aria-label={`Move issue ${index+1} down`} disabled={index===total-1} onClick={()=>onMove(1)}>Move down</button></div></div>
  <TextField label="Issue title (optional)" value={issue.title} onChange={title=>onChange({title})}/>
  <TextField label="Describe the issue" value={issue.observation} onChange={observation=>onChange({observation})} multiline placeholder="Write what you observed, in your own words."/>
  <TextField label="How was the issue addressed?" value={issue.resolution} onChange={resolution=>onChange({resolution})} multiline placeholder="Describe what you did. Identify actions that are still planned."/>
  <div className="oer-grid"><label className="oer-field"><span>Issue status</span><select aria-label="Issue status" className="input-field" value={issue.resolutionStatus} onChange={e=>onChange({resolutionStatus:e.target.value as TrainingIssue['resolutionStatus']})}>{Object.entries(resolutionStatuses).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label className="oer-field"><span>Training status</span><select aria-label="Training status" className="input-field" value={issue.trainingStatus} onChange={e=>onChange({trainingStatus:e.target.value as TrainingIssue['trainingStatus']})}>{Object.entries(trainingStatuses).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label></div>
  <label className="oer-field"><span>Add verification (optional)</span><select className="input-field" value="" onChange={e=>{if(e.target.value)onChange({verificationNotes:[issue.verificationNotes,e.target.value==='Other'?'Other verification: ':e.target.value].filter(Boolean).join('\n')});}}><option value="">Choose a verified result</option>{['Chef independently demonstrated the procedure','Observed corrected process','Equipment tested','Documentation verified','Other'].map(v=><option key={v}>{v}</option>)}</select></label>
  <TextField label="Verification details (optional)" value={issue.verificationNotes} onChange={verificationNotes=>onChange({verificationNotes})} multiline placeholder="Record only what you verified, including test results when applicable."/>
  <YesNo label="Does the corrective action require supplies or equipment?" value={issue.equipmentRequired?'yes':'no'} onChange={v=>onChange({equipmentRequired:v==='yes'})}/>
  {issue.equipmentRequired&&<div className="training-equipment"><p className="oer-help">Record each required item and its actual order status.</p>{issue.equipmentItems.map((item,n)=><fieldset className="training-equipment-row" key={n}><legend>Item {n+1}</legend><TextField label="Item name" value={item.name} onChange={name=>onChange({equipmentItems:issue.equipmentItems.map((v,x)=>x===n?{...v,name}:v)})}/><label className="oer-field"><span>Quantity (optional)</span><input className="input-field" type="number" min="1" step="1" value={item.quantity??''} onChange={e=>{const value=e.target.valueAsNumber;onChange({equipmentItems:issue.equipmentItems.map((v,x)=>x===n?{...v,quantity:Number.isFinite(value)&&value>0?value:undefined}:v)});}}/></label><TextField label="Order status" value={item.orderStatus||''} onChange={orderStatus=>onChange({equipmentItems:issue.equipmentItems.map((v,x)=>x===n?{...v,orderStatus}:v)})} placeholder="Not ordered, pending, ordered, received…"/><button type="button" className="text-action" onClick={()=>onChange({equipmentItems:issue.equipmentItems.filter((_,x)=>x!==n)})}>Remove item {n+1}</button></fieldset>)}<button type="button" className="secondary" onClick={()=>onChange({equipmentItems:[...issue.equipmentItems,{name:'',orderStatus:''}]})}>Add equipment item</button></div>}
  {preview&&<div className="note-preview"><pre>{preview.note}</pre><button onClick={()=>{onChange({generatedNote:preview.note,editedNote:undefined,generatedSource:preview.source});setPreview(undefined);}}>Use This Note</button><button onClick={()=>setPreview(undefined)}>Keep my note</button></div>}
  <button type="button" className="text-action" onClick={()=>assistant?.open({id:`training-${issue.id}`,input:()=>({question:latest.current.title||'Training issue',answer:latest.current.resolutionStatus,observation:latest.current.observation,findings:[],resolution:{actionTaken:latest.current.resolution,verificationDetails:latest.current.verificationNotes,training:latest.current.trainingStatus==='completed'?'Training Completed':undefined,followUpRequired:['follow_up','unable','partial'].includes(latest.current.resolutionStatus)}}),note:()=>latest.current.editedNote??latest.current.generatedNote??'',apply:note=>changeRef.current({editedNote:note})})}>AI Assistant</button>
  <div className="training-note-actions"><button type="button" className="secondary" disabled={busy||!issue.observation.trim()} onClick={()=>void run()}>{busy?'Generating…':issue.generatedNote?'Regenerate':'Generate Note'}</button><button type="button" className="text-action" disabled={!hasOutput} onClick={()=>setEditing(v=>!v)}>{editing?'Finish editing':'Edit Generated Note'}</button><button type="button" className="text-action" disabled={!note} onClick={()=>onCopy(note)}>Copy</button><button type="button" className="text-action training-remove" onClick={()=>{if(window.confirm(`Remove issue ${index+1} and its notes?`))onRemove();}}>Remove Issue</button></div>
  {hasOutput&&<div className="training-note"><p className="oer-help">{issue.editedNote!==undefined?'Manually edited · preserved until you confirm replacement':issue.generatedSource==='fallback'?'Template fallback · review before copying':'Generated note · review before copying'}</p>{editing?<textarea className="input-field" aria-label={`Edit generated note for issue ${index+1}`} rows={5} value={note} onChange={e=>onChange({editedNote:e.target.value})}/>:<p className="training-note-text">{note}</p>}</div>}
  {error&&<p className="error-box" role="alert">{error}</p>}
 </article>;
}

function EvidenceFile({attachment,onRemove,removing}:{attachment:TrainingAttachment;onRemove:()=>void;removing:boolean}){
 const [url,setUrl]=useState(''),[error,setError]=useState('');
 useEffect(()=>{let active=true;const refresh=async()=>{if(!db)return;const {data,error}=await db.storage.from('training-evidence').createSignedUrl(attachment.path,3600);if(active){setUrl(data?.signedUrl||'');setError(error?'Unable to load this file.':'' );}};void refresh();const interval=setInterval(()=>void refresh(),45*60000);return()=>{active=false;clearInterval(interval);};},[attachment.path]);
 return <li className="training-evidence-file">{url&&attachment.type.startsWith('image/')&&<a href={url} target="_blank" rel="noreferrer"><img src={url} alt={attachment.name} loading="lazy"/></a>}<div><strong>{attachment.name}</strong><small>{attachment.category}</small>{url&&<a href={url} target="_blank" rel="noreferrer">View private file</a>}{error&&<span role="alert">{error}</span>}</div><button type="button" className="text-action" disabled={removing} onClick={onRemove}>{removing?'Removing…':'Remove file'}</button></li>;
}

export function TrainingEditor({report,onChange,onComplete,onCopy,userId,reportId}:Props){
 const latest=useRef(report);latest.current=report;
 const mounted=useRef(true);useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[uploading,setUploading]=useState(''),[category,setCategory]=useState(categories[0]),[removing,setRemoving]=useState<string[]>([]);
 const update=(patch:Partial<TrainingReport>)=>{const next={...latest.current,...patch};latest.current=next;onChange(next);};
 const patchIssue=(id:string,patch:Partial<TrainingIssue>)=>update({issues:latest.current.issues.map(i=>i.id===id?{...i,...patch}:i)});
 const move=(id:string,direction:number)=>{const issues=[...latest.current.issues];const from=issues.findIndex(i=>i.id===id),to=from+direction;if(from<0||to<0||to>=issues.length)return;[issues[from],issues[to]]=[issues[to],issues[from]];update({issues});};
 const run=async()=>{
  if(busy)return;
  const snapshot=latest.current;
  if(Object.values(snapshot.editedSections).some(Boolean)&&!window.confirm('Replace manually edited CMX1 sections with a report generated from the latest details?'))return;
  setBusy(true);setError('');
  try{
   const result=await generate({kind:'training',report:snapshot});
   if(!mounted.current)return;
   if(JSON.stringify(snapshot)!==JSON.stringify(latest.current)){setError('The report changed while generating. Generate again to use the latest details.');return;}
   if(!result.sections||!Object.keys(sectionLabels).every(k=>typeof result.sections[k]==='string'))throw new Error('The generated report was incomplete. Please try again.');
   update({sections:result.sections,editedSections:{},generatedSource:result.source==='ai'?'ai':'fallback'});
   document.getElementById('training-cmx1')?.scrollIntoView({behavior:'smooth',block:'start'});
  }catch(e){if(mounted.current)setError(e instanceof Error?e.message:'Unable to generate report.');}
  finally{if(mounted.current)setBusy(false);}
 };
 const upload=async(files:File[])=>{
  if(!db||uploading)return;
  setError('');
  for(const file of files){
   if(!mounted.current)break;
   if(!['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf'].includes(file.type)||file.size>20*1024*1024){setError('Choose JPEG, PNG, WebP, HEIC, or PDF files up to 20 MB each.');continue;}
   const id=crypto.randomUUID();const extension=file.name.split('.').pop()?.replace(/[^a-z0-9]/gi,'').slice(0,10)||'file';
   const path=`${userId}/${reportId}/${id}.${extension}`;
   setUploading(file.name);
   try{
    const {error}=await db.storage.from('training-evidence').upload(path,file,{contentType:file.type,upsert:false});
    if(error)throw error;
    if(!mounted.current){await db.storage.from('training-evidence').remove([path]);break;}
    update({attachments:[...latest.current.attachments,{id,path,name:file.name,type:file.type,category}]});
   }catch(e){if(mounted.current)setError(e instanceof Error?e.message:'Unable to upload evidence. Check the private storage configuration.');}
  }
  if(mounted.current)setUploading('');
 };
 const remove=async(a:TrainingAttachment)=>{
  if(!db||removing.includes(a.id)||!window.confirm(`Remove “${a.name}” from this record?`))return;
  setRemoving(v=>[...v,a.id]);setError('');
  update({attachments:latest.current.attachments.filter(v=>v.id!==a.id)});
  try{const {error}=await db.storage.from('training-evidence').remove([a.path]);if(error)throw error;}
  catch{if(mounted.current)setError('Evidence reference removed, but private file cleanup failed. Contact your storage administrator.');}
  finally{if(mounted.current)setRemoving(v=>v.filter(id=>id!==a.id));}
 };
 const suggestedInventory=report.issues.some(i=>i.equipmentRequired)?'Yes':'No';
 return <section className="oer-editor training-editor">
  <div className="page-heading editor-heading"><div><p className="eyebrow">IMPROVEMENT TRAINING RECORD</p><h1>Document. Train. Verify.</h1><p className="subhead">Every issue and resolution, together in one record. Your changes save automatically.</p></div></div>
  <section className="training-section" aria-labelledby="training-incident"><div className="training-section-heading"><span>01</span><div><h2 id="training-incident">Incident</h2><p>Record the context. The incident date is optional.</p></div></div><div className="oer-grid"><TextField label="Incident Date (optional)" type="date" value={report.incidentDate} onChange={incidentDate=>update({incidentDate})}/><TextField label="Chef / Employee Name" value={report.employees} onChange={employees=>update({employees})} placeholder="Enter one or more names"/></div><label className="oer-field"><span>Incident Source (optional)</span><select aria-label="Incident Source (optional)" className="input-field" value={report.incidentSource} onChange={e=>update({incidentSource:e.target.value})}><option value="">Select a source</option>{incidentSources.map(v=><option key={v}>{v}</option>)}</select></label></section>
  <section className="training-section" aria-labelledby="training-issues"><div className="training-section-heading"><span>02</span><div><h2 id="training-issues">Issues and Resolutions</h2><p>Use everyday language. Separate what happened from what was completed.</p></div></div><div className="training-issues">{report.issues.length===0&&<div className="training-empty"><h3>Start with an observation.</h3><p>Add an issue, then document the action and any verified result.</p></div>}{report.issues.map((issue,index)=><TrainingIssueCard key={issue.id} issue={issue} index={index} total={report.issues.length} onChange={patch=>patchIssue(issue.id,patch)} onRemove={()=>update({issues:latest.current.issues.filter(v=>v.id!==issue.id)})} onMove={direction=>move(issue.id,direction)} onCopy={onCopy}/>)}</div><div className="training-entry-actions"><button type="button" className="secondary" onClick={()=>update({issues:[...latest.current.issues,emptyTrainingIssue(crypto.randomUUID())]})}>+ Add Another Issue</button><button type="button" className="primary" disabled={busy||!report.issues.some(i=>i.observation.trim())} onClick={()=>void run()}>{busy?'Generating Training Report…':'Generate Training Report'}</button></div></section>
  <section className="training-section" aria-labelledby="training-details"><div className="training-section-heading"><span>03</span><div><h2 id="training-details">Training Details</h2><p>Additional trainers, equipment requirements, and supporting evidence.</p></div></div><YesNo label="In addition to you, was there anyone else present that helped conduct the training?" value={report.additionalTrainers} onChange={additionalTrainers=>update({additionalTrainers})}/>{report.additionalTrainers==='yes'&&<TextField label="Name of Others Present" value={report.trainerNames} onChange={trainerNames=>update({trainerNames})} multiline placeholder="Enter all additional trainers"/>}<YesNo label="Do any inventory items or equipment need to be ordered as part of the corrective action for this incident?" value={report.inventoryRequired} onChange={inventoryRequired=>update({inventoryRequired})}/><p className="oer-help">Suggested answer from issue equipment records: <strong>{suggestedInventory}</strong>. Confirm the answer above.</p><TextField label="Inventory issue notes (optional)" value={report.inventoryNotes} onChange={inventoryNotes=>update({inventoryNotes})} multiline placeholder="Include items needed and confirmed order status."/><div className="training-evidence"><h3>Notes and Extra Documents for the Record</h3><TextField label="Supporting evidence notes (optional)" value={report.evidenceNotes} onChange={evidenceNotes=>update({evidenceNotes})} multiline/><label className="oer-field"><span>Evidence category for new uploads</span><select className="input-field" value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(v=><option key={v}>{v}</option>)}</select></label><label className="oer-field training-upload"><span>Attach photos or inspection documents</span><input aria-label="Attach photos or inspection documents" type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf" disabled={!!uploading||!db} onChange={e=>{const files=Array.from(e.target.files||[]);e.target.value='';void upload(files);}}/><small>Private files · up to 20 MB each · files stay with this report.</small></label>{uploading&&<div className="training-upload-progress" role="status"><progress aria-label={`Uploading ${uploading}`}/><span>Uploading {uploading}…</span></div>}<ul className="training-evidence-list">{report.attachments.map(a=><EvidenceFile key={a.id} attachment={a} removing={removing.includes(a.id)} onRemove={()=>void remove(a)}/>)}</ul><p className="oer-help">Evidence is stored privately in Fieldnotes. Copy report text into CMX1 and attach any evidence there separately.</p></div><TextField label="Final Notes (optional)" value={report.finalNotes} onChange={finalNotes=>update({finalNotes})} multiline placeholder="Follow-up requirements, verification results, or unresolved issues."/></section>
  <section className="training-section" id="training-cmx1" aria-labelledby="training-report"><div className="training-section-heading"><span>04</span><div><h2 id="training-report">Generated CMX1 Report</h2><p>Review every section before copying. Your edits are saved independently.</p></div></div>{report.generatedSource==='fallback'&&<p className="training-generation-status" role="status">Template fallback used. AI was unavailable; review the recorded facts and action notes before copying.</p>}{(Object.entries(sectionLabels) as [keyof TrainingSections,string][]).map(([key,label])=><div className="training-cmx1-section" key={key}><div className="training-output-heading"><h3>{label}</h3><button type="button" className="text-action" disabled={!report.sections[key]} onClick={()=>onCopy(report.sections[key])}>Copy</button></div>{report.editedSections[key]&&<p className="oer-help">Manually edited · regeneration asks before replacing this section.</p>}<textarea className="input-field" aria-label={label} rows={5} value={report.sections[key]} placeholder="Generate the training report, or write this section here." onChange={e=>update({sections:{...latest.current.sections,[key]:e.target.value},editedSections:{...latest.current.editedSections,[key]:true}})}/></div>)}</section>
  {error&&<p className="error-box" role="alert">{error}</p>}
  <div className="training-final-actions"><button type="button" className="secondary" disabled={!Object.values(report.sections).some(Boolean)} onClick={()=>onCopy(trainingText(report))}>Copy report</button><button type="button" className="primary" disabled={!!uploading||busy||!report.issues.some(i=>i.observation.trim())} onClick={onComplete}>Mark Completed</button></div>
 </section>;
}
