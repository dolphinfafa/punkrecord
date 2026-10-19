import { useCallback, useEffect, useState } from 'react';
import { Plus, Check, X, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import client from '@/api/client';
import { todoApi } from '@/api/todo';
import '@/pages/beli/BeliPage.css';

const types = { annual: '年假', maternity: '产假', marriage: '婚假', personal: '事假', sick: '病假' };
const statuses = { pending: '待审批', approved: '已批准', rejected: '已拒绝', cancelled: '已取消' };
export default function LeavePage() {
    const [rows, setRows] = useState([]), [tab, setTab] = useState('my'), [page, setPage] = useState(1);
    const [profile, setProfile] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
    const [dialog, setDialog] = useState(null), [form, setForm] = useState({}), [busy, setBusy] = useState(false);
    const load = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const [me, data] = await Promise.all([client.get('/auth/me'), tab === 'my' ? todoApi.listMyLeaves({ page, page_size: 30 }) : todoApi.listTeamPendingLeaves()]);
            setProfile(me.data); setRows(tab === 'my' ? data.data.items : data.data);
        } catch (err) { setError(err.response?.data?.message || err.message); }
        finally { setLoading(false); }
    }, [tab, page]);
    useEffect(() => { load(); }, [load]);
    const field = (name, value) => setForm(prev => ({ ...prev, [name]: value }));
    const submit = async e => {
        e.preventDefault(); setBusy(true); setError('');
        try {
            if (dialog === 'create') await todoApi.createLeave({ leave_type: form.leave_type, reason: form.reason,
                start_at: `${form.start_date}T${form.start_half === 'am' ? '10:00:00' : '14:00:00'}`,
                end_at: `${form.end_date}T${form.end_half === 'am' ? '12:00:00' : '19:00:00'}` });
            else if (form.action === 'approve') await todoApi.approveLeave(dialog.id);
            else await todoApi.rejectLeave(dialog.id, form.reason);
            setDialog(null); await load();
        } catch (err) { setError(err.response?.data?.message || err.message); }
        finally { setBusy(false); }
    };
    return <div className="page-content beli-page"><header className="beli-heading"><h1>请假管理</h1><div className="beli-toolbar"><button title="刷新" disabled={loading} onClick={load}><RefreshCw size={18} /></button>{profile?.manager_user_id && <button onClick={() => { setDialog('create'); setForm({ leave_type: 'annual', start_half: 'am', end_half: 'pm', start_date: '', end_date: '', reason: '' }); }}><Plus size={16} />申请请假</button>}</div></header>
        <nav className="beli-tabs"><button className={tab === 'my' ? 'active' : ''} onClick={() => { setTab('my'); setPage(1); }}>我的请假</button><button className={tab === 'team' ? 'active' : ''} onClick={() => { setTab('team'); setPage(1); }}>待我审批</button></nav>
        <div className="beli-leave">{Object.entries(profile?.leave_balances || {}).map(([type, days]) => <div key={type}><span>{types[type]}</span><b>{days} 天</b></div>)}</div>
        {error && !dialog && <div role="alert" className="beli-error">{error}</div>}
        <div className="beli-table-wrap"><table><thead><tr><th>申请人</th><th>类型</th><th>起止时间</th><th>状态</th><th>原因 / 审批意见</th><th>操作</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td>{row.applicant_name}</td><td>{types[row.leave_type]}</td><td>{row.start_at.replace('T', ' ')}<br />{row.end_at.replace('T', ' ')}</td><td>{statuses[row.status]}</td><td>{row.reason}<br />{row.review_comment}</td><td>{tab === 'team' && <button onClick={() => { setDialog(row); setForm({ action: 'approve', reason: '' }); }}><Check size={16} />审批</button>}</td></tr>)}</tbody></table></div>
        {loading ? <div className="beli-empty">加载中...</div> : !rows.length && <div className="beli-empty">暂无请假记录</div>}
        {tab === 'my' && <div className="beli-pager"><button title="上一页" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={18} /></button>{page}<button title="下一页" disabled={rows.length < 30} onClick={() => setPage(p => p + 1)}><ChevronRight size={18} /></button></div>}
        {dialog && <div className="beli-overlay" onClick={() => { if (!busy) setDialog(null); }}><form role="dialog" aria-modal="true" aria-label="请假申请与审批" className="beli-dialog" onClick={e => e.stopPropagation()} onSubmit={submit}><header><h2>{dialog === 'create' ? '申请请假' : '审批请假'}</h2><button type="button" title="关闭" disabled={busy} onClick={() => setDialog(null)}><X size={18} /></button></header>
            {dialog === 'create' ? <><label className="beli-field">假期类型<select value={form.leave_type} onChange={e => field('leave_type', e.target.value)}>{Object.entries(types).map(([type, name]) => <option key={type} value={type}>{name}</option>)}</select></label>{['start', 'end'].map(side => <label className="beli-field" key={side}>{side === 'start' ? '开始' : '结束'} *<input type="date" required value={form[`${side}_date`]} onChange={e => field(`${side}_date`, e.target.value)} /><select value={form[`${side}_half`]} onChange={e => field(`${side}_half`, e.target.value)}><option value="am">上午</option><option value="pm">下午</option></select></label>)}</> : <><p>{dialog.applicant_name} · {types[dialog.leave_type]}</p><label className="beli-field">审批结果<select value={form.action} onChange={e => field('action', e.target.value)}><option value="approve">批准</option><option value="reject">拒绝</option></select></label></>}
            <label className="beli-field">{dialog === 'create' ? '请假原因' : '审批意见'}<textarea required={form.action === 'reject'} value={form.reason} onChange={e => field('reason', e.target.value)} /></label>{error && <div role="alert" className="beli-error">{error}</div>}<footer><button type="button" disabled={busy} onClick={() => setDialog(null)}>取消</button><button type="submit" disabled={busy}>{busy ? '处理中...' : '提交'}</button></footer>
        </form></div>}
    </div>;
}
