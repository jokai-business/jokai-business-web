import Icon from "./icon";
export default function Pagination({ page, total, size = 25, busy, onPage }: { page: number; total: number; size?: number; busy: boolean; onPage: (page: number) => void }) {
 const first=total?Math.min((page-1)*size+1,total):0;const last=Math.min(page*size,total);
 return <div className="pagination-row"><span>Showing <strong>{first}–{last}</strong> of <strong>{total}</strong></span><div className="pagination-actions"><button className="secondary" disabled={page<=1||busy} onClick={()=>onPage(page-1)}><Icon name="left" size={13}/>Previous</button><span className="pagination-page" aria-label={`Page ${page}`}>{page}</span><button className="secondary" disabled={page*size>=total||busy} onClick={()=>onPage(page+1)}>Next<Icon name="chevron" size={13}/></button></div></div>;
}
