import React, { useState, useEffect } from 'react';
import financeApi from '@/api/finance';

export default function AccountListPage() {
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadAccounts();
    }, []);

    const loadAccounts = async () => {
        try {
            setLoading(true);
            const response = await financeApi.listAccounts();
            setAccounts(response.data || []);
            setError(null);
        } catch (err) {
            setError(err.message || 'Failed to load accounts');
            console.error('Error loading accounts:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="page-content"><div className="loading">Loading accounts...</div></div>;
    if (error) return <div className="page-content"><div className="error">Error: {error}</div></div>;

    return (
        <div className="page-content">
            <div className="toolbar">
                <button className="btn btn-primary">Add Account</button>
            </div>

            <div className="data-table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Account Name</th>
                            <th>Bank</th>
                            <th>Account No.</th>
                            <th>Currency</th>
                            <th className="text-right">Balance</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {accounts.length === 0 ? (
                            <tr>
                                <td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>
                                    No accounts found. Click "Add Account" to create one.
                                </td>
                            </tr>
                        ) : (
                            accounts.map(account => (
                                <tr key={account.id}>
                                    <td>{account.account_name || account.name}</td>
                                    <td>{account.bank_name}</td>
                                    <td>{account.account_no_masked || account.account_no}</td>
                                    <td>{account.currency}</td>
                                    <td className="text-right">{(account.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                    <td>
                                        <span className={`status-badge ${account.status}`}>{account.status}</span>
                                    </td>
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
