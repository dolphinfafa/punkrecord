import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, X } from 'lucide-react';
import iamApi from '@/api/iam';
import './IAMPage.css';

const BELI_RULE_TYPES = [
    { value: 'task_timeliness', label: '任务提前/延迟完成' },
];

function RuleModal({ isOpen, onClose, onSubmit, initialData }) {
    const [form, setForm] = useState({
        name: '',
        rule_type: 'task_timeliness',
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
                rule_type: initialData.rule_type || 'task_timeliness',
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
                rule_type: 'task_timeliness',
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
                        <input required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                    </div>
                    <div className="iam-form-group">
                        <label>规则类型 *</label>
                        <select value={form.rule_type} onChange={e => setForm(p => ({ ...p, rule_type: e.target.value }))}>
                            {BELI_RULE_TYPES.map(item => (
                                <option key={item.value} value={item.value}>{item.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="iam-form-row">
                        <div className="iam-form-group">
                            <label>提前阈值（天）X</label>
                            <input type="number" min="0" value={form.early_days} onChange={e => setForm(p => ({ ...p, early_days: e.target.value }))} />
                        </div>
                        <div className="iam-form-group">
                            <label>奖励贝利 A</label>
                            <input type="number" min="0" value={form.reward_beili} onChange={e => setForm(p => ({ ...p, reward_beili: e.target.value }))} />
                        </div>
                    </div>
                    <div className="iam-form-row">
                        <div className="iam-form-group">
                            <label>延迟阈值（天）X</label>
                            <input type="number" min="0" value={form.late_days} onChange={e => setForm(p => ({ ...p, late_days: e.target.value }))} />
                        </div>
                        <div className="iam-form-group">
                            <label>扣除贝利 B</label>
                            <input type="number" min="0" value={form.penalty_beili} onChange={e => setForm(p => ({ ...p, penalty_beili: e.target.value }))} />
                        </div>
                    </div>
                    <div className="iam-form-group">
                        <label>说明</label>
                        <textarea rows={2} value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))} />
                    </div>
                    <div className="iam-form-group">
                        <label className="iam-checkbox-label">
                            <input type="checkbox" checked={form.enabled} onChange={e => setForm(p => ({ ...p, enabled: e.target.checked }))} />
                            启用规则
                        </label>
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                        说明：阈值为一次性触发，不会按每 X 天重复叠加。
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

export default function BeliRulePage() {
    const [rules, setRules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [notification, setNotification] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const [currentUserLevel, setCurrentUserLevel] = useState(null);

    const showNotification = (msg, type = 'success') => {
        setNotification({ msg, type });
        setTimeout(() => setNotification(null), 3000);
    };

    const load = async () => {
        setLoading(true);
        try {
            const [ruleRes, usersRes] = await Promise.all([
                iamApi.listBeliRules(),
                iamApi.listUsers({ page_size: 100 }),
            ]);
            setRules(ruleRes.data || []);
            const currentUserId = JSON.parse(localStorage.getItem('user') || '{}')?.id;
            const me = (usersRes.data?.items || []).find(u => u.id === currentUserId);
            setCurrentUserLevel(me?.level ?? null);
        } catch {
            showNotification('获取贝利规则失败', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const handleCreate = async (payload) => {
        await iamApi.createBeliRule(payload);
        showNotification('规则创建成功');
        load();
    };

    const handleEdit = async (payload) => {
        await iamApi.updateBeliRule(editTarget.id, payload);
        showNotification('规则更新成功');
        load();
    };

    const handleDelete = async (rule) => {
        if (!window.confirm(`确定删除规则「${rule.name}」吗？`)) return;
        await iamApi.deleteBeliRule(rule.id);
        showNotification('规则已删除');
        load();
    };

    return (
        <div className="iam-page">
            {notification && (
                <div className={`iam-notification ${notification.type}`}>{notification.msg}</div>
            )}

            <div className="iam-page-header">
                <h2>贝利规则管理</h2>
                {currentUserLevel === 0 && (
                    <button className="btn-primary" onClick={() => { setEditTarget(null); setModalOpen(true); }}>
                        <Plus size={16} /> 新建规则
                    </button>
                )}
            </div>

            {loading ? (
                <div className="iam-loading">加载中...</div>
            ) : (
                <div className="data-table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>规则名称</th>
                                <th>规则类型</th>
                                <th>提前规则</th>
                                <th>延迟规则</th>
                                <th>状态</th>
                                <th>说明</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rules.length === 0 ? (
                                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '1.5rem' }}>暂无规则</td></tr>
                            ) : rules.map(rule => (
                                <tr key={rule.id}>
                                    <td>{rule.name}</td>
                                    <td>{BELI_RULE_TYPES.find(x => x.value === rule.rule_type)?.label || rule.rule_type}</td>
                                    <td>提前 {rule.early_days} 天，奖励 {rule.reward_beili} 贝利</td>
                                    <td>延迟 {rule.late_days} 天，扣除 {rule.penalty_beili} 贝利</td>
                                    <td>{rule.enabled ? '启用' : '停用'}</td>
                                    <td>{rule.note || '-'}</td>
                                    <td>
                                        {currentUserLevel === 0 ? (
                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                <button className="btn-link" onClick={() => { setEditTarget(rule); setModalOpen(true); }}>
                                                    <Edit2 size={14} /> 编辑
                                                </button>
                                                <button className="btn-link" onClick={() => handleDelete(rule)}>
                                                    <Trash2 size={14} /> 删除
                                                </button>
                                            </div>
                                        ) : '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <RuleModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                onSubmit={editTarget ? handleEdit : handleCreate}
                initialData={editTarget}
            />
        </div>
    );
}
