import React, { useState, useEffect } from 'react';
import projectApi from '@/api/project';
import iamApi from '@/api/iam';

export default function ProjectTeam({ project }) {
    const [members, setMembers] = useState([]);
    const [users, setUsers] = useState([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newMemberIds, setNewMemberIds] = useState([]);
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
        if (newMemberIds.length === 0) {
            setError('请至少选择一名成员');
            return;
        }

        try {
            setLoading(true);
            await projectApi.addProjectMember(project.id, {
                user_ids: newMemberIds
            });
            setShowAddModal(false);
            setNewMemberIds([]);
            loadMembers();
        } catch (err) {
            setError(err.message || '添加失败');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectChange = (e) => {
        const options = e.target.options;
        const selectedValues = [];
        for (let i = 0; i < options.length; i++) {
            if (options[i].selected) {
                selectedValues.push(options[i].value);
            }
        }
        setNewMemberIds(selectedValues);
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
                                    <label>用户 (勾选添加)</label>
                                    <div className="checkbox-list" style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #dee2e6', padding: '10px', borderRadius: '4px', backgroundColor: '#fff' }}>
                                        {users.map(u => (
                                            <div key={u.id} style={{ marginBottom: '8px' }}>
                                                <label style={{ display: 'flex', alignItems: 'center', fontWeight: 'normal', margin: 0, cursor: 'pointer' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={newMemberIds.includes(u.id)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setNewMemberIds([...newMemberIds, u.id]);
                                                            } else {
                                                                setNewMemberIds(newMemberIds.filter(id => id !== u.id));
                                                            }
                                                        }}
                                                        style={{ marginRight: '8px', width: 'auto', marginTop: 0 }}
                                                    />
                                                    {u.display_name} {u.department_id ? '(已分配部门)' : ''}
                                                </label>
                                            </div>
                                        ))}
                                    </div>
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
