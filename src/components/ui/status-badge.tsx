export default function StatusBadge({status}:{status:string}){return <span className={`status-badge status-${status}`}><span className="status-dot"/>{status}</span>;}
