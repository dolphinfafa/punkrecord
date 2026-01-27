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
            setError(err.message || '加载账户失败');
            console.error('Error loading accounts:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="page-content"><div className="loading">加载中...</div></div>;
    if (error) return <div className="page-content"><div className="error">错误: {error}</div></div>;

    return (
        <div className="page-content">
            <div className="toolbar">
                <button className="btn btn-primary">添加账户</button>
            </div>

            <div className="data-table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>账户名称</th>
                            <th>银行</th>
                            <th>账号</th>
                            <th>货币</th>
                            <th className="text-right">余额</th>
                            <th>状态</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {accounts.length === 0 ? (
                            <tr>
                                <td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>
                                    暂无账户。点击“添加账户”来创建一个。
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
