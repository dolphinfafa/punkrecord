import React, { useState, useEffect } from 'react';
import projectApi from '@/api/project';
import iamApi from '@/api/iam';

export default function ProjectEditModal({ project, onClose, onSuccess }) {
    const [formData, setFormData] = useState({
        name: project.name,
        status: project.status,
        pm_user_id: project.pm_user_id,
        description: project.description || ''
    });
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        try {
            const res = await iamApi.listUsers({ page_size: 100 });
            setUsers(res.data?.items || []);
        } catch (err) {
            console.error(err);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            setError(null);
            await projectApi.updateProject(project.id, formData);
            onSuccess();
            onClose();
        } catch (err) {
            setError(err.message || '更新失败');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h3>编辑项目</h3>
                    <button className="close-btn" onClick={onClose}>&times;</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        {error && <div className="error-message">{error}</div>}

                        <div className="form-group">
                            <label>项目名称</label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>状态</label>
                            <select name="status" value={formData.status} onChange={handleChange}>
                                <option value="draft">草稿</option>
                                <option value="active">进行中</option>
                                <option value="paused">暂停</option>
                                <option value="closed">已结项</option>
                                <option value="cancelled">已取消</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>项目经理</label>
                            <select name="pm_user_id" value={formData.pm_user_id} onChange={handleChange} required>
                                <option value="">请选择...</option>
                                {users.map(u => (
                                    <option key={u.id} value={u.id}>{u.display_name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label>描述</label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                rows="3"
                            ></textarea>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>取消</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? '提交中...' : '保存'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
