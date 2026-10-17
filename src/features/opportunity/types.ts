import type {components} from '@/lib/api/schema';
export type Opportunity=components['schemas']['Opportunity'];
export type OpportunityInput=components['schemas']['OpportunityInput'];
export type Stage=components['schemas']['Stage'];
export type Context=components['schemas']['UserContext'];
export {errorMessage} from '@/features/customer/types';
export function amount(value:string,currency:string){const [whole,fraction='']=value.split('.');return `${currency} ${Number(whole).toLocaleString()}.${fraction.padEnd(2,'0')}`;}
export function closeDate(value:string){return value?new Date(value+'T12:00:00').toLocaleDateString():'No close date';}
