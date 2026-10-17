import Workspace from '@/components/workspace';
export default async function Page({searchParams}:{searchParams:Promise<{quoteId?:string;projectId?:string;customerId?:string}>}){const q=await searchParams;return <Workspace initialView="finance" quoteId={q.quoteId} projectId={q.projectId} customerId={q.customerId}/>;}
