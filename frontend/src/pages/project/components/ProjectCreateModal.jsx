import React, { useState, useEffect } from 'react';
import projectApi from '@/api/project';
import iamApi from '@/api/iam';
import contractApi from '@/api/contract';
import Modal from '@/components/common/Modal';

export default function ProjectCreateModal({ onClose, onSuccess }) {
    const generateProjectNo = () => {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const rand = String(Math.floor(Math.random() * 900) + 100);
        return `PR-${y}${m}${d}-${rand}`;
    };

    const [formData, setFormData] = useState({
        project_no: generateProjectNo(),
        name: '',
        project_type: 'b2b',
        pm_user_id: '',
        description: '',
        contract_id: '',
        customer_id: '',
        start_at: '',
        due_at: ''
    });
    const [users, setUsers] = useState([]);
    const [counterparties, setCounterparties] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadOptions();
    }, []);

    const loadOptions = async () => {
        const [usersRes, counterpartiesRes] = await Promise.allSettled([
            iamApi.listUsers({ page_size: 100 }),
            contractApi.listCounterparties({ page_size: 200 })
        ]);
        if (usersRes.status === 'fulfilled') setUsers(usersRes.value.data?.items || []);
        if (counterpartiesRes.status === 'fulfilled') setCounterparties(counterpartiesRes.value.data?.items || counterpartiesRes.value.data || []);
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

            // Clean up empty strings for optional UUID fields
            const payload = { ...formData };
            if (payload.contract_id === '') payload.contract_id = null;
            if (payload.customer_id === '') payload.customer_id = null;
            if (payload.our_entity_id === '') payload.our_entity_id = null;
            if (payload.start_at === '') payload.start_at = null;
            if (payload.due_at === '') payload.due_at = null;

            if (payload.project_type === 'b2c') {
                payload.customer_id = null;
                payload.our_entity_id = null;
            }

            await projectApi.createProject(payload);
            onSuccess();
            onClose();
        } catch (err) {
            setError(err.message || '创建失败');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen
            onClose={onClose}
            title="创建项目"
            className="project-form-modal"
            footer={(
                <>
                    <button type="button" className="btn btn-secondary" onClick={onClose}>取消</button>
                    <button type="submit" form="project-create-form" className="btn btn-primary" disabled={loading}>
                        {loading ? '提交中...' : '创建'}
                    </button>
                </>
            )}
        >
            <form id="project-create-form" onSubmit={handleSubmit}>
                {error && <div className="error-message" style={{ marginBottom: '12px' }}>{error}</div>}

                <div className="form-group">
                    <label>项目编号 *</label>
                    <input
                        type="text"
                        name="project_no"
                        value={formData.project_no}
                        onChange={handleChange}
                        placeholder="自动生成，可手动修改"
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
            </form>
        </Modal>
    );
}
