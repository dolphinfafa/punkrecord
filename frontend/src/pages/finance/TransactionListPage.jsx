import React, { useState, useEffect } from 'react';
import financeApi from '@/api/finance';

import CreateTransactionModal from './components/CreateTransactionModal';

const STATUS_MAP = {
    'unreconciled': { label: '未对账', color: 'bg-yellow-500' },
    'reconciled': { label: '已对账', color: 'bg-green-500' }
};

export default function TransactionListPage() {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    const [accountsMap, setAccountsMap] = useState({});

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [txnRes, accRes] = await Promise.all([
                financeApi.listTransactions(),
                financeApi.listAccounts()
            ]);

            setTransactions(txnRes.data?.items || []);

            const accMap = {};
            (accRes.data || []).forEach(acc => {
                accMap[acc.id] = acc.account_name;
            });
            setAccountsMap(accMap);

            setError(null);
        } catch (err) {
            setError(err.message || '加载交易失败');
            console.error('Error loading data:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="page-content"><div className="loading">加载中...</div></div>;
    if (error) return <div className="page-content"><div className="error">错误: {error}</div></div>;

    return (
        <div className="page-content">
            <div className="toolbar">
                <button
                    className="btn btn-primary"
                    onClick={() => setIsCreateModalOpen(true)}
                >
                    记录交易
                </button>
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
                                    <td>{txn.purpose || txn.description || '-'}</td>
                                    <td>{accountsMap[txn.account_id] || txn.account_id}</td>
                                    <td className={`text-right ${['in', 'income'].includes(txn.txn_direction) ? 'text-success' : 'text-danger'}`}>
                                        {['in', 'income'].includes(txn.txn_direction) ? '+' : '-'}{(txn.amount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td>
                                        <span className={`status-badge ${txn.reconcile_status || 'unreconciled'} ${STATUS_MAP[txn.reconcile_status]?.color || 'bg-yellow-500'}`}>
                                            {STATUS_MAP[txn.reconcile_status]?.label || '未对账'}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <CreateTransactionModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={loadData}
            />
        </div>
    );
}
