import React, { useState, useEffect } from 'react';
import financeApi from '@/api/finance';

export default function TransactionListPage() {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadTransactions();
    }, []);

    const loadTransactions = async () => {
        try {
            setLoading(true);
            const response = await financeApi.listTransactions();
            setTransactions(response.data?.items || []);
            setError(null);
        } catch (err) {
            setError(err.message || '加载交易失败');
            console.error('Error loading transactions:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="page-content"><div className="loading">加载中...</div></div>;
    if (error) return <div className="page-content"><div className="error">错误: {error}</div></div>;

    return (
        <div className="page-content">
            <div className="toolbar">
                <button className="btn btn-primary">记录交易</button>
                {/* Filters could go here */}
            </div>

            <div className="data-table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>日期</th>
                            <th>描述</th>
                            <th>账户</th>
                            <th className="text-right">金额</th>
                            <th>状态</th>
                        </tr>
                    </thead>
                    <tbody>
                        {transactions.length === 0 ? (
                            <tr>
                                <td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>
                                    暂无交易。点击“记录交易”来创建一个。
                                </td>
                            </tr>
                        ) : (
                            transactions.map(txn => (
                                <tr key={txn.id}>
                                    <td>{txn.txn_date || txn.date}</td>
                                    <td>{txn.purpose || txn.description}</td>
                                    <td>{txn.account}</td>
                                    <td className={`text-right ${txn.txn_direction === 'in' || txn.direction === 'in' ? 'text-success' : 'text-danger'}`}>
                                        {(txn.txn_direction === 'in' || txn.direction === 'in') ? '+' : ''}{(txn.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td>
                                        <span className={`status-badge ${txn.reconcile_status || txn.status}`}>{txn.reconcile_status || txn.status}</span>
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
