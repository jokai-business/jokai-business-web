import Workspace from "@/components/workspace";
export default async function QuotePage({params}:{params:Promise<{id:string}>}){const {id}=await params;return <Workspace initialView="quotes" quoteId={id}/>;}
