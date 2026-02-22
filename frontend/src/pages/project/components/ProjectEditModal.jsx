import React, { useState, useEffect } from 'react';
import projectApi from '@/api/project';
import iamApi from '@/api/iam';
import contractApi from '@/api/contract';

export default function ProjectEditModal({ project, onClose, onSuccess }) {
    const [formData, setFormData] = useState({
        name: project.name,
        status: project.status,
        project_type: project.project_type,
        pm_user_id: project.pm_user_id,
        our_entity_id: project.our_entity_id || '',
        customer_id: project.customer_id || '',
        start_at: project.start_at || '',
        due_at: project.due_at || '',
        description: project.description || ''
    });
    const [users, setUsers] = useState([]);
    const [counterparties, setCounterparties] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadOptions();
    }, []);

    const loadOptions = async () => {
        try {
            const [usersRes, counterpartiesRes] = await Promise.all([
                iamApi.listUsers({ page_size: 100 }),
                contractApi.listCounterparties()
            ]);
            setUsers(usersRes.data?.items || []);
            setCounterparties(counterpartiesRes.data?.items || counterpartiesRes.data || []);
        } catch (err) {
            console.error('Failed to load options:', err);
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

            const payload = { ...formData };
            if (payload.our_entity_id === '') payload.our_entity_id = null;
            if (payload.customer_id === '') payload.customer_id = null;
            if (payload.start_at === '') payload.start_at = null;
            if (payload.due_at === '') payload.due_at = null;

            if (payload.project_type === 'b2c') {
                payload.our_entity_id = null;
                payload.customer_id = null;
            }

            await projectApi.updateProject(project.id, payload);
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

                        {formData.project_type === 'b2b' && (
                            <>
                                <div className="form-group">
                                    <label>我方主体</label>
                                    <select name="our_entity_id" value={formData.our_entity_id || ''} onChange={handleChange}>
                                        <option value="">请选择我方主体</option>
                                        {counterparties.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>客户方 (甲方)</label>
                                    <select name="customer_id" value={formData.customer_id || ''} onChange={handleChange}>
                                        <option value="">请选择客户方</option>
                                        {counterparties.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </>
                        )}

                        <div className="form-group">
                            <label>开始日期</label>
                            <input
                                type="date"
                                name="start_at"
                                value={formData.start_at}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="form-group">
                            <label>截止日期</label>
                            <input
                                type="date"
                                name="due_at"
                                value={formData.due_at}
                                onChange={handleChange}
                            />
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
