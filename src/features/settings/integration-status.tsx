'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {api} from '@/lib/api/client';
import type {components} from '@/lib/api/schema';
type Status=components['schemas']['IntegrationStatus'];
const labels:Record<keyof Status,string>={storageBackend:'Document storage',ai:'AI provider',gmail:'Gmail OAuth',email:'Email delivery',ocr:'English OCR',khmerOcr:'Khmer OCR (experimental)',drive:'Google Drive',telegram:'Telegram'};
const display:Record<string,string>={local:'Local private storage',s3:'S3 storage',configured:'Configured',not_configured:'Not configured',unavailable:'Unavailable'};
export default function IntegrationStatus(){
 const [value,setValue]=useState<Status>(),[error,setError]=useState(''),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0);
 useEffect(()=>{let active=true;api.GET('/api/v1/settings/integrations').then(r=>{if(r.error)throw new Error(r.error.error.message);if(active)setValue(r.data.data);}).catch(e=>{if(active)setError(e instanceof Error?e.message:'Could not load integration status.');}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[revision]);
 return <section className="card my-6" aria-label="Integration status"><h2 className="text-lg font-semibold">Integrations & storage</h2><p className="mt-3 text-sm text-slate-500">Deployment configuration shared across organizations. Configured does not confirm service health, account connection or successful delivery. Credentials are managed by your deployment administrator.</p>{loading&&<p role="status" className="mt-4">Loading integration status…</p>}{error&&<p role="alert" className="finance-error mt-4">{error}</p>}{value&&<dl className="mt-5 grid gap-4 sm:grid-cols-2">{(Object.keys(labels) as (keyof Status)[]).map(key=><div key={key} className="rounded-lg border border-slate-200 p-3"><dt className="font-medium">{labels[key]}</dt><dd className="mt-1 text-sm text-slate-600">{display[value[key]]}</dd></div>)}</dl>}<p className="mt-4 text-sm text-slate-500">Gmail connections are personal. Manage your own account on the <Link href="/gmail" className="underline">Gmail page</Link>. Review email configuration and explicit test sends in <Link href="/settings/email" className="underline">Email delivery</Link>. Drive and Telegram are not yet implemented.</p><button className="secondary mt-4" disabled={loading} onClick={()=>{setValue(undefined);setError('');setLoading(true);setRevision(v=>v+1);}}>Refresh integration status</button></section>;
}
