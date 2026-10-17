import Workspace from "@/components/workspace";
export default async function OpportunityPage({params}:{params:Promise<{id:string}>}){const {id}=await params;return <Workspace initialView="opportunities" opportunityId={id}/>;}
