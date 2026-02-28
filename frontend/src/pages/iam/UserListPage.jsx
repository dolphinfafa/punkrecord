import React, { useState, useEffect } from 'react';
import { Plus, Edit2, X, Crown, Search } from 'lucide-react';
import iamApi from '@/api/iam';
import './IAMPage.css';

const STATUS_LABELS = { active: '在职', inactive: '离职' };

function UserModal({ isOpen, onClose, onSubmit, initialData, users, jobTitles, departments, canEditLeaveBalance }) {
    const [form, setForm] = useState({
        display_name: '', username: '', email: '', phone: '',
        password: '', is_shareholder: false,
        manager_user_id: '', job_title_id: '', department_id: '', status: 'active',
        leave_annual_remaining: 5, leave_maternity_remaining: 15, leave_marriage_remaining: 3, leave_personal_remaining: 3, leave_sick_remaining: 3,
        beili_balance: 0,
    });
    const [loading, setLoading] = useState(false);
    const isEdit = !!initialData;

    useEffect(() => {
        if (initialData) {
            setForm({
                display_name: initialData.display_name || '',
                username: initialData.username || '',
                email: initialData.email || '',
                phone: initialData.phone || '',
                password: '',
                is_shareholder: initialData.is_shareholder || false,
                manager_user_id: initialData.manager_user_id || '',
                job_title_id: initialData.job_title_id || '',
                department_id: initialData.department_id || '',
                status: initialData.status || 'active',
                leave_annual_remaining: initialData.leave_annual_remaining ?? 5,
                leave_maternity_remaining: initialData.leave_maternity_remaining ?? 15,
                leave_marriage_remaining: initialData.leave_marriage_remaining ?? 3,
                leave_personal_remaining: initialData.leave_personal_remaining ?? 3,
                leave_sick_remaining: initialData.leave_sick_remaining ?? 3,
                beili_balance: initialData.beili_balance ?? 0,
            });
        } else {
            setForm({ display_name: '', username: '', email: '', phone: '', password: '', is_shareholder: false, manager_user_id: '', job_title_id: '', department_id: '', status: 'active', leave_annual_remaining: 5, leave_maternity_remaining: 15, leave_marriage_remaining: 3, leave_personal_remaining: 3, leave_sick_remaining: 3, beili_balance: 0 });
        }
    }, [initialData, isOpen]);

    // Flatten departments for select
    const flattenDepts = (depts, prefix = '') => {
        let result = [];
        for (const d of depts) {
            result.push({ id: d.id, name: prefix + d.name });
            if (d.children?.length) result = result.concat(flattenDepts(d.children, prefix + d.name + ' / '));
        }
        return result;
    };
    const flatDepts = flattenDepts(departments);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const data = {
                display_name: form.display_name,
                username: form.username || null,
                email: form.email || null,
                phone: form.phone || null,
                is_shareholder: form.is_shareholder,
                manager_user_id: form.manager_user_id || null,
                job_title_id: form.job_title_id || null,
                department_id: form.department_id || null,
            };
            if (!isEdit) data.password = form.password;
            if (isEdit) data.status = form.status;
            if (isEdit && canEditLeaveBalance) {
                data.leave_annual_remaining = Number(form.leave_annual_remaining || 0);
                data.leave_maternity_remaining = Number(form.leave_maternity_remaining || 0);
                data.leave_marriage_remaining = Number(form.leave_marriage_remaining || 0);
                data.leave_personal_remaining = Number(form.leave_personal_remaining || 0);
                data.leave_sick_remaining = Number(form.leave_sick_remaining || 0);
                data.beili_balance = Number(form.beili_balance || 0);
            }
            await onSubmit(data);
            onClose();
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;
    return (
        <div className="iam-modal-overlay" onClick={onClose}>
            <div className="iam-modal iam-modal-lg" onClick={e => e.stopPropagation()}>
                <div className="iam-modal-header">
                    <h3>{isEdit ? '编辑员工' : '新建员工'}</h3>
                    <button onClick={onClose}><X size={18} /></button>
                </div>
                <form onSubmit={handleSubmit} className="iam-modal-body">
                    <div className="iam-form-row">
                        <div className="iam-form-group">
                            <label>姓名 *</label>
                            <input value={form.display_name} onChange={e => setForm(p => ({ ...p, display_name: e.target.value }))} required placeholder="员工姓名" />
                        </div>
                        <div className="iam-form-group">
                            <label>用户名</label>
                            <input value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} placeholder="登录用户名" />
                        </div>
                    </div>
                    <div className="iam-form-row">
                        <div className="iam-form-group">
                            <label>邮箱</label>
                            <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="邮箱地址" />
                        </div>
                        <div className="iam-form-group">
                            <label>手机号</label>
                            <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="手机号码" />
                        </div>
                    </div>
                    {!isEdit && (
                        <div className="iam-form-group">
                            <label>初始密码 *</label>
                            <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required placeholder="设置初始密码" />
                        </div>
                    )}
                    <div className="iam-form-row">
                        <div className="iam-form-group">
                            <label>所属部门</label>
                            <select value={form.department_id} onChange={e => setForm(p => ({ ...p, department_id: e.target.value }))}>
                                <option value="">请选择部门</option>
                                {flatDepts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                        </div>
                        <div className="iam-form-group">
                            <label>职位</label>
                            <select value={form.job_title_id} onChange={e => setForm(p => ({ ...p, job_title_id: e.target.value }))}>
                                <option value="">请选择职位</option>
                                {jobTitles.map(jt => <option key={jt.id} value={jt.id}>{jt.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="iam-form-row">
                        <div className="iam-form-group">
                            <label>直属上级</label>
                            <select value={form.manager_user_id} onChange={e => setForm(p => ({ ...p, manager_user_id: e.target.value }))}>
                                <option value="">无（最高级别）</option>
                                {users.filter(u => u.id !== initialData?.id).map(u => (
                                    <option key={u.id} value={u.id}>{u.display_name}{u.job_title_name ? ` (${u.job_title_name})` : ''}</option>
                                ))}
                            </select>
                        </div>
                        {isEdit && (
                            <div className="iam-form-group">
                                <label>状态</label>
                                <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                                    <option value="active">在职</option>
                                    <option value="inactive">离职</option>
                                </select>
                            </div>
                        )}
                    </div>
                    <div className="iam-form-group">
                        <label className="iam-checkbox-label">
                            <input type="checkbox" checked={form.is_shareholder} onChange={e => setForm(p => ({ ...p, is_shareholder: e.target.checked }))} />
                            <Crown size={14} style={{ color: 'var(--warning-color)' }} /> 股东（最高级别）
                        </label>
                    </div>
                    {isEdit && (
                        <div className="iam-form-row">
                            <div className="iam-form-group">
                                <label>年假剩余（天）</label>
                                <input type="number" step="0.5" min="0" value={form.leave_annual_remaining} disabled={!canEditLeaveBalance} onChange={e => setForm(p => ({ ...p, leave_annual_remaining: e.target.value }))} />
                            </div>
                            <div className="iam-form-group">
                                <label>产假剩余（天）</label>
                                <input type="number" step="0.5" min="0" value={form.leave_maternity_remaining} disabled={!canEditLeaveBalance} onChange={e => setForm(p => ({ ...p, leave_maternity_remaining: e.target.value }))} />
                            </div>
                        </div>
                    )}
                    {isEdit && (
                        <div className="iam-form-row">
                            <div className="iam-form-group">
                                <label>婚假剩余（天）</label>
                                <input type="number" step="0.5" min="0" value={form.leave_marriage_remaining} disabled={!canEditLeaveBalance} onChange={e => setForm(p => ({ ...p, leave_marriage_remaining: e.target.value }))} />
                            </div>
                            <div className="iam-form-group">
                                <label>事假剩余（天）</label>
                                <input type="number" step="0.5" min="0" value={form.leave_personal_remaining} disabled={!canEditLeaveBalance} onChange={e => setForm(p => ({ ...p, leave_personal_remaining: e.target.value }))} />
                            </div>
                            <div className="iam-form-group">
                                <label>病假剩余（天）</label>
                                <input type="number" step="0.5" min="0" value={form.leave_sick_remaining} disabled={!canEditLeaveBalance} onChange={e => setForm(p => ({ ...p, leave_sick_remaining: e.target.value }))} />
                            </div>
                        </div>
                    )}
                    {isEdit && !canEditLeaveBalance && (
                        <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                            仅 L0 级别员工可修改假期余额
                        </div>
                    )}
                    {isEdit && (
                        <div className="iam-form-row">
                            <div className="iam-form-group">
                                <label>贝利余额</label>
                                <input type="number" step="1" value={form.beili_balance} disabled={!canEditLeaveBalance} onChange={e => setForm(p => ({ ...p, beili_balance: e.target.value }))} />
                            </div>
                        </div>
                    )}
                    <div className="iam-modal-footer">
                        <button type="button" onClick={onClose} className="btn-secondary" disabled={loading}>取消</button>
                        <button type="submit" className="btn-primary" disabled={loading}>{loading ? '保存中...' : '保存'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function LeaveResetModal({ isOpen, onClose, onConfirm }) {
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setLoading(false);
        }
    }, [isOpen]);

    const handleConfirm = async () => {
        if (!window.confirm('确定将所有员工假期余额重置为默认值吗？')) return;
        try {
            setLoading(true);
            await onConfirm();
            onClose();
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;
    return (
        <div className="iam-modal-overlay" onClick={onClose}>
            <div className="iam-modal" onClick={e => e.stopPropagation()}>
                <div className="iam-modal-header">
                    <h3>重置假期余额</h3>
                    <button onClick={onClose}><X size={18} /></button>
                </div>
                <div className="iam-modal-body">
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        将为所有员工重置为：年假5天、产假15天、婚假3天、事假3天、病假3天
                    </div>
                    <div className="iam-modal-footer">
                        <button type="button" onClick={onClose} className="btn-secondary" disabled={loading}>取消</button>
                        <button type="button" onClick={handleConfirm} className="btn-primary" disabled={loading}>
                            {loading ? '重置中...' : '确认重置'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function BeliRuleModal({ isOpen, onClose, onSubmit, initialData }) {
    const [form, setForm] = useState({
        name: '',
        enabled: true,
        early_days: 1,
        reward_beili: 10,
        late_days: 1,
        penalty_beili: 5,
        note: '',
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (initialData) {
            setForm({
                name: initialData.name || '',
                enabled: initialData.enabled ?? true,
                early_days: initialData.early_days ?? 1,
                reward_beili: initialData.reward_beili ?? 10,
                late_days: initialData.late_days ?? 1,
                penalty_beili: initialData.penalty_beili ?? 5,
                note: initialData.note || '',
            });
        } else {
            setForm({
                name: '',
                enabled: true,
                early_days: 1,
                reward_beili: 10,
                late_days: 1,
                penalty_beili: 5,
                note: '',
            });
        }
    }, [initialData, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onSubmit({
                ...form,
                early_days: Number(form.early_days || 0),
                reward_beili: Number(form.reward_beili || 0),
                late_days: Number(form.late_days || 0),
                penalty_beili: Number(form.penalty_beili || 0),
            });
            onClose();
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="iam-modal-overlay" onClick={onClose}>
            <div className="iam-modal" onClick={e => e.stopPropagation()}>
                <div className="iam-modal-header">
                    <h3>{initialData ? '编辑贝利规则' : '新建贝利规则'}</h3>
                    <button onClick={onClose}><X size={18} /></button>
                </div>
                <form onSubmit={handleSubmit} className="iam-modal-body">
                    <div className="iam-form-group">
                        <label>规则名称 *</label>
                        <input required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="例如：任务时效规则A" />
                    </div>
                    <div className="iam-form-row">
                        <div className="iam-form-group">
                            <label>提前天数阈值 X</label>
                            <input type="number" min="0" value={form.early_days} onChange={e => setForm(p => ({ ...p, early_days: e.target.value }))} />
                        </div>
                        <div className="iam-form-group">
                            <label>奖励贝利 A</label>
                            <input type="number" min="0" value={form.reward_beili} onChange={e => setForm(p => ({ ...p, reward_beili: e.target.value }))} />
                        </div>
                    </div>
                    <div className="iam-form-row">
                        <div className="iam-form-group">
                            <label>延迟天数阈值 X</label>
                            <input type="number" min="0" value={form.late_days} onChange={e => setForm(p => ({ ...p, late_days: e.target.value }))} />
                        </div>
                        <div className="iam-form-group">
                            <label>扣除贝利 B</label>
                            <input type="number" min="0" value={form.penalty_beili} onChange={e => setForm(p => ({ ...p, penalty_beili: e.target.value }))} />
                        </div>
                    </div>
                    <div className="iam-form-group">
                        <label>备注</label>
                        <textarea rows={2} value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))} />
                    </div>
                    <div className="iam-form-group">
                        <label className="iam-checkbox-label">
                            <input type="checkbox" checked={form.enabled} onChange={e => setForm(p => ({ ...p, enabled: e.target.checked }))} />
                            启用规则
                        </label>
                    </div>
                    <div className="iam-modal-footer">
                        <button type="button" onClick={onClose} className="btn-secondary" disabled={loading}>取消</button>
                        <button type="submit" className="btn-primary" disabled={loading}>{loading ? '保存中...' : '保存'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function UserListPage() {
    const [users, setUsers] = useState([]);
    const [beliRules, setBeliRules] = useState([]);
    const [jobTitles, setJobTitles] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const [notification, setNotification] = useState(null);
    const [search, setSearch] = useState('');
    const [currentUserLevel, setCurrentUserLevel] = useState(null);
    const [resetModalOpen, setResetModalOpen] = useState(false);
    const [beliRuleModalOpen, setBeliRuleModalOpen] = useState(false);
    const [editBeliRule, setEditBeliRule] = useState(null);

    const showNotification = (msg, type = 'success') => {
        setNotification({ msg, type });
        setTimeout(() => setNotification(null), 3000);
    };

    const load = async () => {
        setLoading(true);
        try {
            const [usersRes, jtRes, deptRes] = await Promise.all([
                iamApi.listUsers({ page_size: 100 }),
                iamApi.listJobTitles(),
                iamApi.listDepartments(),
            ]);
            setUsers(usersRes.data?.items || []);
            const currentUserId = JSON.parse(localStorage.getItem('user') || '{}')?.id;
            const me = (usersRes.data?.items || []).find(u => u.id === currentUserId);
            setCurrentUserLevel(me?.level ?? null);
            setJobTitles(jtRes.data || []);
            setDepartments(deptRes.data || []);
            const ruleRes = await iamApi.listBeliRules();
            setBeliRules(ruleRes.data || []);
        } catch {
            showNotification('加载数据失败', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const handleCreate = async (data) => {
        await iamApi.createUser(data);
        showNotification('员工创建成功');
        load();
    };

    const handleEdit = async (data) => {
        await iamApi.updateUser(editTarget.id, data);
        showNotification('员工信息更新成功');
        load();
    };

    const handleResetLeaveBalances = async () => {
        await iamApi.resetAllLeaveBalances();
        showNotification('所有员工假期余额已重置为默认值');
        load();
    };

    const handleCreateBeliRule = async (data) => {
        await iamApi.createBeliRule(data);
        showNotification('贝利规则创建成功');
        load();
    };

    const handleEditBeliRule = async (data) => {
        await iamApi.updateBeliRule(editBeliRule.id, data);
        showNotification('贝利规则更新成功');
        load();
    };

    const handleDeleteBeliRule = async (rule) => {
        if (!window.confirm(`确认删除规则「${rule.name}」吗？`)) return;
        await iamApi.deleteBeliRule(rule.id);
        showNotification('贝利规则已删除');
        load();
    };

    const filtered = users.filter(u =>
        u.display_name.includes(search) ||
        (u.username || '').includes(search) ||
        (u.department_name || '').includes(search) ||
        (u.job_title_name || '').includes(search)
    );

    return (
        <div className="iam-page">
            {notification && (
                <div className={`iam-notification ${notification.type}`}>{notification.msg}</div>
            )}
            <div className="iam-page-header">
                <h2>员工管理</h2>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div className="iam-search">
                        <Search size={14} />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索姓名、部门、职位..." />
                    </div>
                    <button className="btn-primary" onClick={() => { setEditTarget(null); setModalOpen(true); }}>
                        <Plus size={16} /> 新建员工
                    </button>
                    {currentUserLevel === 0 && (
                        <button className="btn-secondary" onClick={() => setResetModalOpen(true)}>
                            重置假期余额
                        </button>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="iam-loading">加载中...</div>
            ) : (
                <div className="data-table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>姓名</th>
                                <th>用户名</th>
                                <th>部门</th>
                                <th>职位</th>
                                <th>直属上级</th>
                                <th>级别</th>
                                <th>贝利</th>
                                <th>状态</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan="9" style={{ textAlign: 'center', padding: '2rem' }}>暂无员工</td></tr>
                            ) : filtered.map(user => (
                                <tr key={user.id}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            {user.is_shareholder && <Crown size={14} style={{ color: 'var(--warning-color)' }} />}
                                            <strong>{user.display_name}</strong>
                                        </div>
                                    </td>
                                    <td style={{ color: 'var(--text-secondary)' }}>{user.username || '—'}</td>
                                    <td>{user.department_name ? <span className="badge">{user.department_name}</span> : '—'}</td>
                                    <td>{user.job_title_name || '—'}</td>
                                    <td style={{ color: 'var(--text-secondary)' }}>{user.manager_name || '—'}</td>
                                    <td>
                                        <span className="badge" style={{ background: 'rgba(138,173,244,0.15)', color: 'var(--primary-color)' }}>L{user.level ?? 0}</span>
                                    </td>
                                    <td>
                                        <span className="badge" style={{ background: 'rgba(16,185,129,0.12)', color: '#047857' }}>
                                            {Number(user.beili_balance || 0).toFixed(0)} 贝利
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`status-badge ${user.status}`}>
                                            {STATUS_LABELS[user.status] || user.status}
                                        </span>
                                    </td>
                                    <td>
                                        <button className="btn-link" onClick={() => { setEditTarget(user); setModalOpen(true); }}>
                                            <Edit2 size={14} /> 编辑
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <div className="card" style={{ marginTop: '1rem', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                    <h3 style={{ margin: 0 }}>贝利规则管理</h3>
                    {currentUserLevel === 0 && (
                        <button className="btn-primary" onClick={() => { setEditBeliRule(null); setBeliRuleModalOpen(true); }}>
                            <Plus size={14} /> 新建规则
                        </button>
                    )}
                </div>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>规则名称</th>
                            <th>提前奖励</th>
                            <th>延迟扣减</th>
                            <th>状态</th>
                            <th>备注</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(beliRules || []).length === 0 ? (
                            <tr><td colSpan="6" style={{ textAlign: 'center', padding: '1.2rem' }}>暂无规则</td></tr>
                        ) : (beliRules || []).map(rule => (
                            <tr key={rule.id}>
                                <td>{rule.name}</td>
                                <td>提前 {rule.early_days} 天 +{rule.reward_beili} 贝利</td>
                                <td>延迟 {rule.late_days} 天 -{rule.penalty_beili} 贝利</td>
                                <td>{rule.enabled ? '启用' : '停用'}</td>
                                <td>{rule.note || '-'}</td>
                                <td>
                                    {currentUserLevel === 0 ? (
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <button className="btn-link" onClick={() => { setEditBeliRule(rule); setBeliRuleModalOpen(true); }}>
                                                <Edit2 size={14} /> 编辑
                                            </button>
                                            <button className="btn-link" onClick={() => handleDeleteBeliRule(rule)}>
                                                <X size={14} /> 删除
                                            </button>
                                        </div>
                                    ) : '-'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <UserModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                onSubmit={editTarget ? handleEdit : handleCreate}
                initialData={editTarget}
                users={users}
                jobTitles={jobTitles}
                departments={departments}
                canEditLeaveBalance={currentUserLevel === 0}
            />

            <LeaveResetModal
                isOpen={resetModalOpen}
                onClose={() => setResetModalOpen(false)}
                onConfirm={handleResetLeaveBalances}
            />

            <BeliRuleModal
                isOpen={beliRuleModalOpen}
                onClose={() => setBeliRuleModalOpen(false)}
                onSubmit={editBeliRule ? handleEditBeliRule : handleCreateBeliRule}
                initialData={editBeliRule}
            />
        </div>
    );
}
