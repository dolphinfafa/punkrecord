import React, { useState, useEffect } from 'react';
import projectApi from '@/api/project';
import iamApi from '@/api/iam';

export default function ProjectTeam({ project }) {
    const [members, setMembers] = useState([]);
    const [users, setUsers] = useState([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newMemberId, setNewMemberId] = useState('');
    const [newMemberRole, setNewMemberRole] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadMembers();
        loadUsers();
    }, [project.id]);

    const loadMembers = async () => {
        try {
            const res = await projectApi.getProjectMembers(project.id);
            setMembers(res.data || []);
        } catch (err) {
            console.error(err);
        }
    };

    const loadUsers = async () => {
        try {
            const res = await iamApi.listUsers({ page_size: 100 });
            setUsers(res.data?.items || []);
        } catch (err) {
            console.error(err);
        }
    };

    const handleAddMember = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            await projectApi.addProjectMember(project.id, {
                user_id: newMemberId,
                role_in_project: newMemberRole
            });
            setShowAddModal(false);
            setNewMemberId('');
            setNewMemberRole('');
            loadMembers();
        } catch (err) {
            setError(err.message || '添加失败');
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveMember = async (userId) => {
        if (!window.confirm('确定要移除该成员吗？')) return;
        try {
            await projectApi.removeProjectMember(project.id, userId);
            loadMembers();
        } catch (err) {
            alert(err.message || '移除失败');
        }
    };

    return (
        <div className="card" style={{ marginTop: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3>团队成员</h3>
                <button className="btn btn-sm btn-outline-primary" onClick={() => setShowAddModal(true)}>
                    + 添加成员
                </button>
            </div>

            {showAddModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '400px' }}>
                        <div className="modal-header">
                            <h4>添加成员</h4>
                            <button className="close-btn" onClick={() => setShowAddModal(false)}>&times;</button>
                        </div>
                        <form onSubmit={handleAddMember}>
                            <div className="modal-body">
                                {error && <div className="error-message">{error}</div>}
                                <div className="form-group">
                                    <label>用户</label>
                                    <select
                                        value={newMemberId}
                                        onChange={e => setNewMemberId(e.target.value)}
                                        required
                                    >
                                        <option value="">请选择...</option>
                                        {users.map(u => (
                                            <option key={u.id} value={u.id}>{u.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>角色 (可选)</label>
                                    <input
                                        type="text"
                                        value={newMemberRole}
                                        onChange={e => setNewMemberRole(e.target.value)}
                                        placeholder="例如: 开发人员, 设计师"
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>取消</button>
                                <button type="submit" className="btn btn-primary" disabled={loading}>添加</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="members-list">
                {members.length === 0 ? (
                    <p className="text-muted">暂无团队成员</p>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>姓名</th>
                                <th>角色</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {members.map(m => (
                                <tr key={m.id}>
                                    <td>{m.user_name}</td>
                                    <td>{m.role_in_project || '-'}</td>
                                    <td>
                                        <button
                                            className="btn-link text-danger"
                                            onClick={() => handleRemoveMember(m.user_id)}
                                        >
                                            移除
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
