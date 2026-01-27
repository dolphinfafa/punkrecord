import React, { useState, useEffect } from 'react';
import iamApi from '@/api/iam';

export default function UserListPage() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        try {
            setLoading(true);
            const response = await iamApi.listUsers();
            setUsers(response.data?.items || []);
            setError(null);
        } catch (err) {
            setError(err.message || '加载用户失败');
            console.error('Error loading users:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="page-content">
            <div className="toolbar">
                <button className="btn btn-primary">添加用户</button>
            </div>

            <div className="data-table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>显示名称</th>
                            <th>用户名</th>
                            <th>邮箱</th>
                            <th>角色</th>
                            <th>股东</th>
                            <th>状态</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.length === 0 ? (
                            <tr>
                                <td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>
                                    暂无用户。点击“添加用户”来创建一个。
                                </td>
                            </tr>
                        ) : (
                            users.map(user => (
                                <tr key={user.id}>
                                    <td>{user.display_name}</td>
                                    <td>{user.username}</td>
                                    <td>{user.email}</td>
                                    <td><span className="badge">{user.role || 'user'}</span></td>
                                    <td>{user.is_shareholder ? '是' : '否'}</td>
                                    <td><span className={`status-badge ${user.status}`}>{user.status}</span></td>
                                    <td>
                                        <button className="btn-link">编辑</button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
