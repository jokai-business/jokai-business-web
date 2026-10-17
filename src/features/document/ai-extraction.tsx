'use client';
import {useEffect,useState} from 'react';
import {api} from '@/lib/api/client';
import type {components} from '@/lib/api/schema';
type View=components['schemas']['ExtractionView'];
type Suggestion=components['schemas']['ExtractionSuggestion'];
export default function AIExtraction({id,disabled,onApply}:{id:string;disabled:boolean;onApply:(suggestion:Suggestion,version:number)=>void}){
 const [open,setOpen]=useState(false);
 return <div className="mt-5 rounded-xl border border-slate-200 p-4" aria-label="AI invoice extraction" role="region">
 <button className="secondary" aria-expanded={open} onClick={()=>setOpen(!open)}>{open?'Close AI extraction':'Preview AI extraction'}</button>
 <p className="mt-3 text-sm text-slate-500">Optional AI suggestions from approved text. Review source evidence before applying them to your field draft.</p>
 {open&&<Panel id={id} disabled={disabled} onApply={onApply}/>}
 </div>;
}
function Panel({id,disabled,onApply}:{id:string;disabled:boolean;onApply:(s:Suggestion,v:number)=>void}){
 const [view,setView]=useState<View>(),[error,setError]=useState(''),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0);
 useEffect(()=>{let active=true,pending=false;async function load(){if(pending)return;pending=true;try{const r=await api.GET('/api/v1/documents/{id}/ai-extraction',{params:{path:{id}}});if(r.error)throw new Error(r.error.error.message);if(active)setView(r.data.data);}catch(e){if(active){setView(undefined);setError(e instanceof Error?e.message:'Could not load extraction.');}}finally{pending=false;}}void load();const timer=setInterval(()=>{if(document.visibilityState==='visible')void load();},5000);return()=>{active=false;clearInterval(timer);};},[id,revision]);
 async function generate(){if(!view||busy)return;if(!window.confirm(`Send the previewed approved document text to ${view.provider} (${view.model}) for invoice-field suggestions? This may incur provider charges.`))return;setBusy(true);setError('');try{const r=await api.POST('/api/v1/documents/{id}/ai-extraction',{params:{path:{id}},body:{version:view.result?.version??0,sourceHash:view.sourceHash,provider:view.provider,model:view.model,confirmed:true}});if(r.error)throw new Error(r.error.error.message);}catch(e){setError(e instanceof Error?e.message:'Could not request extraction.');}finally{setBusy(false);setRevision(v=>v+1);}}
 const result=view?.result,pending=result&&['queued','processing'].includes(result.status);
 let suggestion:Suggestion|undefined;
 if(result?.status==='ready'&&!result.stale){try{suggestion=JSON.parse(result.output) as Suggestion;}catch{/* A malformed response must never populate the form. */}}
 return <div className="mt-4 space-y-4">
 {error&&<p role="alert" className="finance-error">{error}</p>}
 {!view&&!error&&<p role="status">Loading approved text…</p>}
 {view&&<>
 <p className="text-sm">{view.available?`Provider: ${view.provider} · Model: ${view.model}`:'AI extraction is not configured. Ask your deployment administrator to configure a provider.'}</p>
 <details><summary className="cursor-pointer text-sm">Approved text sent to AI</summary><pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs">{view.context.text}</pre></details>
 {pending&&<p role="status">Extracting invoice suggestions…</p>}
 {result?.stale&&<p className="text-sm text-amber-800">The approved source changed. Previous AI suggestions are hidden.</p>}
 {result?.status==='failed'&&<p className="text-sm text-amber-800">Extraction failed, returned invalid fields or was interrupted. Review the source before retrying; the previous attempt may have incurred charges.</p>}
 {suggestion&&<><p className="text-xs text-slate-500">AI suggestions · {result?.provider} · {result?.model} · {result?.promptVersion}</p><dl className="space-y-3">{Object.entries(suggestion.fields).map(([key,value])=><div key={key}><dt className="text-sm font-medium">{key}</dt><dd className="break-words text-sm">{value||'Not found'}</dd>{suggestion.evidence[key as keyof Suggestion['evidence']]&&<dd className="mt-1 whitespace-pre-wrap break-words text-xs text-slate-500">Source: {suggestion.evidence[key as keyof Suggestion['evidence']]}</dd>}</div>)}</dl><button className="secondary" disabled={disabled||busy} onClick={()=>{if(window.confirm('Replace the current form fields with these AI suggestions? Saving the draft will share the suggestions and provider details with authorized document readers.'))onApply(suggestion!,result!.version);}}>Apply suggestions to form</button><p className="text-xs text-slate-500">Applying changes only this form. Check every field, save the draft, then separately confirm recording.</p></>}
 {(!result||result.stale||result.status==='failed')&&<button className="button" disabled={disabled||busy||!view.available||!!pending} onClick={()=>void generate()}>Generate AI suggestions</button>}
 </>}
 <button className="secondary" disabled={busy} onClick={()=>{setError('');setRevision(v=>v+1);}}>Reload AI extraction</button>
 </div>;
}
