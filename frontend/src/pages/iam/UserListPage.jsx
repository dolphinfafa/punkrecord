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
            setError(err.message || 'Failed to load users');
            console.error('Error loading users:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="page-content">
            <div className="toolbar">
                <button className="btn btn-primary">Add User</button>
            </div>

            <div className="data-table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Display Name</th>
                            <th>Username</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Shareholder</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.length === 0 ? (
                            <tr>
                                <td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>
                                    No users found. Click "Add User" to create one.
                                </td>
                            </tr>
                        ) : (
                            users.map(user => (
                                <tr key={user.id}>
                                    <td>{user.display_name}</td>
                                    <td>{user.username}</td>
                                    <td>{user.email}</td>
                                    <td><span className="badge">{user.role || 'user'}</span></td>
                                    <td>{user.is_shareholder ? 'Yes' : 'No'}</td>
                                    <td><span className={`status-badge ${user.status}`}>{user.status}</span></td>
                                    <td>
                                        <button className="btn-link">Edit</button>
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
