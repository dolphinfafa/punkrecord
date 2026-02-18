import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, ChevronRight, ChevronDown, Users } from 'lucide-react';
import iamApi from '@/api/iam';
import './IAMPage.css';

function DeptNode({ dept, onEdit, onDelete, level = 0 }) {
    const [expanded, setExpanded] = useState(true);
    const hasChildren = dept.children && dept.children.length > 0;

    return (
        <div className="dept-node">
            <div className="dept-row" style={{ paddingLeft: `${level * 24 + 16}px` }}>
                <button
                    className="dept-expand-btn"
                    onClick={() => setExpanded(!expanded)}
                    style={{ visibility: hasChildren ? 'visible' : 'hidden' }}
                >
                    {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                <span className="dept-name">{dept.name}</span>
                {dept.description && <span className="dept-desc">{dept.description}</span>}
                <span className="dept-member-count">
                    <Users size={12} /> {dept.member_count} 人
                </span>
                <div className="dept-actions">
                    <button className="icon-action-btn" onClick={() => onEdit(dept)} title="编辑">
                        <Edit2 size={14} />
                    </button>
                    <button className="icon-action-btn danger" onClick={() => onDelete(dept)} title="删除">
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>
            {expanded && hasChildren && (
                <div className="dept-children">
                    {dept.children.map(child => (
                        <DeptNode key={child.id} dept={child} onEdit={onEdit} onDelete={onDelete} level={level + 1} />
                    ))}
                </div>
            )}
        </div>
    );
}

function DeptModal({ isOpen, onClose, onSubmit, initialData, departments }) {
    const [form, setForm] = useState({ name: '', description: '', parent_org_unit_id: '' });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (initialData) {
            setForm({
                name: initialData.name || '',
                description: initialData.description || '',
                parent_org_unit_id: initialData.parent_org_unit_id || '',
            });
        } else {
            setForm({ name: '', description: '', parent_org_unit_id: '' });
        }
    }, [initialData, isOpen]);

    // Flatten departments for parent selector
    const flattenDepts = (depts, prefix = '') => {
        let result = [];
        for (const d of depts) {
            result.push({ id: d.id, name: prefix + d.name });
            if (d.children?.length) {
                result = result.concat(flattenDepts(d.children, prefix + d.name + ' / '));
            }
        }
        return result;
    };
    const flatDepts = flattenDepts(departments).filter(d => d.id !== initialData?.id);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onSubmit({
                name: form.name,
                description: form.description || null,
                parent_org_unit_id: form.parent_org_unit_id || null,
            });
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
                    <h3>{initialData ? '编辑部门' : '新建部门'}</h3>
                    <button onClick={onClose}><X size={18} /></button>
                </div>
                <form onSubmit={handleSubmit} className="iam-modal-body">
                    <div className="iam-form-group">
                        <label>部门名称 *</label>
                        <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required placeholder="如：产品部" />
                    </div>
                    <div className="iam-form-group">
                        <label>描述</label>
                        <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="部门描述（可选）" />
                    </div>
                    <div className="iam-form-group">
                        <label>上级部门</label>
                        <select value={form.parent_org_unit_id} onChange={e => setForm(p => ({ ...p, parent_org_unit_id: e.target.value }))}>
                            <option value="">无（顶级部门）</option>
                            {flatDepts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
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

export default function DepartmentPage() {
    const [departments, setDepartments] = useState([]);
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
            const res = await iamApi.listDepartments();
            setDepartments(res.data || []);
        } catch {
            showNotification('加载部门失败', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const handleCreate = async (data) => {
        await iamApi.createDepartment(data);
        showNotification('部门创建成功');
        load();
    };

    const handleEdit = async (data) => {
        await iamApi.updateDepartment(editTarget.id, data);
        showNotification('部门更新成功');
        load();
    };

    const handleDelete = async (dept) => {
        if (!confirm(`确认删除部门「${dept.name}」？`)) return;
        try {
            await iamApi.deleteDepartment(dept.id);
            showNotification('部门已删除');
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
                <h2>部门管理</h2>
                <button className="btn-primary" onClick={() => { setEditTarget(null); setModalOpen(true); }}>
                    <Plus size={16} /> 新建部门
                </button>
            </div>

            {loading ? (
                <div className="iam-loading">加载中...</div>
            ) : departments.length === 0 ? (
                <div className="iam-empty">暂无部门，点击"新建部门"开始</div>
            ) : (
                <div className="dept-tree">
                    {departments.map(d => (
                        <DeptNode
                            key={d.id}
                            dept={d}
                            onEdit={dept => { setEditTarget(dept); setModalOpen(true); }}
                            onDelete={handleDelete}
                        />
                    ))}
                </div>
            )}

            <DeptModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                onSubmit={editTarget ? handleEdit : handleCreate}
                initialData={editTarget}
                departments={departments}
            />
        </div>
    );
}
