import React, { useState, useEffect } from 'react';
import projectApi from '@/api/project';
import iamApi from '@/api/iam';
import Modal from '@/components/common/Modal';

export default function ProjectTeam({ project }) {
    const [members, setMembers] = useState([]);
    const [users, setUsers] = useState([]);
    const [jobTitles, setJobTitles] = useState([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newMemberIds, setNewMemberIds] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchText, setSearchText] = useState('');
    const [filterJobTitleId, setFilterJobTitleId] = useState('');

    useEffect(() => {
        loadMembers();
        loadUsers();
        loadJobTitles();
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

    const loadJobTitles = async () => {
        try {
            const res = await iamApi.listJobTitles();
            setJobTitles(res.data || []);
        } catch (err) {
            console.error(err);
        }
    };

    // Filter users by search text and job title
    const filteredUsers = users.filter(u => {
        const matchesSearch = !searchText || (u.display_name || '').toLowerCase().includes(searchText.toLowerCase());
        const matchesJobTitle = !filterJobTitleId || u.job_title_id === filterJobTitleId;
        return matchesSearch && matchesJobTitle;
    });

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
            setSearchText('');
            setFilterJobTitleId('');
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
                <Modal
                    isOpen
                    onClose={() => setShowAddModal(false)}
                    title="添加成员"
                    style={{ maxWidth: '400px' }}
                    footer={(
                        <>
                            <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>取消</button>
                            <button type="submit" form="project-member-form" className="btn btn-primary" disabled={loading}>添加</button>
                        </>
                    )}
                >
                    <form id="project-member-form" onSubmit={handleAddMember}>
                        {error && <div className="error-message" style={{ marginBottom: '10px' }}>{error}</div>}
                        <div className="form-group">
                            <label>用户 (勾选添加)</label>
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                <input
                                    type="text"
                                    placeholder="搜索姓名..."
                                    value={searchText}
                                    onChange={(e) => setSearchText(e.target.value)}
                                    style={{ flex: 1, padding: '6px 10px', border: '1px solid #dee2e6', borderRadius: '4px', fontSize: '0.9rem' }}
                                />
                                <select
                                    value={filterJobTitleId}
                                    onChange={(e) => setFilterJobTitleId(e.target.value)}
                                    style={{ padding: '6px 10px', border: '1px solid #dee2e6', borderRadius: '4px', fontSize: '0.9rem', minWidth: '100px' }}
                                >
                                    <option value="">全部职位</option>
                                    {jobTitles.map(jt => (
                                        <option key={jt.id} value={jt.id}>{jt.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="checkbox-list" style={{ maxHeight: '240px', overflowY: 'auto', border: '1px solid #dee2e6', padding: '10px', borderRadius: '4px', backgroundColor: '#fff' }}>
                                {filteredUsers.length === 0 ? (
                                    <div style={{ color: '#999', textAlign: 'center', padding: '10px' }}>无匹配用户</div>
                                ) : filteredUsers.map(u => (
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
                                            <span>{u.display_name}</span>
                                            {u.job_title_name && (
                                                <span style={{ marginLeft: '6px', fontSize: '0.8rem', color: '#888', backgroundColor: '#f0f0f0', padding: '1px 6px', borderRadius: '3px' }}>
                                                    {u.job_title_name}
                                                </span>
                                            )}
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </form>
                </Modal>
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
