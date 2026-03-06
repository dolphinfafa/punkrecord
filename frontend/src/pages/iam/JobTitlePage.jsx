import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, X, Award, Shield, Check } from 'lucide-react';
import iamApi from '@/api/iam';
import './IAMPage.css';

const MODULE_LABELS = {
    iam: '组织管理',
    todo: '任务管理',
    contract: '合同管理',
    project: '项目管理',
    finance: '财务管理',
};

function JobTitleModal({ isOpen, onClose, onSubmit, initialData }) {
    const [form, setForm] = useState({ name: '', description: '' });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (initialData) {
            setForm({ name: initialData.name, description: initialData.description || '' });
        } else {
            setForm({ name: '', description: '' });
        }
    }, [initialData, isOpen]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onSubmit({ name: form.name, description: form.description || null });
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
                    <h3>{initialData ? '编辑职位' : '新建职位'}</h3>
                    <button onClick={onClose}><X size={18} /></button>
                </div>
                <form onSubmit={handleSubmit} className="iam-modal-body">
                    <div className="iam-form-group">
                        <label>职位名称 *</label>
                        <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required placeholder="如：总经理" />
                    </div>
                    <div className="iam-form-group">
                        <label>描述</label>
                        <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="职位描述（可选）" />
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

function PermissionPanel({ jobTitle, onClose, showNotification }) {
    const [allPermissions, setAllPermissions] = useState([]);
    const [selected, setSelected] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [permRes, jtPermRes] = await Promise.all([
                iamApi.listPermissions(),
                iamApi.getJobTitlePermissions(jobTitle.id),
            ]);
            setAllPermissions(permRes.data || []);
            setSelected(new Set(jtPermRes.data || []));
        } catch {
            showNotification('加载权限失败', 'error');
        } finally {
            setLoading(false);
        }
    }, [jobTitle.id, showNotification]);

    useEffect(() => { load(); }, [load]);

    const toggle = (code) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(code)) next.delete(code);
            else next.add(code);
            return next;
        });
    };

    const toggleModule = (module, codes) => {
        setSelected(prev => {
            const next = new Set(prev);
            const allSelected = codes.every(c => next.has(c));
            codes.forEach(c => allSelected ? next.delete(c) : next.add(c));
            return next;
        });
    };

    const save = async () => {
        setSaving(true);
        try {
            await iamApi.setJobTitlePermissions(jobTitle.id, [...selected]);
            showNotification(`「${jobTitle.name}」权限已更新`);
            onClose();
        } catch {
            showNotification('保存权限失败', 'error');
        } finally {
            setSaving(false);
        }
    };

    // Group by module
    const grouped = {};
    allPermissions.forEach(p => {
        if (!grouped[p.module]) grouped[p.module] = [];
        grouped[p.module].push(p);
    });

    return (
        <div className="iam-modal-overlay" onClick={onClose}>
            <div className="iam-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '620px' }}>
                <div className="iam-modal-header">
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Shield size={18} /> 权限配置 — {jobTitle.name}
                    </h3>
                    <button onClick={onClose}><X size={18} /></button>
                </div>
                <div className="iam-modal-body" style={{ maxHeight: '60vh', overflow: 'auto' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>加载中...</div>
                    ) : Object.keys(grouped).length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>暂无可分配权限，请先初始化系统数据</div>
                    ) : (
                        Object.entries(grouped).map(([module, perms]) => {
                            const codes = perms.map(p => p.code);
                            const allChecked = codes.every(c => selected.has(c));
                            const someChecked = codes.some(c => selected.has(c));
                            return (
                                <div key={module} style={{ marginBottom: '16px' }}>
                                    <div
                                        onClick={() => toggleModule(module, codes)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '8px',
                                            padding: '8px 12px', borderRadius: '8px', cursor: 'pointer',
                                            background: allChecked ? '#eef2ff' : someChecked ? '#f8fafc' : '#f8fafc',
                                            border: `1px solid ${allChecked ? '#c7d2fe' : '#e2e8f0'}`,
                                            fontWeight: 600, fontSize: '0.88rem', color: '#1e293b',
                                        }}
                                    >
                                        <div style={{
                                            width: '18px', height: '18px', borderRadius: '4px',
                                            border: `2px solid ${allChecked ? '#4f46e5' : someChecked ? '#a5b4fc' : '#cbd5e1'}`,
                                            background: allChecked ? '#4f46e5' : 'transparent',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            {allChecked && <Check size={12} style={{ color: '#fff' }} />}
                                            {!allChecked && someChecked && <div style={{ width: '8px', height: '2px', background: '#a5b4fc', borderRadius: '1px' }} />}
                                        </div>
                                        {MODULE_LABELS[module] || module}
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '6px', padding: '8px 0 0 28px' }}>
                                        {perms.map(p => (
                                            <label
                                                key={p.code}
                                                onClick={() => toggle(p.code)}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: '8px',
                                                    padding: '6px 10px', borderRadius: '6px', cursor: 'pointer',
                                                    background: selected.has(p.code) ? '#f0f9ff' : 'transparent',
                                                    fontSize: '0.84rem', color: '#334155',
                                                }}
                                            >
                                                <div style={{
                                                    width: '16px', height: '16px', borderRadius: '3px', flexShrink: 0,
                                                    border: `2px solid ${selected.has(p.code) ? '#4f46e5' : '#cbd5e1'}`,
                                                    background: selected.has(p.code) ? '#4f46e5' : 'transparent',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                }}>
                                                    {selected.has(p.code) && <Check size={10} style={{ color: '#fff' }} />}
                                                </div>
                                                <span>{p.name}</span>
                                                <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{p.code}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
                <div className="iam-modal-footer" style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.82rem', color: '#64748b' }}>已选择 {selected.size} 项权限</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button type="button" onClick={onClose} className="btn-secondary" disabled={saving}>取消</button>
                        <button type="button" onClick={save} className="btn-primary" disabled={saving || loading}>
                            {saving ? '保存中...' : '保存权限'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function JobTitlePage() {
    const [jobTitles, setJobTitles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const [permTarget, setPermTarget] = useState(null);
    const [notification, setNotification] = useState(null);

    const showNotification = useCallback((msg, type = 'success') => {
        setNotification({ msg, type });
        setTimeout(() => setNotification(null), 3000);
    }, []);

    const load = async () => {
        setLoading(true);
        try {
            const res = await iamApi.listJobTitles();
            setJobTitles(res.data || []);
        } catch {
            showNotification('加载职位失败', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const handleCreate = async (data) => {
        await iamApi.createJobTitle(data);
        showNotification('职位创建成功');
        load();
    };

    const handleEdit = async (data) => {
        await iamApi.updateJobTitle(editTarget.id, data);
        showNotification('职位更新成功');
        load();
    };

    const handleDelete = async (jt) => {
        if (!confirm(`确认删除职位「${jt.name}」？`)) return;
        try {
            await iamApi.deleteJobTitle(jt.id);
            showNotification('职位已删除');
            load();
        } catch (err) {
            showNotification(err.response?.data?.detail || '删除失败', 'error');
        }
    };

    return (
        <div className="iam-page">
            {notification && (
                <div className={`iam-notification ${notification.type}`}>{notification.msg}</div>
            )}
            <div className="iam-page-header">
                <h2>职位管理</h2>
                <button className="btn-primary" onClick={() => { setEditTarget(null); setModalOpen(true); }}>
                    <Plus size={16} /> 新建职位
                </button>
            </div>

            {loading ? (
                <div className="iam-loading">加载中...</div>
            ) : (
                <div className="data-table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>职位名称</th>
                                <th>描述</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {jobTitles.length === 0 ? (
                                <tr><td colSpan="3" style={{ textAlign: 'center', padding: '2rem' }}>暂无职位</td></tr>
                            ) : jobTitles.map(jt => (
                                <tr key={jt.id}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Award size={16} style={{ color: 'var(--primary-color)' }} />
                                            {jt.name}
                                        </div>
                                    </td>
                                    <td style={{ color: 'var(--text-secondary)' }}>{jt.description || '—'}</td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button className="btn-link" onClick={() => setPermTarget(jt)}>
                                                <Shield size={14} /> 权限
                                            </button>
                                            <button className="btn-link" onClick={() => { setEditTarget(jt); setModalOpen(true); }}>
                                                <Edit2 size={14} /> 编辑
                                            </button>
                                            <button className="btn-link" style={{ color: 'var(--error-color)' }} onClick={() => handleDelete(jt)}>
                                                <Trash2 size={14} /> 删除
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <JobTitleModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                onSubmit={editTarget ? handleEdit : handleCreate}
                initialData={editTarget}
            />

            {permTarget && (
                <PermissionPanel
                    jobTitle={permTarget}
                    onClose={() => setPermTarget(null)}
                    showNotification={showNotification}
                />
            )}
        </div>
    );
}
