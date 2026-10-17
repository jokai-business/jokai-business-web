import Workspace from "@/components/workspace";
export default async function CustomerPage({params}:{params:Promise<{id:string}>}){const {id}=await params;return <Workspace initialView="customers" customerId={id}/>;}
