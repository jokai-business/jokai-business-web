"use client";
import { useState, type FormEvent } from "react";
import Icon from "@/components/ui/icon";
import OwnerSelect from "./owner-select";
import { api } from "@/lib/api/client";
import { type Customer, type Context, type CustomerInput, errorMessage } from "./types";
export default function CustomerForm({ customer, context, onSaved, onCancel }: { customer?: Customer; context: Context; onSaved: (customer: Customer) => void; onCancel: () => void }) {
 const [busy,setBusy]=useState(false); const [error,setError]=useState("");
 async function submit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();setBusy(true);setError("");const f=new FormData(event.currentTarget);
  const body: CustomerInput={name:String(f.get('name')),email:String(f.get('email')),phone:String(f.get('phone')),website:String(f.get('website')),industry:String(f.get('industry')),country:String(f.get('country')),status:f.get('status') as CustomerInput['status'],notes:String(f.get('notes')),ownerId:String(f.get("ownerId"))};
  try {
   const result=customer ? await api.PATCH('/api/v1/customers/{id}',{params:{path:{id:customer.id}},body:{...body,version:customer.version}}) : await api.POST('/api/v1/customers',{body});
   if(result.error)throw new Error(result.error.error.message);onSaved(result.data.data);
  }catch(err){setError(errorMessage(err));}finally{setBusy(false);}
 }
 return <div className="customer-form-shell"><div className="form-top"><div><p className="page-eyebrow">Customer relationships</p><h1 className="form-title">{customer?'Edit customer':'New customer'}</h1></div><button className="secondary" onClick={onCancel} disabled={busy}><Icon name="left" size={16}/>Back</button></div>{error&&<p role="alert" className="mb-5 rounded-lg bg-red-50 p-4 text-sm text-red-800">{error}</p>}
 <form onSubmit={submit} className="customer-surface"><section className="form-section"><h2 className="form-section-title">Company details</h2><p className="form-section-subtitle">The essentials for a complete customer profile.</p><div className="form-grid">
 <label className="label md:col-span-2">Customer name <span aria-hidden="true" className="text-violet-500">*</span><input aria-label="Customer name" name="name" className="field" placeholder="e.g. Acme Corporation" required maxLength={200} defaultValue={customer?.name} autoFocus /></label>
 <label className="label">Industry<input name="industry" className="field" placeholder="e.g. Technology" maxLength={100} defaultValue={customer?.industry}/></label>
 <label className="label">Country<input name="country" className="field" placeholder="e.g. Cambodia" maxLength={100} defaultValue={customer?.country}/></label>
 <label className="label md:col-span-2">Website<input name="website" type="url" placeholder="https://example.com" className="field" maxLength={2048} defaultValue={customer?.website}/></label>
 </div></section><section className="form-section"><h2 className="form-section-title">Contact & ownership</h2><p className="form-section-subtitle">Make it easy for your team to stay connected.</p><div className="form-grid">
 <label className="label">Email<input name="email" type="email" className="field" placeholder="hello@example.com" maxLength={254} defaultValue={customer?.email}/></label>
 <label className="label">Phone<input name="phone" className="field" placeholder="+855 …" maxLength={50} defaultValue={customer?.phone}/></label>
 <OwnerSelect initial={{id:customer?.ownerId??context.user.id,name:customer?.ownerName??context.user.name}}/>
 <label className="label">Status<select aria-label="Status" name="status" className="field" defaultValue={customer?.status??'prospect'}><option value="prospect">Prospect</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
 <label className="label md:col-span-2">Notes<textarea aria-label="Notes" name="notes" placeholder="Useful context for your team…" className="field min-h-28" maxLength={10000} defaultValue={customer?.notes}/></label>
 </div></section><div className="form-actions"><button className="secondary" type="button" onClick={onCancel} disabled={busy}>Cancel</button><button className="button" disabled={busy}>{busy?'Saving…':<><Icon name="check" size={16}/>Save customer</>}</button></div></form></div>;
}
