"use client";
import {useEffect,useState} from 'react';
import {api} from '@/lib/api/client';
import type {components} from '@/lib/api/schema';
import {errorMessage} from './types';
type Owner=components['schemas']['CustomerOwner'];
export default function OwnerSelect({initial,label="Owner",name="ownerId",allowUnassigned=false}:{initial:Owner;label?:string;name?:string;allowUnassigned?:boolean}){
 const [owners,setOwners]=useState<Owner[]>([initial]);const [page,setPage]=useState(1);const [total,setTotal]=useState(0);const [busy,setBusy]=useState(true);const [error,setError]=useState('');const [value,setValue]=useState(initial.id);
 useEffect(()=>{let active=true;api.GET('/api/v1/customer-owners',{params:{query:{page,pageSize:25}}}).then(({data,error})=>{if(error)throw new Error(error.error.message);if(active){setOwners(previous=>Array.from(new Map([...previous,...data.data].map(owner=>[owner.id,owner])).values()));setTotal(data.meta.total);}}).catch(err=>{if(active)setError(errorMessage(err));}).finally(()=>{if(active)setBusy(false);});return()=>{active=false;};},[page]);
 return <div><label className="label">{label}<select aria-label={label} name={name} className="field" value={value} onChange={e=>setValue(e.target.value)}>{allowUnassigned&&!owners.some(o=>!o.id)&&<option value="">Unassigned</option>}{owners.map(owner=><option key={owner.id} value={owner.id}>{owner.name}</option>)}</select></label>{page*25<total&&<button type="button" disabled={busy} className="mt-2 text-sm text-blue-700 underline" onClick={()=>{setBusy(true);setError('');setPage(p=>p+1);}}>Show more team members</button>}{error&&<p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}</div>;
}
