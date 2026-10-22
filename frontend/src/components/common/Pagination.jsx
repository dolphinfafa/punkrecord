import { ChevronLeft, ChevronRight } from 'lucide-react';
import './Pagination.css';

export default function Pagination({ page, pageSize, total, onChange, loading = false }) {
    const pages = Math.max(1, Math.ceil(total / pageSize));
    return <nav className="shared-pagination" aria-label="分页">
        <span>共 {total} 条记录</span>
        <div>
            <button type="button" title="上一页" disabled={loading || page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft size={16} />上一页</button>
            <span aria-live="polite">{page} / {pages}</span>
            <button type="button" title="下一页" disabled={loading || page >= pages} onClick={() => onChange(page + 1)}>下一页<ChevronRight size={16} /></button>
        </div>
    </nav>;
}
