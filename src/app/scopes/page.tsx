import Workspace from '@/components/workspace';
export default async function Page({searchParams}:{searchParams:Promise<{opportunityId?:string;customerId?:string}>}){const q=await searchParams;return <Workspace initialView="scopes" opportunityId={q.opportunityId} customerId={q.customerId}/>;}
