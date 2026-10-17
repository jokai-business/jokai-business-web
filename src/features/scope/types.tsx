import type {components} from '@/lib/api/schema';
export type Scope=components['schemas']['ServiceScope'];
export type Contribution=components['schemas']['ScopeContribution'];
export type Context=components['schemas']['UserContext'];
export type Review=components['schemas']['ScopeReview'];
export const statuses={draft:'Draft',in_review:'In review',changes_requested:'Changes requested',approved:'Approved'};
export const actions={submit:'Submitted for review',approve:'Approved','request-changes':'Changes requested',revise:'New draft revision started'};
export const message=(e:unknown)=>e instanceof Error?e.message:'Could not complete the request.';
export const editable=(s:Scope)=>s.status==='draft'||s.status==='changes_requested';
export function Status({status}:{status:Scope['status']}){return <span className={`status-badge scope-${status}`}><span/>{statuses[status]}</span>}
