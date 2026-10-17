'use client';

import {useEffect, useState, type FormEvent} from 'react';
import {api} from '@/lib/api/client';
import InvoiceCapture from './invoice-capture';
import type {components} from '@/lib/api/schema';

type OCR = components['schemas']['DocumentOCR'];
const labels: Record<OCR['status'],string> = {not_requested:'Not requested',queued:'Queued',processing:'Extracting text',ready:'Needs text review',failed:'Extraction failed',approved:'Text approved',rejected:'Text rejected'};
const message=(e:unknown)=>e instanceof Error?e.message:'Could not complete the request.';
export default function OCRReview({id,accepted,canReview,isPDF}:{id:string;accepted:boolean;canReview:boolean;isPDF:boolean}){
 const [ocr,setOCR]=useState<OCR>(),[error,setError]=useState(''),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0),[notice,setNotice]=useState(''),[language,setLanguage]=useState<'en'|'km+en'|''>('');
 useEffect(()=>{
  let active=true;let timer:ReturnType<typeof setTimeout>|undefined;
  async function load(){
   try{const {data,error}=await api.GET('/api/v1/documents/{id}/ocr',{params:{path:{id}}});if(error)throw new Error(error.error.message);if(active){setOCR(data.data);setError('');if(['queued','processing'].includes(data.data.status))timer=setTimeout(load,4000);}}
   catch(e){if(active)setError(message(e));}
  }
  void load();return()=>{active=false;clearTimeout(timer);};
 },[id,revision]);
 async function request(){if(!ocr)return;setBusy(true);setError('');setNotice('');try{const {error}=await api.POST('/api/v1/documents/{id}/ocr',{params:{path:{id}},body:{version:ocr.version,language:language||(ocr.languages?.includes(ocr.language)?ocr.language:ocr.languages?.[0])||'en'}});if(error)throw new Error(error.error.message);setRevision(v=>v+1);setNotice('Extraction queued. You can leave this page and return later.');}catch(e){setError(message(e));}finally{setBusy(false);}}
 async function review(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!ocr)return;const form=new FormData(e.currentTarget);if(form.get('confirmed')!=='on'){setError('Confirm that you checked the original.');return;}const text=String(form.get('text'));if(new TextEncoder().encode(text).length>8000){setError('Reviewed text must be 8,000 UTF-8 bytes or fewer.');return;}
  setBusy(true);setError('');setNotice('');try{const {error}=await api.POST('/api/v1/documents/{id}/ocr/review',{params:{path:{id}},body:{version:ocr.version,status:String(form.get('decision')) as 'approved'|'rejected',text,note:String(form.get('note')),confirmed:true}});if(error)throw new Error(error.error.message);setRevision(v=>v+1);setNotice('Text review recorded.');}catch(e){setError(message(e));}finally{setBusy(false);}
 }
 return <><section className="card" aria-label="Document text extraction"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Extracted text</h2>{ocr&&<span className="status-badge">{labels[ocr.status]}</span>}</div>
 <p className="mt-3 text-sm leading-6 text-slate-500">Choose the document language, extract text locally, then compare it with the downloaded original. Text approval saves a reviewed copy for your team; it does not create or approve an invoice.</p>
 {isPDF&&<p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">OCR processes up to 10 pages. Verify the page count and all text against the original, including blank or unreadable pages. Split longer documents before uploading.</p>}
 {error&&<p role="alert" className="finance-error mt-4">{error}</p>}{notice&&<p role="status" className="mt-4 text-sm text-emerald-800">{notice}</p>}
 {!ocr&&!error&&<p className="mt-4 text-sm">Loading extraction status…</p>}
 {ocr&&<>
 {!ocr.available&&<p className="mt-4 text-sm text-slate-500">Text extraction is not configured. An administrator needs to configure an OCR service.</p>}
 {!accepted&&ocr.status==='not_requested'&&<p className="mt-4 text-sm text-slate-500">Accept the document intake before requesting extraction.</p>}
 <p className="mt-3 text-xs leading-5 text-slate-500">Khmer recognition is experimental. Check spelling, vowel signs, names and amounts against the original. Invoice field suggestions currently recognize English labels only.</p>
 {ocr.failure&&<p className="mt-4 text-sm text-amber-900">{ocr.failure}</p>}
 {canReview&&accepted&&['not_requested','failed'].includes(ocr.status)&&<label className="label mt-4">Document language<select className="field" disabled={busy||!ocr.available} value={language||(ocr.languages?.includes(ocr.language)?ocr.language:ocr.languages?.[0])||'en'} onChange={e=>setLanguage(e.target.value as 'en'|'km+en')}>{(ocr.languages??['en']).map(l=><option key={l} value={l}>{l==='km+en'?'Khmer + English (Tesseract)':'English (PaddleOCR)'}</option>)}</select></label>}
 {canReview&&accepted&&['not_requested','failed'].includes(ocr.status)&&<button className="button mr-3 mt-4" disabled={busy||!ocr.available||ocr.attempts>=3} onClick={()=>void request()}>{ocr.status==='failed'?'Retry extraction':'Extract text'}</button>}
 {ocr.attempts>=3&&ocr.status==='failed'&&<p className="mt-3 text-sm">The three-attempt limit has been reached. Upload a corrected source to start again.</p>}
 {ocr.rawText&&<><p className="mt-4 text-xs text-slate-500">{ocr.engine} · {ocr.language==='km+en'?'Khmer + English':'English'} · {ocr.pages} processed {ocr.pages===1?'page':'pages'} · Original extraction retained</p><details className="mt-4"><summary className="cursor-pointer text-sm font-medium">Original OCR text</summary><pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-4 text-sm font-sans">{ocr.rawText}</pre></details></>}
 {ocr.status==='ready'&&(canReview?<form key={ocr.version} className="mt-5 space-y-4" onSubmit={review}><label className="label">Corrected text<textarea className="field" name="text" rows={10} maxLength={8000} defaultValue={ocr.rawText}/></label><p className="text-xs text-slate-500">Maximum 8,000 UTF-8 bytes. Check numbers, dates, currencies and missing lines carefully.</p><label className="label">Text decision<select name="decision" className="field"><option value="approved">Approve reviewed text</option><option value="rejected">Reject extracted text</option></select></label><label className="label">Text review note<textarea name="note" className="field" rows={3} maxLength={2000} placeholder="Required when rejecting"/></label><label className="flex items-start gap-3 text-sm"><input className="mt-1" name="confirmed" type="checkbox" required/>I compared the text and page count with the original and confirm this decision.</label><button className="button" disabled={busy}>Save text review</button></form>:<p className="mt-4 text-sm text-slate-500">Waiting for an authorized document reviewer.</p>)}
 {['approved','rejected'].includes(ocr.status)&&<div className="mt-5 rounded-lg bg-slate-50 p-4"><p className="text-sm font-medium">{ocr.reviewerName} · {ocr.reviewedAt&&new Date(ocr.reviewedAt).toLocaleString()}</p>{ocr.reviewedText&&<p className="mt-3 whitespace-pre-wrap break-words text-sm">{ocr.reviewedText}</p>}{ocr.reviewNote&&<p className="mt-3 whitespace-pre-wrap break-words text-sm">{ocr.reviewNote}</p>}</div>}
 </>}
 <button className="secondary mt-4" disabled={busy} onClick={()=>setRevision(v=>v+1)}>Refresh extraction status</button>
 </section>{ocr?.status==='approved'&&<InvoiceCapture key={`${id}:${ocr.version}`} id={id} canReview={canReview}/>}</>;
}
