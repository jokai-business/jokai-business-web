import type {components} from '@/lib/api/schema';
export type Project=components['schemas']['Project'];
export type ProjectInput=components['schemas']['ProjectInput'];
export type Task=components['schemas']['ProjectTask'];
export type TaskInput=components['schemas']['TaskInput'];
export type Source=components['schemas']['ProjectSource'];
export type Context=components['schemas']['UserContext'];
export type Origin={id:string;title:string;quoteId?:string;eligible:boolean};
export {errorMessage} from '@/features/customer/types';
export const projectStatuses={not_started:'Not started',in_progress:'In progress',blocked:'Blocked',completed:'Completed'} as const;
export const taskStatuses={todo:'To do',in_progress:'In progress',done:'Done'} as const;
export const priorities={low:'Low',normal:'Normal',high:'High',urgent:'Urgent'} as const;
export function dateLabel(value:string){return value?new Date(value+'T12:00:00').toLocaleDateString():'Not set';}
