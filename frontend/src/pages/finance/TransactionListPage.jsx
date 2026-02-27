import React, { useEffect, useState } from 'react';
import financeApi from '@/api/finance';
import { contractApi } from '@/api/contract';
import CreateTransactionModal from './components/CreateTransactionModal';

const STATUS_MAP = {
    unreconciled: { label: '未对账', color: 'bg-yellow-500' },
    reconciled: { label: '已对账', color: 'bg-green-500' }
};

export default function TransactionListPage() {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [accountsMap, setAccountsMap] = useState({});
    const [contractsMap, setContractsMap] = useState({});

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [txnRes, accRes, contractRes] = await Promise.all([
                financeApi.listTransactions({ page_size: 200 }),
                financeApi.listAccounts(),
                contractApi.listContracts({ page_size: 200 })
            ]);

            setTransactions(txnRes.data?.items || []);

            const accMap = {};
            (accRes.data || []).forEach(acc => {
                accMap[acc.id] = acc.account_name;
            });
            setAccountsMap(accMap);

            const contractMap = {};
            (contractRes.data?.items || []).forEach(contract => {
                contractMap[contract.id] = `${contract.contract_no} - ${contract.name}`;
            });
            setContractsMap(contractMap);
            setError(null);
        } catch (err) {
            setError(err.message || '加载交易失败');
            console.error('Error loading transaction detail:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="page-content"><div className="loading">加载中...</div></div>;
    if (error) return <div className="page-content"><div className="error">错误: {error}</div></div>;

    return (
        <div className="page-content">
            <div className="toolbar">
                <button className="btn btn-primary" onClick={() => setIsCreateModalOpen(true)}>
                    新增交易明细
                </button>
            </div>

            <div className="data-table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>日期</th>
                            <th>描述</th>
                            <th>账户</th>
                            <th>关联合同</th>
                            <th>发票附件</th>
                            <th className="text-right">金额</th>
                            <th>状态</th>
                        </tr>
                    </thead>
                    <tbody>
                        {transactions.length === 0 ? (
                            <tr>
                                <td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>
                                    暂无交易记录。点击“新增交易明细”创建。
                                </td>
                            </tr>
                        ) : (
                            transactions.map(txn => (
                                <tr key={txn.id}>
                                    <td>{txn.txn_date || '-'}</td>
                                    <td>{txn.purpose || '-'}</td>
                                    <td>{accountsMap[txn.account_id] || txn.account_id}</td>
                                    <td>{txn.contract_id ? (contractsMap[txn.contract_id] || txn.contract_id) : '-'}</td>
                                    <td>{(txn.attachments || []).length > 0 ? `${txn.attachments.length} 份` : '未上传'}</td>
                                    <td className={`text-right ${txn.txn_direction === 'in' ? 'text-success' : 'text-danger'}`}>
                                        {txn.txn_direction === 'in' ? '+' : '-'}
                                        {(txn.amount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
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
