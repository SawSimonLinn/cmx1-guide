'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronRight, Clipboard, Clock3, Copy, FileText, History, LogOut, Menu, Plus, Settings, ShieldCheck, Trash2, X } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { TrainingEditor } from './training-editor';
import { emptyTrainingReport } from '@/lib/training';
import { OerEditor } from './oer-editor';
import { PhotoGuide } from './photo-guide';
import { AssistantProvider, AssistantButton } from './ai-assistant';
import { InspectionNote } from './inspection-note';
import { useFieldReports, type FieldReport } from './use-field-reports';
import { completion as oerCompletion, questions as oerQuestions, emptyReport } from '@/lib/oer';
import { verifiedResolution } from '@/lib/notes';
import { supabase, configured } from '@/lib/supabase';
import { type Answer, type ResponseData, effectiveNote, fullReport, generateNote, isAnswered, questions } from '@/lib/questions';

type Screen='home'|'new'|'editor'|'activities'|'settings';
const db=supabase();
const types=['Store Visit','Operational Excellence Review','Improvement Training Record'];
const date=(value:string)=>new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(value));
const reportProgress=(r:FieldReport)=>r.form_type==='Improvement Training Record'?`${r.training_data?.issues.length||0} Issues`:r.form_type==='Store Visit'?`${questions.filter(q=>isAnswered(q,r.answers?.[q.id])).length}/${questions.length}`:`${oerCompletion(r.oer_data||emptyReport())}/${oerQuestions.length}`;
function IconButton({children,onClick,label}:{children:React.ReactNode;onClick:()=>void;label:string}){return <button className="icon-button" type="button" aria-label={label} title={label} onClick={onClick}>{children}</button>}

