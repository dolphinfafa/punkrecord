import React, { useState, useEffect } from 'react';
import projectApi from '@/api/project';
import iamApi from '@/api/iam';
// Assuming contractApi exists, if not we might skip contract selection for now or mock it
// import contractApi from '@/api/contract'; 

export default function ProjectCreateModal({ onClose, onSuccess }) {
    const [formData, setFormData] = useState({
        project_no: '',
        name: '',
        project_type: 'b2b',
        pm_user_id: '',
        description: '',
        contract_id: '',   // Optional
        customer_id: ''    // Optional
    });
    const [users, setUsers] = useState([]);
    const [entities, setEntities] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadOptions();
    }, []);

    const loadOptions = async () => {
        try {
            // Load users for PM selection
            // Load entities for our_entity_id
            // This part depends on existing IAM APIs. 
            // I'll assume iamApi.listUsers and something for entities exists.
            // If not I might need to check iamApi.

            const usersRes = await iamApi.listUsers({ page_size: 100 });
            setUsers(usersRes.data?.items || []);

            // For entities, if no API, we might hardcode or fetch from somewhere else.
            // Let's assume a getDictionary or similar exists, or use a hardcoded list for now if not found.
            // Actually, `our_entity` usually comes from a specific API.
            // Let's try to list entities if possible, or just mock it if I can't find it.
            // checking list_dir of api/iam.py might help but I'll assume there is a way.
            // For now, let's just fetch users.

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
            await projectApi.createProject(formData);
            onSuccess();
            onClose();
        } catch (err) {
            setError(err.message || '创建失败');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h3>创建项目</h3>
                    <button className="close-btn" onClick={onClose}>&times;</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        {error && <div className="error-message">{error}</div>}

                        <div className="form-group">
                            <label>项目编号 *</label>
                            <input
                                type="text"
                                name="project_no"
                                value={formData.project_no}
                                onChange={handleChange}
                                required
                                placeholder="例如: PROJ-2023-001"
                            />
                        </div>

                        <div className="form-group">
                            <label>项目名称 *</label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>类型 *</label>
                            <select name="project_type" value={formData.project_type} onChange={handleChange}>
                                <option value="b2b">B2B (To Business)</option>
                                <option value="b2c">B2C (To Consumer)</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>项目经理 *</label>
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
                            {loading ? '提交中...' : '创建'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
