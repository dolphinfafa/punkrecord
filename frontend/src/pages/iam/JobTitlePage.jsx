import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, Award } from 'lucide-react';
import iamApi from '@/api/iam';
import './IAMPage.css';

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

export default function JobTitlePage() {
    const [jobTitles, setJobTitles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const [notification, setNotification] = useState(null);

    const showNotification = (msg, type = 'success') => {
        setNotification({ msg, type });
        setTimeout(() => setNotification(null), 3000);
    };

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
        </div>
    );
}
