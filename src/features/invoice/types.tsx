import type {components} from '@/lib/api/schema';
export type Invoice=components['schemas']['Invoice'];
export type Context=components['schemas']['UserContext'];
export const statuses={draft:'Draft',issued:'Issued',sent:'Sent',partially_paid:'Partially paid',paid:'Paid',overdue:'Overdue'};
export const methods={bank_transfer:'Bank transfer',cash:'Cash',card:'Card',other:'Other'};
export const message=(e:unknown)=>e instanceof Error?e.message:'Could not complete the request.';
export const money=(currency:string,value:string)=>{const [whole,fraction='']=value.split('.');return `${currency} ${BigInt(whole).toLocaleString()}.${fraction.padEnd(2,'0')}`;};
export const today=()=>new Date().toISOString().slice(0,10);
export function Status({status}:{status:Invoice['status']}){return <span className={`status-badge invoice-${status}`}><span/>{statuses[status]}</span>}
