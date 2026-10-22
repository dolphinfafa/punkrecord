import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, X, Plus, Pencil, RefreshCw, Wallet, ShoppingBag, ClipboardCheck, CalendarDays, Truck, Ban } from 'lucide-react';
import client from '@/api/client';
import ImagePasteUpload from '@/components/common/ImagePasteUpload';
import Pagination from '@/components/common/Pagination';
import './BeliPage.css';

const leaveLabels = { annual: '年假', maternity: '产假', marriage: '婚假', personal: '事假', sick: '病假' };
const statusLabels = { pending: '待审核', approved: '已通过', rejected: '已驳回', reversed: '已冲销', excluded: '不参与奖励', fulfilled: '已到账', shipped: '已发货', cancelled: '已取消' };
const kindLabels = { opening: '期初余额', manual: '手动调整', task_reward: '任务奖励', task_reverse: '奖励冲销', attendance: '早会扣款', attendance_reverse: '考勤冲正', redemption: '商品兑换', refund: '兑换退款', leave: '假期调整' };
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
const number = value => Number(value || 0).toFixed(2);
const fieldNames = { amount: '调整金额', reason: '原因', name: '商品名称', description: '描述', price: '商品价格', stock: '库存', leave_days: '假期天数' };
const validationText = { decimal_max_digits: '数值过大', decimal_whole_digits: '数值超出允许范围', decimal_max_places: '最多允许两位小数', finite_number: '请输入有限数值', greater_than: '必须大于 0', string_too_long: '内容过长' };
const errText = err => {
    const data = err.response?.data;
    if (Array.isArray(data?.detail)) return data.detail.map(item => `${fieldNames[item.loc?.at(-1)] || item.loc?.at(-1) || '输入'}：${validationText[item.type] || item.msg}`).join('；');
    return data?.message || (typeof data?.detail === 'string' ? data.detail : '') || err.message || '操作失败';
};
const MAX_MONEY = '9999999999.99';
const key = () => {
    if (crypto.randomUUID) return crypto.randomUUID();
    // getRandomValues also works on development HTTP origins.
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};
const dateText = value => value ? String(value).slice(0, 10) : '';

function ProductImage({ product }) {
    const [url, setUrl] = useState('');
    useEffect(() => {
        let active = true, objectUrl;
        if (product.image_name) client.get(`/beli/products/${product.id}/image`, { responseType: 'blob' }).then(blob => {
            objectUrl = URL.createObjectURL(blob);
            if (active) setUrl(objectUrl);
            else URL.revokeObjectURL(objectUrl);
        }).catch(() => {});
        return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
    }, [product.id, product.image_name]);
    return url ? <img src={url} alt={product.name} /> : <ShoppingBag size={44} aria-label="无商品图片" />;
}

