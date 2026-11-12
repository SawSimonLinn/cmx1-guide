'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { emptyTrainingReport, type TrainingReport } from '@/lib/training';
import { emptyReport } from '@/lib/oer';
import { acknowledgePending, parsePendingJournal, type FieldReport, type PendingReport } from './report-journal';
export type { FieldReport } from './report-journal';

export type SaveState = 'Saving…' | 'Saved' | 'Offline changes pending' | 'Unable to save';
const journalKey = (uid: string) => `fieldnotes:pending:v2:${uid}`;
const activeKey = (uid: string) => `fieldnotes:active:v2:${uid}`;

/** Local journal is written before a debounce starts. RPCs are serialized and revision checked. */
export function useFieldReports(db: SupabaseClient | null, userId: string | undefined) {
  const [reports, setReports] = useState<FieldReport[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('Saved');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const pending = useRef<Record<string, PendingReport>>({});
  const rows = useRef<FieldReport[]>([]);
  const uid = useRef<string | undefined>(userId);
  const running = useRef<Promise<void> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCount = useRef(0);
  const storageFailed = useRef(false);
  const lastCreated = useRef<{id:string;type:string;at:number}|null>(null);
  const publish = useCallback((next: FieldReport[]) => {
    rows.current = next;
    setReports([...next].sort((a,b) => b.updated_at.localeCompare(a.updated_at)));
  }, []);
  const persist = useCallback(() => {
    if (!uid.current) return;
    try {
      localStorage.setItem(journalKey(uid.current), JSON.stringify(pending.current));
      storageFailed.current = false;
    } catch {
      storageFailed.current = true;
      setError('Device storage is unavailable. Keep this page open until the server confirms Saved.');
    }
  }, []);

  const flush = useCallback(async () => {
    if (!db || !uid.current) return;
    if (timer.current) clearTimeout(timer.current);
    if (running.current) {
      await running.current;
      if (Object.values(pending.current).some(p=>!p.conflict)) {
        if (timer.current) clearTimeout(timer.current);
        timer.current=setTimeout(()=>{void flush();},0);
      }
      return;
    }
    const sessionUser = uid.current;
    const work = async () => {
      let didSave = false;
      while (uid.current === sessionUser) {
        const entry = Object.values(pending.current).find(item => !item.conflict);
        if (!entry) break;
        if (!navigator.onLine) { setSaveState('Offline changes pending'); return; }
        setSaveState('Saving…');
        const r = entry.report;
        const abort=new AbortController();
        const requestTimeout=setTimeout(()=>abort.abort(),20000);
        try {
          const result = await db.rpc('save_field_report', {
            p_id: r.id, p_expected_revision: entry.expectedRevision,
            p_payload: { form_type:r.form_type, title:r.title || '', status:r.status, answers:r.answers,
              training_data:r.training_data ?? null, oer_data:r.oer_data, executive_summary:r.executive_summary || '', save_token:entry.token }
          }).abortSignal(abort.signal);
          if (uid.current !== sessionUser) return;
          if (result.error) throw result.error;
          const saved = (Array.isArray(result.data) ? result.data[0] : result.data) as FieldReport | undefined;
          if (!saved?.id) throw new Error('The server did not confirm the saved report.');
          didSave = true;
          const current = acknowledgePending(pending.current[r.id],entry.token,saved);
          if (!current) {
            delete pending.current[r.id];
            publish(rows.current.map(row => row.id === r.id ? saved : row));
          } else {
            pending.current[r.id]=current;
            publish(rows.current.map(row => row.id === r.id ? current.report : row));
          }
          persist();
          retryCount.current = 0;
        } catch (cause) {
          if (uid.current !== sessionUser) return;
          const e = cause as {code?: string; message?: string};
          if (e.code === '40001') {
            if (pending.current[r.id]) pending.current[r.id].conflict = true;
            persist();
            setConflicts(Object.keys(pending.current).filter(id => pending.current[id].conflict));
            setError('This report changed in another session. Your local edits are retained. Choose how to resolve the conflict.');
            continue;
          }
          setError(e.message || 'The report could not be saved. Your local changes are pending.');
          setSaveState(navigator.onLine ? 'Unable to save' : 'Offline changes pending');
          if (retry.current) clearTimeout(retry.current);
          retry.current = setTimeout(() => { void flush(); }, Math.min(30000, 1500 * 2 ** retryCount.current++));
          return;
        } finally {clearTimeout(requestTimeout);}
      }
      if (uid.current !== sessionUser) return;
      const stillPending = Object.values(pending.current);
      if(didSave&&!stillPending.length&&!storageFailed.current)setError('');
      setSaveState(stillPending.length ? (navigator.onLine ? 'Unable to save' : 'Offline changes pending') : 'Saved');
    };
    const promise = work();
    running.current = promise;
    try { await promise; } finally { if (running.current === promise) running.current = null; }
  }, [db,persist,publish]);

  useEffect(() => {
    uid.current = userId;
    setReady(false); setReports([]); rows.current=[]; pending.current={}; setActiveId(null); setError(''); setConflicts([]);lastCreated.current=null;
    if (!userId || !db) return;
    let disposed = false;
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(journalKey(userId)) || '{}');
      pending.current=parsePendingJournal(parsed,userId);
      setActiveId(localStorage.getItem(activeKey(userId)));
    } catch { setError('Some local draft data could not be read. Server reports are still available.'); }
    publish(Object.values(pending.current).map(p => p.report));
    setConflicts(Object.keys(pending.current).filter(id => pending.current[id].conflict));
    setSaveState(Object.keys(pending.current).length ? (navigator.onLine ? 'Saving…' : 'Offline changes pending') : 'Saved');
    void (async () => {
      const result = await db.from('visit_reports').select('*').eq('user_id',userId).order('updated_at',{ascending:false});
      if (disposed) return;
      if (result.error) setError(result.error.message);
      else {
        const byId = new Map<string,FieldReport>((result.data || []).map(r => [r.id,{...r,revision:r.revision || 0}]));
        for (const row of rows.current) {const remote=byId.get(row.id);if(!remote||(row.revision||0)>(remote.revision||0))byId.set(row.id,row);}
        for (const p of Object.values(pending.current)) byId.set(p.report.id,p.report);
        publish([...byId.values()]);
      }
      setReady(true);
      void flush();
    })();
    return () => { disposed=true; if (timer.current) clearTimeout(timer.current); if (retry.current) clearTimeout(retry.current); };
  }, [db,userId,flush,publish]);

  useEffect(() => {
    const online = () => { retryCount.current=0; void flush(); };
    const offline = () => { if (Object.keys(pending.current).length) setSaveState('Offline changes pending'); };
    const hidden = () => { if (document.visibilityState === 'hidden') {persist();void flush();} };
    const unload = (event: BeforeUnloadEvent) => {
      persist();
      if (Object.keys(pending.current).length) { event.preventDefault(); event.returnValue=''; }
    };
    window.addEventListener('online',online); window.addEventListener('offline',offline);
    document.addEventListener('visibilitychange',hidden); window.addEventListener('beforeunload',unload);
    return () => {window.removeEventListener('online',online);window.removeEventListener('offline',offline);document.removeEventListener('visibilitychange',hidden);window.removeEventListener('beforeunload',unload);};
  }, [flush,persist]);

  const select = useCallback((id:string | null) => {
    setActiveId(id);
    if (uid.current) {
      try { if (id) localStorage.setItem(activeKey(uid.current),id); else localStorage.removeItem(activeKey(uid.current)); }
      catch { /* Pending data persistence has its own visible error. */ }
    }
  },[]);
  const change = useCallback((report:FieldReport, immediate=false) => {
    const owner=uid.current;
    if (!owner || report.user_id!==owner) return;
    const old=pending.current[report.id];
    const next={...report,updated_at:new Date().toISOString()};
    pending.current[report.id]={report:next,token:crypto.randomUUID(),expectedRevision:old?.expectedRevision ?? report.revision ?? 0,conflict:old?.conflict};
    publish([...rows.current.filter(r => r.id!==report.id),next]);
    persist();
    setSaveState(navigator.onLine ? 'Saving…' : 'Offline changes pending');
    if (timer.current) clearTimeout(timer.current);
    if (immediate) void flush(); else timer.current=setTimeout(() => {void flush();},800);
  },[flush,persist,publish]);
  const changeTraining = useCallback((id:string,training_data:TrainingReport) => {
    const current=rows.current.find(r=>r.id===id);
    if(current)change({...current,training_data});
  },[change]);
  const create = useCallback((type:string) => {
    if (!uid.current) return;
    const previous=lastCreated.current;
    if(previous&&previous.type===type&&Date.now()-previous.at<1000){select(previous.id);return rows.current.find(r=>r.id===previous.id);}
    const now=new Date().toISOString();
    const r:FieldReport={id:crypto.randomUUID(),user_id:uid.current,form_type:type,title:'',status:'draft',answers:{},training_data:type==='Improvement Training Record'?emptyTrainingReport():null,oer_data:type==='Operational Excellence Review'?emptyReport():null,executive_summary:'',created_at:now,updated_at:now,revision:0};
    lastCreated.current={id:r.id,type,at:Date.now()};
    change(r,true);select(r.id);
    return r;
  },[change,select]);
  const remove = useCallback(async (r:FieldReport) => {
    if (!db || !uid.current) return;
    await flush();
    if (pending.current[r.id]) {setError('Save or resolve this report’s pending changes before deleting it.');return;}
    const result=await db.from('visit_reports').delete().eq('id',r.id).eq('user_id',uid.current);
    if (result.error) {setError(result.error.message);return;}
    publish(rows.current.filter(row=>row.id!==r.id));
    if(r.training_data?.attachments.length){
      const paths=r.training_data.attachments.map(a=>a.path).filter(path=>path.startsWith(`${uid.current}/${r.id}/`));
      if(paths.length){const cleanup=await db.storage.from('training-evidence').remove(paths);if(cleanup.error)setError('Report deleted. Some private evidence files could not be removed; contact your storage administrator for cleanup.');}
    }
    if (activeId===r.id) select(null);
  },[db,flush,publish,activeId,select]);
  const resolveConflict = useCallback(async (id:string, choice:'server'|'copy') => {
    if (!db || !uid.current) return;
    const local=pending.current[id];
    if (!local) return;
    const result=await db.from('visit_reports').select('*').eq('id',id).eq('user_id',uid.current).maybeSingle();
    if (result.error) {setError(result.error.message);return;}
    delete pending.current[id];persist();
    publish([...rows.current.filter(r=>r.id!==id),...(result.data?[result.data as FieldReport]:[])]);
    if (choice==='copy') {
      const now=new Date().toISOString();
      const copy={...local.report,...(local.report.training_data?{training_data:{...local.report.training_data,attachments:[]}}:{}),id:crypto.randomUUID(),title:`${local.report.title || local.report.form_type} (local copy)`,status:'draft' as const,revision:0,created_at:now,updated_at:now,completed_at:null};
      change(copy,true);select(copy.id);
    }
    setConflicts(Object.keys(pending.current).filter(key=>pending.current[key].conflict));setError('');
    if (choice==='server') {setSaveState(Object.keys(pending.current).length?'Saving…':'Saved');void flush();}
  },[db,persist,publish,change,select,flush]);
  return {reports,changeTraining,active:reports.find(r=>r.id===activeId),activeId,select,create,change,remove,flush,saveState,error,setError,ready,conflicts,resolveConflict};
}
