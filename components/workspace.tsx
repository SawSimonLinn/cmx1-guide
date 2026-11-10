'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronDown, ChevronRight, Clipboard, Clock3, Copy, FileText, History, LogOut, Menu, Plus, Save, ShieldCheck, RotateCcw, Trash2, X } from 'lucide-react';
import { OerEditor } from './oer-editor';
import { emptyReport, prepareReport, OerReport } from '@/lib/oer';
import { PhotoGuide } from './photo-guide';
import type { User } from '@supabase/supabase-js';
import { supabase, configured } from '@/lib/supabase';
import { Answer, Answers, effectiveNote, formNames, fullReport, generateNote, isAnswered, questions } from '@/lib/questions';

type Report = {id:string;user_id:string;form_type:string;status:'draft'|'completed';answers:Answers; oer_data?:OerReport;created_at:string;updated_at:string};
type Screen = 'home'|'editor'|'history';
const db = supabase();
const shortDate = (date:string) => new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'}).format(new Date(date));
const longDate = (date:string) => new Intl.DateTimeFormat('en-US',{month:'long',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(date));
function IconButton({children,onClick,label,disabled=false}:{children:React.ReactNode;onClick:()=>void;label:string;disabled?:boolean}){return <button className="icon-button" type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled}>{children}</button>}

