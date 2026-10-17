"use client";
import { useEffect, useState, type FormEvent } from "react";
import type { components } from "@/lib/api/schema";
import { api } from "@/lib/api/client";
import {useWorkspaceContext} from "@/components/workspace-frame";
import {DocumentList,DocumentDetail} from "@/features/document/documents";
import BusinessDashboard from "@/features/dashboard/overview";
import Notifications from "@/features/notification/inbox";
import ScopeList from "@/features/scope/scope-list";
import ScopeDetail from "@/features/scope/scope-detail";
import InvoiceList from "@/features/invoice/invoice-list";
import InvoiceDetail from "@/features/invoice/invoice-detail";
import ProjectList from "@/features/project/project-list";
import ProjectDetail from "@/features/project/project-detail";
import QuoteList from "@/features/quote/quote-list";
import QuoteDetail from "@/features/quote/quote-detail";
import ProductList from "@/features/product/product-list";
import OpportunityList from "@/features/opportunity/opportunity-list";
import OpportunityDetail from "@/features/opportunity/opportunity-detail";
import CustomerList from "@/features/customer/customer-list";
import CustomerDetail from "@/features/customer/customer-detail";

type User = components["schemas"]["User"];
type Audit = components["schemas"]["Audit"];
type CreateUser = components["schemas"]["CreateUser"];
const roleLabels: Record<CreateUser["role"], string> = {
 organization_admin: "Organization Admin", sales_manager: "Sales Manager", sales_user: "Sales User", delivery_user: "Delivery User", finance_user: "Finance User", executive: "Executive",
};
function message(error: unknown) { return error instanceof Error ? error.message : "Could not complete the request. Please try again."; }
type View = "overview" | "users" | "audit" | "customers" | "opportunities" | "products" | "quotes" | "projects" | "finance" | "scopes" | "documents" | "notifications";
export default function Workspace({ initialView = "overview", customerId, opportunityId, quoteId, projectId, invoiceId, scopeId, documentId }: { initialView?: View; customerId?: string; opportunityId?: string; quoteId?: string; projectId?: string; invoiceId?: string; scopeId?: string; documentId?: string }) {
 const tab = initialView;
 const context = useWorkspaceContext();
 const [revision,setRevision] = useState(0);
 const [error, setError] = useState("");
 const [users, setUsers] = useState<User[]>([]);
 const [audit, setAudit] = useState<Audit[]>([]);
 const [page, setPage] = useState(1);
 const [total, setTotal] = useState(0);
 const [busy, setBusy] = useState(false);
 const [notice, setNotice] = useState("");
 useEffect(() => {
  if (!context || (tab !== "users" && tab !== "audit")) return;
  let active = true;
  async function load() {
   try {
    if (tab === "users") {
     const { data, error } = await api.GET("/api/v1/users", { params: { query: { page, pageSize: 25 } } });
     if (error) throw new Error(error.error.message);
     if (active) { setUsers(data.data); setTotal(data.meta.total); }
    } else {
     const { data, error } = await api.GET("/api/v1/audit-logs", { params: { query: { page, pageSize: 25 } } });
     if (error) throw new Error(error.error.message);
     if (active) { setAudit(data.data); setTotal(data.meta.total); }
    }
   } catch (err) { if (active) setError(message(err)); }
   finally { if (active) setBusy(false); }
  }
  void load();
  return () => { active = false; };
 }, [context, tab, page, revision]);
 async function createUser(event: FormEvent<HTMLFormElement>) {
  event.preventDefault(); setBusy(true); setError(""); setNotice("");
  const form = event.currentTarget; const fields = new FormData(form);
  try {
   const body: CreateUser = { subject: String(fields.get("subject")), name: String(fields.get("name")), email: String(fields.get("email")), role: fields.get("role") as CreateUser["role"] };
   const { error } = await api.POST("/api/v1/users", { body });
   if (error) throw new Error(error.error.message);
   form.reset(); setNotice("User added to your organization."); setPage(1); setRevision(value=>value+1);
  } catch (err) { setError(message(err)); }
  finally { setBusy(false); }
 }

 return <>
 {(tab==='overview'||tab==='users'||tab==='audit')&&<div className="page-heading"><div><div className="page-eyebrow">{tab==='overview'?'Your workspace':'Administration'}</div><h1>{tab==='overview'?`Welcome, ${context.user.name.split(' ')[0]}`:tab==='users'?'Your team':'Audit log'}</h1><p>{tab==='overview'?'Your pipeline, balances and next steps in one place.':tab==='users'?'Manage the people who make your business happen.':'A clear record of activity in your organization.'}</p></div></div>}
  {error && <p role="alert" className="mb-6 rounded-lg bg-red-50 p-4 text-red-800">{error}</p>}{notice && <p role="status" className="mb-6 rounded-lg bg-emerald-50 p-4 text-emerald-800">{notice}</p>}
  {tab==='overview' && <BusinessDashboard context={context}/>}
  {tab==='notifications' && <Notifications/>}
  {tab==='documents'&&(context.permissions.includes('document.read')?(documentId?<DocumentDetail key={documentId} id={documentId} context={context}/>:<DocumentList context={context}/>):<p role="alert">You do not have access to documents.</p>)}
  {tab==='scopes'&&(context.permissions.includes('scope.read')?(scopeId?<ScopeDetail key={scopeId} id={scopeId} context={context}/>:<ScopeList context={context} opportunityId={opportunityId} customerId={customerId}/>):<p role="alert">You do not have access to service scopes.</p>)}
  {tab==='finance'&&(context.permissions.includes('invoice.read')?(invoiceId?<InvoiceDetail key={invoiceId} id={invoiceId} context={context}/>:<InvoiceList context={context} quoteId={quoteId} projectId={projectId} customerId={customerId}/>):<p role="alert">You do not have access to finance.</p>)}
  {tab==='projects'&&(context.permissions.includes('project.read')?(projectId?<ProjectDetail id={projectId} context={context}/>:<ProjectList context={context}/>):<p role="alert">You do not have access to delivery projects.</p>)}
  {tab==='products'&&(context.permissions.includes('product.read')?<ProductList context={context}/>:<p role="alert">You do not have access to products.</p>)}
  {tab==='quotes'&&(context.permissions.includes('quote.read')?(quoteId?<QuoteDetail id={quoteId} context={context}/>:<QuoteList context={context}/>):<p role="alert">You do not have access to quotes.</p>)}
  {tab==='opportunities' && (context.permissions.includes('opportunity.read') ? (opportunityId ? <OpportunityDetail key={opportunityId} id={opportunityId} context={context}/> : <OpportunityList context={context}/>) : <p role="alert">You do not have permission to view opportunities.</p>)}
  {tab==='customers' && (context.permissions.includes('customer.read') ? (customerId ? <CustomerDetail key={customerId} id={customerId} context={context}/> : <CustomerList context={context}/>) : <p role="alert">You do not have permission to view customers.</p>)}
  {tab==='users' && <><section className="card mb-6"><h2 className="text-lg font-semibold">Add a team member</h2><p className="mt-2 text-sm leading-6 text-slate-500">Create the account in Keycloak first, then enter its user ID to grant access to this organization.</p><form onSubmit={createUser} className="mt-5 grid gap-4 md:grid-cols-2"><label className="label">Full name<input className="field" name="name" required maxLength={200} /></label><label className="label">Email<input className="field" name="email" type="email" required maxLength={254} /></label><label className="label">Keycloak user ID<input className="field" name="subject" required maxLength={200} /></label><label className="label">Role<select className="field" name="role" defaultValue="sales_user">{Object.entries(roleLabels).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label><div><button className="button" disabled={busy}>Add user</button></div></form></section><section className="card overflow-x-auto"><h2 className="mb-5 text-lg font-semibold">Team members</h2><table className="w-full text-left text-sm"><thead className="border-b border-slate-200 text-slate-500"><tr><th className="pb-3 pr-5">Name</th><th className="pb-3 pr-5">Email</th><th className="pb-3">Role</th></tr></thead><tbody>{users.map(user => <tr key={user.id} className="border-b border-slate-100"><td className="py-4 pr-5 font-medium">{user.name}</td><td className="py-4 pr-5">{user.email}</td><td className="py-4">{user.roles.map(role => roleLabels[role as CreateUser['role']] ?? role).join(', ')}</td></tr>)}</tbody></table>{busy && <p role="status" className="py-5 text-slate-500">Loading team members…</p>}{!busy&&!users.length && <p className="py-5 text-slate-500">No team members on this page.</p>}</section></>}
  {tab==='audit' && <section className="card overflow-x-auto"><h2 className="mb-5 text-lg font-semibold">Recent account activity</h2><table className="w-full text-left text-sm"><thead className="border-b text-slate-500"><tr><th className="pb-3 pr-5">Action</th><th className="pb-3 pr-5">Time</th><th className="pb-3">Request reference</th></tr></thead><tbody>{audit.map(item => <tr key={item.id} className="border-b border-slate-100"><td className="py-4 pr-5 font-medium">{item.action}</td><td className="py-4 pr-5">{new Date(item.createdAt).toLocaleString()}</td><td className="py-4 font-mono text-xs">{item.requestId}</td></tr>)}</tbody></table>{busy&&<p role="status" className="py-5">Loading activity…</p>}{!busy&&!audit.length&&<p className="py-5 text-slate-500">No activity on this page.</p>}</section>}
  {(tab==='users'||tab==='audit') && <div className="mt-5 flex items-center justify-between text-sm"><span>{total} records · Page {page}</span><div className="flex gap-2"><button className="secondary disabled:opacity-40" disabled={page===1||busy} onClick={()=>{setBusy(true);setPage(page-1);}}>Previous</button><button className="secondary disabled:opacity-40" disabled={page*25>=total||busy} onClick={()=>{setBusy(true);setPage(page+1);}}>Next</button></div></div>}
  </>;
}