export default function BeliPage() {
    const [accounts, setAccounts] = useState([]);
    const [isL0, setIsL0] = useState(false);
    const [tab, setTab] = useState('accounts');
    const [rows, setRows] = useState([]);
    const [employee, setEmployee] = useState('');
    const [day, setDay] = useState(today());
    const [unmatched, setUnmatched] = useState([]);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [attendancePolicy, setAttendancePolicy] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [dialog, setDialog] = useState(null);
    const [form, setForm] = useState({});
    const requestId = useRef(0);
    const load = useCallback(async () => {
        const serial = ++requestId.current;
        setLoading(true); setError('');
        try {
            const accountRes = await client.get('/beli/accounts');
            if (serial !== requestId.current) return;
            setAccounts(accountRes.data.items); setIsL0(accountRes.data.is_l0);
            const selected = employee || accountRes.data.items[0]?.user_id;
            if (!employee && selected) setEmployee(selected);
            let result;
            if (tab === 'accounts') result = selected ? await client.get('/beli/ledger', { params: { user_id: selected, page, paginated: true } }) : { data: { items: [], total: 0 } };
            else if (tab === 'attendance') {
                result = await client.get('/beli/attendance', { params: { day, page } });
                if (serial === requestId.current) {
                    setUnmatched(result.data.unmatched_names || []);
                    setAttendancePolicy({ active: result.data.policy_active, startsOn: result.data.starts_on });
                }
            } else result = await client.get(`/beli/${tab}`, { params: { page, paginated: true } });
            if (serial === requestId.current) {
                const data = result.data;
                setRows(Array.isArray(data) ? data : data?.items || []);
                setTotal(Array.isArray(data) ? data.length : data?.total || 0);
                if (data?.total > 0 && page > Math.ceil(data.total / 30)) setPage(Math.ceil(data.total / 30));
            }
        } catch (err) { if (serial === requestId.current) setError(errText(err)); }
        finally { if (serial === requestId.current) setLoading(false); }
    }, [tab, employee, day, page]);
    useEffect(() => { load(); return () => { requestId.current += 1; }; }, [load]);
    const open = (type, row = {}) => {
        setDialog({ type, row }); setError('');
        setForm(type === 'product' ? { name: '', description: '', kind: 'physical', price: '', stock: 0, active: true, leave_type: 'annual', leave_days: '0.5', ...row, files: [] }
            : type === 'reward' ? { estimated_hours: row.estimated_hours || '', due_at: dateText(row.due_at), priority: row.priority || 'p2', comment: '', action: 'approve' }
            : type === 'redeem' ? { quantity: 1, delivery: '', request_key: key() }
            : type === 'adjust' ? { amount: '', reason: '', leave_type: '', request_key: key() }
            : type === 'calendar' ? { day: today(), is_workday: false, reason: '', ...row }
            : { reason: '', comment: '', tracking: '', action: type === 'order' ? (!isL0 ? 'cancel' : row.status === 'approved' ? 'ship' : 'approve') : 'approve' });
    };
    const set = (name, value) => setForm(prev => ({ ...prev, [name]: value }));
    const submit = async e => {
        e.preventDefault(); setError('');
        if (dialog.type === 'adjust' && Number(form.amount) === 0) { setError('调整金额不能为 0'); return; }
        for (const name of ['reason', 'name', 'description']) {
            if (typeof form[name] === 'string' && form[name] !== '' && !form[name].trim()) {
                setError(`${fieldNames[name]}不能只包含空白字符`); return;
            }
        }
        setBusy(true);
        try {
            const { type, row } = dialog;
            if (type === 'adjust') await client.post(`/beli/accounts/${row.user_id}/adjust`, { ...form, leave_type: form.leave_type || null });
            if (type === 'reward') await client.post(`/beli/rewards/${row.todo_id}/review`, form.action === 'reject' ? { action: 'reject', comment: form.comment } : form);
            if (type === 'void') await client.post(`/beli/attendance/${row.id}/void`, { reason: form.reason });
            if (type === 'redeem') await client.post('/beli/orders', { ...form, product_id: row.id, quantity: Number(form.quantity) });
            if (type === 'order') await client.post(`/beli/orders/${row.id}/action`, form);
            if (type === 'calendar') await client.put(`/beli/calendar/${form.day}`, { is_workday: form.is_workday, reason: form.reason });
            if (type === 'product') {
                const { files, id, ...data } = form;
                const payload = { name: data.name, description: data.description, kind: data.kind, price: data.price, stock: Number(data.stock), active: data.active,
                    leave_type: data.kind === 'leave' ? data.leave_type : null, leave_days: data.kind === 'leave' ? data.leave_days : null };
                const res = id ? await client.put(`/beli/products/${id}`, payload) : await client.post('/beli/products', payload);
                if (files.length) {
                    // Retain the saved ID if image upload fails, so retry cannot duplicate products.
                    setForm(prev => ({ ...prev, id: res.data.id }));
                    const body = new FormData(); body.append('file', files[0]);
                    await client.post(`/beli/products/${res.data.id}/image`, body, { headers: { 'Content-Type': 'multipart/form-data' } });
                }
            }
            setDialog(null); setMessage('已保存'); await load();
        } catch (err) { setError(errText(err)); }
        finally { setBusy(false); }
    };
    const selected = accounts.find(a => a.user_id === employee);
    const tabs = [['accounts', Wallet, '贝利与假期'], ['rewards', ClipboardCheck, '任务奖励'], ['attendance', CalendarDays, '早会考勤'], ['products', ShoppingBag, '贝利商城'], ['orders', Truck, '兑换记录'], ...(isL0 ? [['calendar', CalendarDays, '工作日历']] : [])];
    const label = (text, child) => <label className="beli-field">{text}{child}</label>;
    const input = (name, type = 'text', required = true, extra = {}) => <input type={type} required={required} value={form[name] ?? ''} onChange={e => set(name, e.target.value)} {...extra} />;
    const pager = !['products', 'calendar'].includes(tab) && <Pagination page={page} pageSize={30} total={total} onChange={setPage} loading={loading} />;
    return <div className="page-content beli-page">
        <header className="beli-heading"><h1>贝利</h1><button title="刷新" onClick={load} disabled={loading}><RefreshCw size={18} /></button></header>
        <nav className="beli-tabs" aria-label="贝利栏目">{tabs.map(([id, Icon, title]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => { setRows([]); setTab(id); setPage(1); setMessage(''); }}><Icon size={16} />{title}</button>)}</nav>
        {message && <div role="status" className="beli-message">{message}</div>}
        {error && !dialog && <div role="alert" className="beli-error">{error}</div>}
        {tab === 'accounts' && <>
            <div className="beli-toolbar">{isL0 && <select aria-label="员工" value={employee} onChange={e => { setEmployee(e.target.value); setPage(1); }}>{accounts.map(a => <option key={a.user_id} value={a.user_id}>{a.name}</option>)}</select>}{isL0 && selected && <button onClick={() => open('adjust', selected)}><Pencil size={16} />调整余额</button>}</div>
            {selected && <><div className="beli-summary"><div><span>{selected.name} · 贝利余额</span><strong>{number(selected.balance)}</strong></div><div><span>已冻结</span><strong>{number(selected.frozen)}</strong></div><div><span>可用贝利</span><strong>{number(selected.available)}</strong></div></div>
            <div className="beli-leave">{Object.entries(selected.leave).map(([type, value]) => <div key={type}><span>{leaveLabels[type]}</span><b>{value} 天</b></div>)}</div></>}
            <h2>账户流水</h2><div className="beli-table-wrap"><table><thead><tr><th>时间</th><th>类型</th><th>贝利变动</th><th>变动后余额</th><th>假期变动</th><th>原因</th></tr></thead><tbody>{rows.map(r => <tr key={r.id}><td>{r.created_at?.replace('T', ' ').slice(0, 19)}</td><td>{kindLabels[r.kind] || r.kind}</td><td className={Number(r.amount) < 0 ? 'beli-negative' : ''}>{number(r.amount)}</td><td>{number(r.balance_after)}</td><td>{r.leave_type ? `${leaveLabels[r.leave_type]} ${r.leave_days} 天` : '-'}</td><td>{r.reason}</td></tr>)}</tbody></table></div>
        </>}
        {tab === 'rewards' && <div className="beli-table-wrap"><table><thead><tr><th>员工 / 任务</th><th>预计工时</th><th>截止日期</th><th>重要级</th><th>状态</th><th>奖励贝利</th><th>操作 / 审核意见</th></tr></thead><tbody>{rows.map(r => <tr key={r.id}><td>{r.user_name}<br /><b>{r.title}</b></td><td>{r.estimated_hours ?? 0} 小时</td><td>{dateText(r.due_at) || '待补录'}</td><td>{r.priority?.toUpperCase()}</td><td>{statusLabels[r.status]}</td><td>{number(r.amount)}</td><td>{isL0 && Number(r.estimated_hours) > 0 && ['pending', 'rejected'].includes(r.status) && <button onClick={() => open('reward', r)}><ClipboardCheck size={16} />审核</button>} {r.comment}</td></tr>)}</tbody></table></div>}
        {tab === 'attendance' && <><div className="beli-toolbar"><input aria-label="考勤日期" type="date" value={day} onChange={e => { setDay(e.target.value); setPage(1); }} /></div>{attendancePolicy && !attendancePolicy.active && <div role="status" className="beli-message">{attendancePolicy.startsOn ? `该日期尚未启用考勤，启用日期为 ${attendancePolicy.startsOn}，不追溯扣款。` : '尚未启用考勤，不追溯扣款。'}</div>}{unmatched.length > 0 && <div className="beli-error">同名员工待确认：{unmatched.join('、')}</div>}<div className="beli-table-wrap"><table><thead><tr><th>日期</th><th>员工</th><th>考勤</th><th>扣款</th><th>特殊情况</th><th>操作</th></tr></thead><tbody>{rows.map(r => <tr key={r.id}><td>{r.day}</td><td>{r.name}</td><td>{r.absent ? '缺席' : '出席或豁免'}</td><td>{r.charged ? '-500.00' : '0.00'}</td><td>{r.waived ? `已作废：${r.reason}` : '-'}</td><td>{isL0 && r.charged && !r.waived && <button onClick={() => open('void', r)}><Ban size={16} />作废扣款</button>}</td></tr>)}</tbody></table></div></>}
        {tab === 'products' && <><div className="beli-toolbar">{isL0 && <button onClick={() => open('product')}><Plus size={16} />新增商品</button>}</div><div className="beli-products">{rows.map(r => <article className="beli-product" key={r.id}><div className="beli-product-image"><ProductImage product={r} /></div><div className="beli-product-body"><h2>{r.name}</h2><p>{r.description}</p><span>{r.kind === 'leave' ? `${leaveLabels[r.leave_type]} ${r.leave_days} 天` : '实物商品'} · 库存 {r.stock}{!r.active && ' · 已下架'}</span><strong>{number(r.price)} 贝利</strong>{isL0 ? <button onClick={() => open('product', r)}><Pencil size={16} />管理</button> : <button disabled={!r.active || r.stock <= 0} onClick={() => open('redeem', r)}><ShoppingBag size={16} />申请兑换</button>}</div></article>)}</div></>}
        {tab === 'orders' && <div className="beli-table-wrap"><table><thead><tr><th>员工 / 商品</th><th>数量</th><th>贝利</th><th>状态</th><th>领取 / 发货信息</th><th>操作</th></tr></thead><tbody>{rows.map(r => <tr key={r.id}><td>{r.user_name}<br />{r.product_snapshot.name}</td><td>{r.quantity}</td><td>{number(r.amount)}</td><td>{statusLabels[r.status]}</td><td>{r.delivery}<br />{r.tracking}<br />{r.comment}</td><td>{(isL0 ? ['pending', 'approved'].includes(r.status) : r.status === 'pending') && <button onClick={() => open('order', r)}><ClipboardCheck size={16} />{isL0 ? '处理' : '取消申请'}</button>}</td></tr>)}</tbody></table></div>}
        {tab === 'calendar' && <><div className="beli-toolbar"><button onClick={() => open('calendar')}><Plus size={16} />添加节假日 / 调休</button></div><div className="beli-table-wrap"><table><thead><tr><th>日期</th><th>安排</th><th>说明</th><th>操作</th></tr></thead><tbody>{rows.map(r => <tr key={r.id}><td>{r.day}</td><td>{r.is_workday ? '调休工作日' : '休息日'}</td><td>{r.reason}</td><td><button title="编辑" onClick={() => open('calendar', r)}><Pencil size={16} /></button></td></tr>)}</tbody></table></div></>}
        {loading && <div className="beli-empty" role="status">加载中...</div>}{!loading && !rows.length && <div className="beli-empty">暂无记录</div>}{pager}
        {dialog && <div className="beli-overlay" onClick={() => { if (!busy) setDialog(null); }}><form className="beli-dialog" role="dialog" aria-modal="true" aria-label="贝利操作" onClick={e => e.stopPropagation()} onSubmit={submit}>
            <header><h2>{{ adjust: '调整贝利与假期', reward: '独立贝利审核', void: '作废早会扣款', product: '商品管理', redeem: '申请兑换', order: '处理兑换单', calendar: '工作日历' }[dialog.type]}</h2><button type="button" title="关闭" disabled={busy} onClick={() => setDialog(null)}><X size={18} /></button></header>
            {dialog.type === 'adjust' && <>{label('调整项目', <select value={form.leave_type} onChange={e => set('leave_type', e.target.value)}><option value="">贝利</option>{Object.entries(leaveLabels).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>)}{label(form.leave_type ? '变动天数（负数为扣减）' : '变动贝利（负数为扣减）', input('amount', 'number', true, { min: form.leave_type ? '-99999999.5' : `-${MAX_MONEY}`, max: form.leave_type ? '99999999.5' : MAX_MONEY, step: form.leave_type ? '0.5' : '0.01' }))}{label('调整原因 *', input('reason', 'text', true, { maxLength: 500 }))}</>}
            {dialog.type === 'reward' && <><p>{dialog.row.user_name} · {dialog.row.title}</p>{label('审核结果', <select value={form.action} onChange={e => set('action', e.target.value)}><option value="approve">通过并发放</option><option value="reject">驳回</option></select>)}{form.action === 'approve' && <>{label('预计工时（小时） *', input('estimated_hours', 'number', true, { min: '0.01', step: '0.01' }))}{label('截止日期 *', input('due_at', 'date'))}{label('重要级', <select value={form.priority} onChange={e => set('priority', e.target.value)}>{['p0', 'p1', 'p2', 'p3'].map(p => <option key={p} value={p}>{p.toUpperCase()}</option>)}</select>)}</>}{label('审核意见', input('comment', 'text', form.action === 'reject'))}</>}
            {dialog.type === 'void' && <><p>{dialog.row.name} · {dialog.row.day} · 500 贝利</p>{label('作废原因 *', input('reason'))}</>}
            {dialog.type === 'calendar' && <>{label('日期 *', input('day', 'date'))}{label('安排', <select value={String(form.is_workday)} onChange={e => set('is_workday', e.target.value === 'true')}><option value="false">休息日</option><option value="true">工作日</option></select>)}{label('说明 *', input('reason'))}</>}
            {dialog.type === 'product' && <>{label('商品名称 *', input('name', 'text', true, { maxLength: 150 }))}{label('描述', <textarea maxLength={2000} value={form.description} onChange={e => set('description', e.target.value)} />)}{label('商品类型', <select value={form.kind} onChange={e => set('kind', e.target.value)}><option value="physical">实物</option><option value="leave">假期</option></select>)}{label('价格（贝利） *', input('price', 'number', true, { min: '0.01', max: MAX_MONEY, step: '0.01' }))}{label('可用库存 *', input('stock', 'number', true, { min: 0, step: 1 }))}{form.kind === 'leave' && <>{label('假期类型', <select value={form.leave_type} onChange={e => set('leave_type', e.target.value)}>{Object.entries(leaveLabels).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>)}{label('天数 *', input('leave_days', 'number', true, { min: '0.5', max: '99999.5', step: '0.5' }))}</>}<label className="beli-check"><input type="checkbox" checked={form.active} onChange={e => set('active', e.target.checked)} />上架</label><ImagePasteUpload files={form.files} onChange={files => set('files', files.slice(-1))} label="商品图片" maxSizeMB={10} /></>}
            {dialog.type === 'redeem' && <><p>{dialog.row.name} · {number(dialog.row.price)} 贝利 / 件</p>{label('数量 *', input('quantity', 'number', true, { min: 1, max: dialog.row.stock, step: 1 }))}{dialog.row.kind === 'physical' && label('领取或配送信息 *', input('delivery'))}</>}
            {dialog.type === 'order' && <><p>{dialog.row.product_snapshot.name} × {dialog.row.quantity}</p>{label('操作', <select value={isL0 ? form.action : 'cancel'} onChange={e => set('action', e.target.value)}>{isL0 && dialog.row.status === 'pending' && <><option value="approve">批准兑换</option><option value="reject">拒绝兑换</option></>}{isL0 && dialog.row.status === 'approved' && <option value="ship">发货</option>}<option value="cancel">取消兑换</option></select>)}{form.action === 'ship' && label('发货或领取记录 *', input('tracking'))}{label('处理说明', input('comment', 'text', false))}</>}
            {error && <div className="beli-error" role="alert">{error}</div>}
            <footer><button type="button" disabled={busy} onClick={() => setDialog(null)}>取消</button><button type="submit" disabled={busy}><Check size={16} />{busy ? '处理中...' : '确认'}</button></footer>
        </form></div>}
    </div>;
}