export default function Workspace(){
  const [user,setUser]=useState<User|null>(null);
  const [loading,setLoading]=useState(true);
  const [screen,setScreen]=useState<Screen>('home');
  const [menu,setMenu]=useState(false);
  const [formOpen,setFormOpen]=useState(false);
  const [reports,setReports]=useState<Report[]>([]);
  const [activeId,setActiveId]=useState<string|null>(null);
  const [answers,setAnswers]=useState<Answers>({});
  const [reportType,setReportType]=useState('Store Visit');
  const [oer,setOer]=useState<OerReport>(emptyReport());
  const [status,setStatus]=useState<'draft'|'completed'>('draft');
  const [working,setWorking]=useState(false);
  const [dirty,setDirty]=useState(false);
  const [toast,setToast]=useState('');
  const [fullOpen,setFullOpen]=useState(false);
  const [error,setError]=useState('');
  const [providerLoading,setProviderLoading]=useState(false);
  const count=useMemo(()=>questions.filter(q=>isAnswered(q,answers[q.id])).length,[answers]);
  const allReport=useMemo(()=>fullReport(answers),[answers]);

  const flash=(message:string)=>{setToast(message);setTimeout(()=>setToast(''),2700)};
  const loadReports=useCallback(async()=>{
    if(!db) return;
    const {data,error:e}=await db.from('visit_reports').select('*').order('updated_at',{ascending:false});
    if(e)setError(e.message);else setReports((data||[]) as Report[]);
  },[]);
  useEffect(()=>{
    if(!db){setLoading(false);return;}
    let mounted=true;
    db.auth.getUser().then(({data})=>{if(mounted){setUser(data.user);setLoading(false)}});
    const {data:{subscription}}=db.auth.onAuthStateChange((_event,session)=>{if(mounted){setUser(session?.user||null);setLoading(false);}});
    return()=>{mounted=false;subscription.unsubscribe()};
  },[]);
  useEffect(()=>{if(user)void loadReports();else setReports([])},[user,loadReports]);
  useEffect(()=>{const params=new URLSearchParams(window.location.search);if(params.has('auth_error'))setError('Sign-in could not be completed. Please try again.');},[]);

  const signIn=async(provider:'google'|'azure')=>{
    if(!db)return;
    setProviderLoading(true);setError('');
    const {error:e}=await db.auth.signInWithOAuth({provider,options:{redirectTo:`${location.origin}/auth/callback`,scopes:provider==='azure'?'email openid profile':undefined}});
    if(e){setError(e.message);setProviderLoading(false)}
  };
  const signOut=async()=>{await db?.auth.signOut();setActiveId(null);setScreen('home');setMenu(false)};
  const editAnswer=(id:number,field:'answer'|'value'|'note',value:string)=>{
    setAnswers(prev=>({...prev,[id]:{...prev[id],answer:prev[id]?.answer??'', [field]:value,...(field==='note'?{}:{note:undefined})}}));setDirty(true);
  };
  const regenerate=(id:number)=>{
    const question=questions.find(q=>q.id===id);
    if(!question)return;
    setAnswers(prev=>({...prev,[id]:{...prev[id],note:generateNote(question,prev[id])}}));
    setDirty(true);flash('Note regenerated from your current answer');
  };
  const start=(type='Store Visit')=>{setReportType(type);setOer(emptyReport());setActiveId(null);setAnswers({});setStatus('draft');setDirty(false);setScreen('editor');setFormOpen(false);setFullOpen(false)};
  const openReport=(r:Report)=>{setReportType(r.form_type);setOer(r.oer_data||emptyReport());setActiveId(r.id);setAnswers(r.answers||{});setStatus(r.status);setDirty(false);setScreen('editor');setFullOpen(false)};
  const save=async(next:'draft'|'completed'=status)=>{
    if(!db||!user)return;
    setWorking(true);setError('');
    const payload={user_id:user.id,form_type:reportType,status:next,answers:reportType==='Store Visit'?answers:{},oer_data:reportType==='Operational Excellence Review'?prepareReport(oer):null,updated_at:new Date().toISOString()};
    const result=activeId?await db.from('visit_reports').update(payload).eq('id',activeId).select().single():await db.from('visit_reports').insert(payload).select().single();
    setWorking(false);
    if(result.error){setError(result.error.message);return}
    const saved=result.data as Report;setActiveId(saved.id);setDirty(false);setStatus(next);flash(next==='completed'?'Report completed and saved':'Draft saved securely');await loadReports();
  };
  const remove=async(r:Report)=>{
    if(!db||!confirm('Delete this saved report? This cannot be undone.'))return;
    const {error:e}=await db.from('visit_reports').delete().eq('id',r.id);
    if(e){setError(e.message);return}await loadReports();flash('Report deleted');
    if(activeId===r.id){setActiveId(null);setScreen('home')}
  };
  const copy=async(text:string)=>{try{await navigator.clipboard.writeText(text);flash('Copied to clipboard')}catch{flash('Copy not available. Select the text instead.')}};

  if(loading) return <div className="center-loading"><div className="spinner"/>Loading workspace</div>;
  if(!configured())return <div className="setup-screen"><div className="brand-circle">f.</div><p className="eyebrow">FIELDNOTES / SETUP</p><h1>One step before you begin.</h1><p>Connect a Supabase project by setting <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in <code>.env.local</code>.</p><p className="muted">See README.md for database and Google / Microsoft sign-in instructions.</p></div>;
  if(!user)return <main className="auth-shell"><div className="auth-left"><div className="wordmark light">fieldnotes<span>.</span></div><div className="auth-headline"><div className="eyebrow light-text">FIELD OPERATIONS, REFINED</div><h1>Everything observed.<br/>Nothing overlooked.</h1><p>A quieter way to document every store visit.</p></div><div className="auth-foot">BUILT FOR FIELD TEAMS</div></div><div className="auth-right"><div className="signin-box"><div className="brand-circle">f.</div><p className="eyebrow">YOUR WORKSPACE</p><h2>Welcome back.</h2><p className="muted">Sign in to write, save, and revisit your store visit reports.</p><div className="signin-actions"><button onClick={()=>void signIn('google')} disabled={providerLoading} className="provider"><span className="google-symbol">G</span>Continue with Google<ArrowRight size={17}/></button><button onClick={()=>void signIn('azure')} disabled={providerLoading} className="provider"><span className="microsoft-symbol"><i/><i/><i/><i/></span>Continue with Microsoft<ArrowRight size={17}/></button></div>{error&&<p className="error-box">{error}</p>}<p className="auth-privacy"><ShieldCheck size={14}/> Reports are private to your account.</p></div></div></main>;

  return <div className="app-shell"><aside className={`sidebar ${menu?'show':''}`}><div className="sidebar-top"><div className="wordmark">fieldnotes<span>.</span></div><IconButton label="Close menu" onClick={()=>setMenu(false)}><X size={19}/></IconButton></div><p className="nav-label">WORKSPACE</p><nav className="nav"><button className={screen==='home'?'active':''} onClick={()=>{setScreen('home');setMenu(false)}}><Clipboard size={18}/> Overview</button><button className={screen==='editor'?'active':''} onClick={()=>{if(screen!=='editor')start();setMenu(false)}}><FileText size={18}/> Store visit</button><button className={screen==='history'?'active':''} onClick={()=>{setScreen('history');setMenu(false)}}><History size={18}/> History <span className="nav-count">{reports.length}</span></button></nav><div className="sidebar-bottom"><div className="account"><div className="avatar">{(user.email||'?').slice(0,1).toUpperCase()}</div><div className="account-text"><strong>{user.user_metadata?.full_name||user.email?.split('@')[0]}</strong><span>{user.email}</span></div></div><button className="signout" onClick={()=>void signOut()}><LogOut size={17}/> Sign out</button></div></aside>{menu&&<button className="scrim" aria-label="Close menu" onClick={()=>setMenu(false)}/>}
    <div className="main-area"><header className="topbar"><div className="topbar-left"><IconButton label="Open menu" onClick={()=>setMenu(true)}><Menu size={21}/></IconButton><span className="mobile-wordmark">fieldnotes<span>.</span></span><span className="breadcrumb">Workspace <ChevronRight size={15}/> <strong>{screen==='home'?'Overview':screen==='history'?'History':reportType}</strong></span></div><span className="topbar-right">HISSHO / FIELD OPERATIONS</span></header>
    <main className="content">
    {screen==='home'&&<><div className="page-heading"><div><p className="eyebrow">Workspace</p><h1>Good evening<span className="period">.</span></h1><p className="subhead">Create a store visit report or pick up where you left off.</p></div><button className="primary" onClick={()=>start()}><Plus size={18}/> New report</button></div><section className="metric-row"><div className="metric"><span>Total reports</span><strong>{reports.length.toString().padStart(2,'0')}</strong><small>All saved visits</small></div><div className="metric"><span>Completed</span><strong>{reports.filter(r=>r.status==='completed').length.toString().padStart(2,'0')}</strong><small>Ready to reference</small></div><div className="metric"><span>In progress</span><strong>{reports.filter(r=>r.status==='draft').length.toString().padStart(2,'0')}</strong><small>Work in progress</small></div></section><div className="section-heading"><div><p className="eyebrow">New visit</p><h2>Choose a form</h2></div></div><div className="form-select-wrap"><button className={`form-select ${formOpen?'opened':''}`} onClick={()=>setFormOpen(!formOpen)}><span className="select-icon"><FileText size={21}/></span><span><strong>Activity form</strong><small>Choose the type of report to create</small></span><ChevronDown size={20}/></button>{formOpen&&<div className="form-options">{formNames.map(name=><button key={name} disabled={!['Store Visit','Operational Excellence Review'].includes(name)} onClick={()=>start(name)}><span>{name}</span>{['Store Visit','Operational Excellence Review'].includes(name)?<span className="available">AVAILABLE <ArrowRight size={14}/></span>:<span className="soon">COMING SOON</span>}</button>)}</div>}</div><div className="section-heading recent"><div><p className="eyebrow">Activity</p><h2>Recent reports</h2></div><button className="text-action" onClick={()=>setScreen('history')}>View all <ArrowRight size={16}/></button></div><ReportList reports={reports.slice(0,4)} onOpen={openReport} onDelete={remove} onDuplicate={r=>start(r.form_type)} emptyTitle="A clean slate." emptyText="Your reports will appear here after you save your first visit."/></>}
    {screen==='history'&&<><div className="page-heading"><div><p className="eyebrow">ARCHIVE</p><h1>Your history<span className="period">.</span></h1><p className="subhead">Every note, right where you left it.</p></div><button className="primary" onClick={()=>start()}><Plus size={18}/> New report</button></div><ReportList reports={reports} onOpen={openReport} onDelete={remove} onDuplicate={r=>start(r.form_type)} emptyTitle="No reports yet." emptyText="Create your first store visit report to start your history."/></>}
    {screen==='editor'&&reportType==='Operational Excellence Review'&&<><div className="editor-top"><button className="back-link" onClick={()=>setScreen('home')}><ArrowLeft size={16}/> Overview</button><span className="editor-status">{status==='completed'?'Completed':'Draft'}{dirty&&' · Unsaved changes'}</span></div><OerEditor report={oer} onChange={r=>{setOer(r);setDirty(true)}} onSave={s=>void save(s)} onCopy={t=>void copy(t)} working={working}/></>}
    {screen==='editor'&&reportType==='Store Visit'&&<><div className="editor-top"><button className="back-link" onClick={()=>setScreen('home')}><ArrowLeft size={16}/> Overview</button><div className="editor-status"><span className={`status-dot ${status}`}/>{status==='completed'?'Completed':'Draft'}{dirty&&' · Unsaved changes'}</div></div><div className="page-heading editor-heading"><div><p className="eyebrow">Store visit report</p><div className="editor-title-row"><h1>Store visit<span className="period">.</span></h1><PhotoGuide/></div><p className="subhead">Answer each question. Your report notes take shape as you go.</p></div><button className="secondary save-top" onClick={()=>void save()} disabled={working}><Save size={17}/>{working?'Saving…':'Save draft'}</button></div><div className="progress-block"><div><span>Completion</span><strong>{count} <span>/ {questions.length}</span></strong></div><div className="progress-track"><div style={{width:`${(count/questions.length)*100}%`}}/></div></div><div className="questions">{questions.map(q=>{const r=answers[q.id]||{answer:'' as Answer};const note=effectiveNote(q,r);const answered=isAnswered(q,r);return <article className="question-card" key={q.id}><div className="question-heading"><span className="question-number">{String(q.id).padStart(2,'0')}</span><div><h3>{q.label}</h3>{q.helper&&<p>{q.helper}</p>}</div>{answered&&<Check className="question-check" size={18}/>}</div><div className="question-body">{q.kind==='binary'&&<><div className="segmented"><button aria-pressed={r.answer==='yes'} className={r.answer==='yes'?'selected':''} onClick={()=>editAnswer(q.id,'answer','yes')}>Yes</button><button aria-pressed={r.answer==='no'} className={r.answer==='no'?'selected':''} onClick={()=>editAnswer(q.id,'answer','no')}>No</button>{(q.id===4||q.id===9)&&<button aria-pressed={r.answer==='na'} className={r.answer==='na'?'selected':''} onClick={()=>editAnswer(q.id,'answer','na')}>N/A</button>}</div>{q.id===2&&r.answer==='yes'&&<input className="input-field detail-input" value={r.value||''} onChange={e=>editAnswer(q.id,'value',e.target.value)} placeholder={q.placeholder}/>}</>}{q.kind==='text'&&<input className="input-field" type={q.id===5?'number':'text'} min={q.id===5?0:undefined} value={r.value||''} onChange={e=>editAnswer(q.id,'value',e.target.value)} placeholder={q.placeholder}/ >}{q.kind==='select'&&<div className="select-shell"><select value={r.value||''} onChange={e=>editAnswer(q.id,'value',e.target.value)}><option value="">Select an option</option>{q.options?.map(o=><option key={o}>{o}</option>)}</select><ChevronDown size={17}/></div>}{answered&&<div className="note-box"><div className="note-header"><span>Generated note</span><div className="note-actions"><button title="Replace this note with a fresh note from the current answer" onClick={()=>regenerate(q.id)}><RotateCcw size={14}/> Regenerate</button><button onClick={()=>void copy(note)}><Copy size={14}/> Copy note</button></div></div><textarea aria-label={`Note for ${q.short}`} rows={Math.max(2,Math.ceil(note.length/72))} value={r.note ?? generateNote(q,r)} onChange={e=>editAnswer(q.id,'note',e.target.value)}/><p>Edit as needed. Regenerate restores the note from your answer.</p></div>}</div></article>})}</div><section className="generate-section"><h2>Visit report</h2><p>Review your notes together, then copy or save your report.</p><div className="generate-actions"><button className="primary" disabled={!count} onClick={()=>setFullOpen(!fullOpen)}>{fullOpen?'Hide report':'Generate report'} <ArrowRight size={17}/></button><button className="secondary" disabled={working} onClick={()=>void save('completed')}><Check size={17}/> Save as complete</button></div>{fullOpen&&<div className="full-report"><div><strong>STORE VISIT REPORT</strong><button onClick={()=>void copy(allReport)}><Copy size={16}/> Copy all</button></div><pre>{allReport||'Answer at least one question to generate your report.'}</pre></div>}</section></>}
    </main><footer className="footer"><span>FIELDNOTES © {new Date().getFullYear()}</span><span>Hissho field operations</span></footer></div>{toast&&<div className="toast" role="status"><Check size={16}/>{toast}</div>}{error&&user&&<div className="error-toast">{error}<button aria-label="Dismiss error" onClick={()=>setError('')}><X size={17}/></button></div>}</div>;
}
function ReportList({reports,onOpen,onDelete,onDuplicate,emptyTitle,emptyText}:{reports:Report[];onOpen:(r:Report)=>void;onDelete:(r:Report)=>void;onDuplicate:(r:Report)=>void;emptyTitle:string;emptyText:string}){return reports.length?<div className="report-list">{reports.map(r=><div className="report-row" key={r.id}><button className="report-open" onClick={()=>onOpen(r)}><div className="report-symbol"><FileText size={19}/></div><div className="report-meta"><strong>{r.form_type}</strong><span><Clock3 size={13}/>{longDate(r.created_at)}</span></div><span className={`report-pill ${r.status}`}>{r.status==='completed'?'Completed':'Draft'}</span><ChevronRight className="report-arrow" size={19}/></button><IconButton label="Duplicate as blank draft" onClick={()=>onDuplicate(r)}><Copy size={17}/></IconButton><IconButton label="Delete report" onClick={()=>onDelete(r)}><Trash2 size={17}/></IconButton></div>)}</div>:<div className="empty-state"><div className="empty-icon"><Clipboard size={25}/></div><h3>{emptyTitle}</h3><p>{emptyText}</p></div>}
