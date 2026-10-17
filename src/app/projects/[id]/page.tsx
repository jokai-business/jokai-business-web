import Workspace from "@/components/workspace";
export default async function ProjectPage({params}:{params:Promise<{id:string}>}){const {id}=await params;return <Workspace initialView="projects" projectId={id}/>;}
