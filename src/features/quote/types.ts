import type {components} from '@/lib/api/schema';
export type Quote=components['schemas']['Quote'];
export type QuoteInput=components['schemas']['QuoteInput'];
export type ItemInput=components['schemas']['QuoteItemInput'];
export type Product=components['schemas']['Product'];
export type Context=components['schemas']['UserContext'];
export {errorMessage} from '@/features/customer/types';
export {amount} from '@/features/opportunity/types';
export const statuses=['draft','submitted','approved','rejected','sent','accepted'] as const;
export function preview(items:ItemInput[]){let subtotal=0n,discount=0n;const scaled=(s:string,n:number)=>{const [whole,fraction='']=s.split('.');return BigInt(whole+fraction.padEnd(n,'0'));};const money=(n:bigint)=>`${n/100n}.${String(n%100n).padStart(2,'0')}`;try{for(const i of items){if(!/^(0|[1-9][0-9]{0,6})(\.[0-9]{1,3})?$/.test(i.quantity)||!/^(0|[1-9][0-9]{0,11})(\.[0-9]{1,2})?$/.test(i.unitPrice)||!/^(0|[1-9][0-9]?|100)(\.[0-9]{1,2})?$/.test(i.discountPercent))return null;const qty=scaled(i.quantity,3),pct=scaled(i.discountPercent,2);if(qty===0n||pct>10000n)return null;const gross=(qty*scaled(i.unitPrice,2)+500n)/1000n;subtotal+=gross;discount+=(gross*pct+5000n)/10000n;}return {subtotal:money(subtotal),discount:money(discount),total:money(subtotal-discount)};}catch{return null;}}