export default function Workspace(){
  const [user,setUser]=useState<User|null>(null);
  const [loading,setLoading]=useState(true);
  const [screen,setScreen]=useState<Screen>('home');
  const [menu,setMenu]=useState(false);
  const [mobile,setMobile]=useState(false);
  const sidebarRef=useRef<HTMLElement>(null);
  const menuTriggerRef=useRef<HTMLButtonElement>(null);
  const [toast,setToast]=useState('');
  const [authError,setAuthError]=useState('');
  const [providerLoading,setProviderLoading]=useState(false);
  const [search,setSearch]=useState('');
  const [tab,setTab]=useState<'all'|'draft'|'completed'>('all');
  const [typeFilter,setTypeFilter]=useState('all');
  const [sort,setSort]=useState('newest');
  const restored=useRef<string|null>(null);
  const store=useFieldReports(db,user?.id);
  const {reports,active,saveState}=store;
  const flash=(text:string)=>{setToast(text);setTimeout(()=>setToast(''),2700);};
  useEffect(()=>{
    if(!db){setLoading(false);return;}
    let mounted=true;
    void db.auth.getUser().then(({data})=>{if(mounted){setUser(data.user);setLoading(false);}});
    const {data:{subscription}}=db.auth.onAuthStateChange((_event,session)=>{if(mounted){setUser(session?.user||null);setLoading(false);}});
    return()=>{mounted=false;subscription.unsubscribe();};
  },[]);
  useEffect(()=>{
    const query=window.matchMedia('(max-width: 680px)');
    const update=()=>{setMobile(query.matches);if(!query.matches)setMenu(false);};
    update();query.addEventListener('change',update);
    return()=>query.removeEventListener('change',update);
  },[]);
  useEffect(()=>{
    if(!mobile||!menu)return;
    const drawer=sidebarRef.current;
    if(!drawer)return;
    const trigger=menuTriggerRef.current;
    const previousOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    const focusable=()=>Array.from(drawer.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]'));
    focusable()[0]?.focus();
    const keyboard=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();setMenu(false);return;}
      if(event.key!=='Tab')return;
      const elements=focusable();const first=elements[0];const last=elements[elements.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    };
    document.addEventListener('keydown',keyboard);
    return()=>{document.removeEventListener('keydown',keyboard);document.body.style.overflow=previousOverflow;trigger?.focus();};
  },[mobile,menu]);
  useEffect(()=>{if(store.ready&&user&&restored.current!==user.id){restored.current=user.id;if(store.active)setScreen('editor');}},[store.ready,store.active,user]);
  useEffect(()=>{if(new URLSearchParams(window.location.search).has('auth_error'))setAuthError('Sign-in could not be completed. Please try again.');},[]);
  const navigate=(next:Screen)=>{void store.flush();setScreen(next);setMenu(false);};
  const start=(type:string)=>{store.create(type);setScreen('editor');setMenu(false);};
  const open=(r:FieldReport)=>{void store.flush();store.select(r.id);setScreen('editor');};
  const signIn=async(provider:'google'|'azure')=>{
    if(!db)return;
    setProviderLoading(true);setAuthError('');
    const {error}=await db.auth.signInWithOAuth({provider,options:{redirectTo:`${location.origin}/auth/callback`,scopes:provider==='azure'?'email openid profile':undefined}});
    if(error){setAuthError(error.message);setProviderLoading(false);}
  };
  const signOut=async()=>{
    await store.flush();
    const result=await db?.auth.signOut();
    if(result?.error){store.setError(result.error.message);return;}
    restored.current=null;setScreen('home');setMenu(false);
  };
  const copy=async(text:string)=>{try{await navigator.clipboard.writeText(text);flash('Copied');}catch{store.setError('Copy is unavailable. Select the text and copy it manually.');}};
  const rename=(r:FieldReport)=>{const title=window.prompt('Report title',r.title||'');if(title!==null)store.change({...r,title:title.trim().slice(0,160)},true);};
  const remove=(r:FieldReport)=>{if(window.confirm(`Delete “${r.title||r.form_type}”? This cannot be undone.`))void store.remove(r);};
  const setStatus=(r:FieldReport,status:'draft'|'completed')=>{
    const invalid=Object.values(r.form_type==='Store Visit'?r.answers:(r.oer_data?.answers||{})).some(a=>a.resolution?.status==='Corrected Onsite'&&!verifiedResolution(a.resolution));
    if(status==='completed'&&invalid){store.setError('Document an action and verification for every issue marked Corrected Onsite before completing.');return;}
    store.change({...r,status},true);
  };
  const filtered=useMemo(()=>reports.filter(r=>(tab==='all'||r.status===tab)&&(typeFilter==='all'||r.form_type===typeFilter)&&`${r.title||''} ${r.form_type}`.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>sort==='newest'?b.updated_at.localeCompare(a.updated_at):a.updated_at.localeCompare(b.updated_at)),[reports,tab,typeFilter,search,sort]);

  if(loading)return <div className="center-loading"><div className="spinner"/>Loading workspace</div>;
  if(!configured())return <div className="setup-screen"><div className="brand-circle">f.</div><p className="eyebrow">FIELDNOTES / SETUP</p><h1>One step before you begin.</h1><p>Connect a Supabase project by setting <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in <code>.env.local</code>.</p><p className="muted">See README.md for database and sign-in instructions.</p></div>;
  if(!user)return <main className="auth-shell"><div className="auth-left"><div className="wordmark light">fieldnotes<span>.</span></div><div className="auth-headline"><div className="eyebrow light-text">FIELD OPERATIONS, REFINED</div><h1>Everything observed.<br/>Nothing overlooked.</h1><p>A quieter way to document every store visit.</p></div><div className="auth-foot">BUILT FOR FIELD TEAMS</div></div><div className="auth-right"><div className="signin-box"><div className="brand-circle">f.</div><p className="eyebrow">YOUR WORKSPACE</p><h2>Welcome back.</h2><p className="muted">Sign in to write, save, and revisit your field reports.</p><div className="signin-actions"><button onClick={()=>void signIn('google')} disabled={providerLoading} className="provider"><span className="google-symbol">G</span>Continue with Google<ArrowRight size={17}/></button><button onClick={()=>void signIn('azure')} disabled={providerLoading} className="provider"><span className="microsoft-symbol"><i/><i/><i/><i/></span>Continue with Microsoft<ArrowRight size={17}/></button></div>{authError&&<p className="error-box">{authError}</p>}<p className="auth-privacy"><ShieldCheck size={14}/> Reports are private to your account.</p></div></div></main>;
  const listProps={onOpen:open,onDelete:remove,onRename:rename,onDuplicate:(r:FieldReport)=>{if(r.form_type!=='Improvement Training Record'){start(r.form_type);return;}const copy=store.create(r.form_type);if(copy)store.change({...copy,title:r.title?`${r.title} (copy)`:'Training record (copy)',training_data:{...(r.training_data||emptyTrainingReport()),attachments:[]}},true);setScreen('editor');}};
  return <AssistantProvider report={screen==='editor'?active:undefined} onSummary={text=>{if(active)store.change(active.form_type==='Operational Excellence Review'?{...active,oer_data:{...(active.oer_data||emptyReport()),summary:text}}:{...active,executive_summary:text});}}><div className="app-shell"><aside id="workspace-navigation" ref={sidebarRef} className={`sidebar ${menu?'show':''}`} inert={mobile&&!menu} aria-hidden={mobile&&!menu?true:undefined} role={mobile?'dialog':undefined} aria-modal={mobile&&menu?true:undefined} aria-label={mobile?'Workspace navigation':undefined}><div className="sidebar-top"><div className="wordmark">fieldnotes<span>.</span></div><IconButton label="Close menu" onClick={()=>setMenu(false)}><X size={19}/></IconButton></div><p className="nav-label">WORKSPACE</p><nav className="nav" aria-label="Primary navigation"><AssistantButton/><button className={screen==='home'?'active':''} onClick={()=>navigate('home')}><Clipboard size={18}/>Overview</button><button className={screen==='new'?'active':''} onClick={()=>navigate('new')}><Plus size={18}/>New Report</button><button className={screen==='activities'?'active':''} onClick={()=>navigate('activities')}><History size={18}/>Activities<span className="nav-count">{reports.length}</span></button><button className={screen==='settings'?'active':''} onClick={()=>navigate('settings')}><Settings size={18}/>Settings</button></nav><div className="sidebar-bottom"><div className="account"><div className="avatar">{(user.email||'?').slice(0,1).toUpperCase()}</div><div className="account-text"><strong>{user.user_metadata?.full_name||user.email?.split('@')[0]}</strong><span>{user.email}</span></div></div><button className="signout" onClick={()=>void signOut()}><LogOut size={17}/>Sign out</button></div></aside>{mobile&&menu&&<button tabIndex={-1} className="scrim" aria-label="Close menu" onClick={()=>setMenu(false)}/>}
    <div className="main-area" inert={mobile&&menu}><header className="topbar"><div className="topbar-left"><button ref={menuTriggerRef} className="icon-button" type="button" aria-label="Open menu" aria-expanded={menu} aria-controls="workspace-navigation" onClick={()=>setMenu(true)}><Menu size={21}/></button><span className="mobile-wordmark">fieldnotes<span>.</span></span><span className="breadcrumb">Workspace<ChevronRight size={15}/><strong>{screen==='editor'?active?.form_type:screen==='home'?'Overview':screen==='new'?'New Report':screen==='activities'?'Activities':'Settings'}</strong></span></div><span className="topbar-right">HISSHO / FIELD OPERATIONS</span></header>
    <main className="content">{screen==='editor'&&<AssistantButton/>}
      {!!store.conflicts.length&&<section className="conflict-panel" role="alert"><h2>Another session updated a report.</h2><p>Your local edits are preserved. Keep them in a separate draft, or use the current server version.</p>{store.conflicts.map(id=><div key={id}><strong>{reports.find(r=>r.id===id)?.title||reports.find(r=>r.id===id)?.form_type||'Report'}</strong><div className="generate-actions"><button className="secondary" onClick={()=>void store.resolveConflict(id,'copy')}>Keep local edits as a new draft</button><button className="secondary" onClick={()=>{if(window.confirm('Discard this device’s pending edits and load the server version?'))void store.resolveConflict(id,'server');}}>Use server version</button></div></div>)}</section>}
      {screen==='home'&&<><div className="page-heading"><div><p className="eyebrow">YOUR WORKSPACE</p><h1>Ready for the field<span className="period">.</span></h1><p className="subhead">Start a report or pick up exactly where you left off.</p></div><button className="primary" onClick={()=>navigate('new')}><Plus size={18}/>New Report</button></div><section className="metric-row" aria-label="Report totals"><div className="metric"><span>Total reports</span><strong>{reports.length.toString().padStart(2,'0')}</strong><small>All field activities</small></div><div className="metric"><span>Completed</span><strong>{reports.filter(r=>r.status==='completed').length.toString().padStart(2,'0')}</strong><small>Ready to reference</small></div><div className="metric"><span>In progress</span><strong>{reports.filter(r=>r.status==='draft').length.toString().padStart(2,'0')}</strong><small>Resume any time</small></div></section><div className="section-heading"><div><p className="eyebrow">ACTIVITY</p><h2>Recent reports</h2></div><button className="text-action" onClick={()=>navigate('activities')}>View all<ArrowRight size={16}/></button></div>{!store.ready?<p className="muted" role="status">Loading activities…</p>:<ReportList reports={reports.slice(0,4)} {...listProps}/>}</>}
      {screen==='new'&&<><div className="page-heading"><div><p className="eyebrow">NEW REPORT</p><h1>Choose your activity<span className="period">.</span></h1><p className="subhead">A draft is created automatically when you choose a form.</p></div></div><div className="new-report-options">{types.map(type=><button key={type} className="form-select" onClick={()=>start(type)}><span className="select-icon"><FileText size={22}/></span><span><strong>{type}</strong><small>{type==='Store Visit'?'A focused daily visit · 13 questions':type==='Improvement Training Record'?'Issues, corrective actions, and training for CMX1':'Food safety, operations, and verified actions'}</small></span><ArrowRight size={18}/></button>)}</div></>}
      {screen==='activities'&&<><div className="page-heading"><div><p className="eyebrow">FIELD ACTIVITIES</p><h1>Every visit, saved<span className="period">.</span></h1><p className="subhead">Resume drafts and revisit completed inspections.</p></div><button className="primary" onClick={()=>navigate('new')}><Plus size={18}/>New Report</button></div><div className="activity-filters"><label><span className="sr-only">Search reports</span><input type="search" className="input-field" placeholder="Search reports" value={search} onChange={e=>setSearch(e.target.value)}/></label><label><span className="sr-only">Report type</span><select className="input-field" value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}><option value="all">All types</option>{types.map(type=><option key={type}>{type}</option>)}</select></label><label><span className="sr-only">Sort by last updated</span><select className="input-field" value={sort} onChange={e=>setSort(e.target.value)}><option value="newest">Recently updated</option><option value="oldest">Oldest update first</option></select></label></div><div className="oer-tabs" aria-label="Activity status">{[{value:'all',label:'All'},{value:'draft',label:'Drafts'},{value:'completed',label:'Completed'}].map(item=><button key={item.value} aria-pressed={tab===item.value} onClick={()=>setTab(item.value as typeof tab)}>{item.label}</button>)}</div>{!store.ready?<p className="muted" role="status">Loading activities…</p>:<ReportList reports={filtered} {...listProps}/>}</>}
      {screen==='settings'&&<><div className="page-heading"><div><p className="eyebrow">SETTINGS</p><h1>Your workspace<span className="period">.</span></h1></div></div><section className="settings-section"><h2>Account</h2><p>{user.email}</p><p className="muted">Reports are private to this account. Changes are saved automatically after editing. Pending changes stay on this device until synchronization succeeds.</p><div className="editor-status" role="status" aria-live="polite">{saveState}</div><button className="secondary" onClick={()=>void store.flush()}>Retry pending saves</button></section><section className="settings-section"><h2>Inspection notes</h2><p className="muted">Generated notes are editable suggestions. Review them before copying to CMX1. A template fallback is identified when AI is unavailable.</p></section></>}
      {screen==='editor'&&active&&<><div className="editor-top"><button className="back-link" onClick={()=>navigate('activities')}><ArrowLeft size={16}/>Activities</button><span className="editor-status" role="status" aria-live="polite">{active.status==='completed'?'Completed':'Draft'} · {saveState}</span></div><div className="report-title-field"><label><span className="sr-only">Report title</span><input className="report-title-input" maxLength={160} value={active.title||''} placeholder="Untitled report" onChange={e=>store.change({...active,title:e.target.value})}/></label>{active.status==='completed'&&<button className="text-action" onClick={()=>setStatus(active,'draft')}>Reopen as draft</button>}</div>{active.form_type==='Improvement Training Record'?<TrainingEditor key={active.id} report={active.training_data||emptyTrainingReport()} onChange={training_data=>store.changeTraining(active.id,training_data)} onComplete={()=>setStatus(active,'completed')} onCopy={text=>void copy(text)} userId={user.id} reportId={active.id}/>:active.form_type==='Operational Excellence Review'?<OerEditor key={active.id} report={active.oer_data||emptyReport()} onChange={oer_data=>store.change({...active,oer_data})} onSave={status=>setStatus(active,status)} onCopy={text=>void copy(text)} working={saveState==='Saving…'}/>:<StoreVisitEditor key={active.id} report={active} onChange={store.change} onComplete={()=>setStatus(active,'completed')} onCopy={text=>void copy(text)}/>}</>}
      {screen==='editor'&&!active&&<div className="empty-state"><h2>Select a report to continue.</h2><button className="primary" onClick={()=>navigate('activities')}>Open Activities</button></div>}
    </main><footer className="footer"><span>FIELDNOTES © {new Date().getFullYear()}</span><span>Hissho field operations</span></footer></div>{toast&&<div className="toast" role="status"><Check size={16}/>{toast}</div>}{store.error&&<div className="error-toast" role="alert">{store.error}<button aria-label="Retry save" onClick={()=>void store.flush()}>Retry</button><button aria-label="Dismiss error" onClick={()=>store.setError('')}><X size={17}/></button></div>}</div></AssistantProvider>;
}

function ReportList({reports,onOpen,onDelete,onDuplicate,onRename}:{reports:FieldReport[];onOpen:(r:FieldReport)=>void;onDelete:(r:FieldReport)=>void;onDuplicate:(r:FieldReport)=>void;onRename:(r:FieldReport)=>void}){
  return reports.length?<div className="report-list">{reports.map(r=><article className="report-row" key={r.id}><button className="report-open" onClick={()=>onOpen(r)}><div className="report-symbol"><FileText size={19}/></div><div className="report-meta"><strong>{r.title||r.form_type}</strong>{r.title&&<span>{r.form_type}</span>}<span>{r.status==='completed'?'Completed':'Draft'} · {reportProgress(r)}{r.form_type==='Improvement Training Record'?'':' questions'}</span><span><Clock3 size={13}/>Updated {date(r.updated_at)}</span><span>Created {date(r.created_at)}</span></div><ChevronRight className="report-arrow" size={19}/></button><div className="report-row-actions"><button className="text-action" onClick={()=>onRename(r)}>Rename</button>{(r.status==='completed'||r.form_type==='Improvement Training Record')&&<IconButton label={r.form_type==='Improvement Training Record'?'Copy training report without attachments':'Duplicate as blank new report'} onClick={()=>onDuplicate(r)}><Copy size={17}/></IconButton>}<IconButton label="Delete report" onClick={()=>onDelete(r)}><Trash2 size={17}/></IconButton></div></article>)}</div>:<div className="empty-state"><div className="empty-icon"><Clipboard size={25}/></div><h3>No matching activities.</h3><p>Create a new report or adjust your filters.</p></div>;
}

function StoreVisitEditor({report,onChange,onComplete,onCopy}:{report:FieldReport;onChange:(r:FieldReport,immediate?:boolean)=>void;onComplete:()=>void;onCopy:(text:string)=>void}){
  const [findingsOnly,setFindingsOnly]=useState(false);
  const [fullOpen,setFullOpen]=useState(false);
  const answers=report.answers;
  const latest=useRef(report);latest.current=report;
  const count=questions.filter(q=>isAnswered(q,answers[q.id])).length;
  const negative=(id:number,a?:ResponseData)=>id===13?a?.answer==='yes':a?.answer==='no';
  const update=(id:number,patch:Partial<ResponseData>)=>{const r=latest.current;onChange({...r,answers:{...r.answers,[id]:{...r.answers[id],answer:r.answers[id]?.answer||'' as Answer,...(!('note' in patch)&&!('generated' in patch)?{generated:undefined}:{}),...patch}}});};
  const actualSummary=questions.filter(q=>negative(q.id,answers[q.id])||answers[q.id]?.observationInput?.trim()||answers[q.id]?.resolution?.followUpRequired).map(q=>`${q.short}: ${effectiveNote(q,answers[q.id])}`).filter(Boolean).join('\n\n')||'No findings have been recorded in the answered questions.';
  const jump=()=>{const q=questions.find(q=>!isAnswered(q,answers[q.id]));if(q){setFindingsOnly(false);setTimeout(()=>document.getElementById(`store-question-${q.id}`)?.scrollIntoView({behavior:'smooth',block:'start'}),0);}};
  return <section className="store-editor oer-editor"><div className="page-heading editor-heading"><div><p className="eyebrow">STORE VISIT REPORT</p><div className="editor-title-row"><h1>Store visit<span className="period">.</span></h1><PhotoGuide/></div><p className="subhead">Document the visit. Your changes save automatically.</p></div></div><div className="progress-block"><div><span>Store Visit · {count} of {questions.length} questions completed</span><button className="text-action" disabled={count===questions.length} onClick={jump}>Jump to unanswered<ArrowRight size={14}/></button></div><div className="progress-track"><div style={{width:`${count/questions.length*100}%`}}/></div></div><label className="oer-check findings-toggle"><input type="checkbox" checked={findingsOnly} onChange={e=>setFindingsOnly(e.target.checked)}/>Show Findings Only</label><div className="questions">{questions.filter(q=>!findingsOnly||negative(q.id,answers[q.id])||answers[q.id]?.resolution?.followUpRequired||['Open','Follow-Up Required','Unable to Correct Onsite'].includes(answers[q.id]?.resolution?.status||'')).map(q=>{const a=answers[q.id]||{answer:'' as Answer};const answered=isAnswered(q,a);const choose=(answer:Answer)=>{update(q.id,{answer});setTimeout(()=>document.getElementById(`store-${q.id}-observation`)?.focus({preventScroll:true}),0);};return <article className="question-card" key={q.id} id={`store-question-${q.id}`}><div className="question-heading"><span className="question-number">{String(q.id).padStart(2,'0')}</span><div><h3>{q.label}</h3>{q.helper&&<p>{q.helper}</p>}</div>{answered&&<Check size={18} className="question-check"/>}</div><div className="question-body">{q.kind==='binary'&&<><div className="segmented" aria-label={`Response to ${q.short}`}>{(['yes','no',...([4,9].includes(q.id)?['na']:[])] as Answer[]).map(answer=><button key={answer} aria-pressed={a.answer===answer} className={a.answer===answer?'selected':''} onClick={()=>choose(answer)}>{answer==='na'?'N/A':answer==='yes'?'Yes':'No'}</button>)}</div>{q.id===2&&a.answer==='yes'&&<input aria-label="Promotional item details" className="input-field detail-input" value={a.value||''} onChange={e=>update(q.id,{value:e.target.value})} placeholder={q.placeholder}/>}</>}{q.kind==='text'&&<input aria-label={q.short} className="input-field" type={q.id===5?'number':'text'} min={q.id===5?0:undefined} value={a.value||''} onChange={e=>update(q.id,{value:e.target.value})} placeholder={q.placeholder}/ >}{q.kind==='select'&&<select aria-label={q.short} className="input-field" value={a.value||''} onChange={e=>update(q.id,{value:e.target.value})}><option value="">Select an option</option>{q.options?.map(option=><option key={option}>{option}</option>)}</select>}<InspectionNote id={`store-${q.id}`} question={q.label} answer={a.answer||a.value||''} findings={a.selectedFindings} baseline={effectiveNote(q,{...a,note:undefined,generated:undefined})} value={a} negative={negative(q.id,a)} onChange={patch=>update(q.id,patch)} onCopy={onCopy}/></div></article>;})}</div><section className="oer-summary-panel"><h2>Executive summary</h2><div className="note-box"><div className="note-header"><span>Based on your recorded findings and actions</span><div className="note-actions"><button onClick={()=>{if(!report.executive_summary||window.confirm('Replace your edited summary with a summary of the latest findings?'))onChange({...report,executive_summary:actualSummary});}}>Generate summary</button><button disabled={!report.executive_summary} onClick={()=>onCopy(report.executive_summary)}><Copy size={14}/>Copy summary</button></div></div><textarea aria-label="Executive summary" rows={6} placeholder="Generate a summary from the report’s actual findings, then edit it here." value={report.executive_summary||''} onChange={e=>onChange({...report,executive_summary:e.target.value})}/></div></section><section className="generate-section"><h2>Visit report</h2><p>Completion is always your decision. Answering questions does not complete a report automatically.</p><div className="generate-actions"><button className="primary" disabled={!count} onClick={()=>setFullOpen(!fullOpen)}>{fullOpen?'Hide report':'Review report'}<ArrowRight size={17}/></button><button className="secondary" disabled={count!==questions.length} onClick={onComplete}><Check size={17}/>Mark Completed</button></div>{fullOpen&&<div className="full-report"><div><strong>STORE VISIT REPORT</strong><button onClick={()=>onCopy(fullReport(answers))}><Copy size={16}/>Copy all</button></div><pre>{fullReport(answers)}</pre></div>}</section></section>;
}
