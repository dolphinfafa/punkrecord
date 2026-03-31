import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import financeApi from '@/api/finance';
import { contractApi } from '@/api/contract';
import iamApi from '@/api/iam';
import CreateTransactionModal from './components/CreateTransactionModal';

const TXN_TYPE_MAP = {
    receipt: '收款',
    payment: '付款',
    reimbursement: '报销'
};

export default function TransactionListPage() {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState(null);
    const [accountsMap, setAccountsMap] = useState({});
    const [contractsMap, setContractsMap] = useState({});
    const [usersMap, setUsersMap] = useState({});
    const [counterpartyMap, setCounterpartyMap] = useState({});
    const [updatingStatusId, setUpdatingStatusId] = useState('');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const pageSize = 20;
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        loadData();
    }, [page, dateFrom, dateTo]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [txnRes, accRes, contractRes, usersRes, cpRes] = await Promise.all([
                financeApi.listTransactions({ page, page_size: pageSize, date_from: dateFrom || undefined, date_to: dateTo || undefined }),
                financeApi.listAccounts({ page_size: 200 }),
                contractApi.listContracts({ page_size: 200 }),
                iamApi.listUsers({ page_size: 100 }),
                contractApi.listCounterparties({ page_size: 200 })
            ]);

            setTransactions(txnRes.data?.items || []);
            setTotal(txnRes.data?.total || 0);

            const accMap = {};
            (accRes.data?.items || []).forEach(acc => {
                accMap[acc.id] = acc.account_name;
            });
            setAccountsMap(accMap);

            const contractMap = {};
            (contractRes.data?.items || []).forEach(contract => {
                contractMap[contract.id] = `${contract.contract_no} - ${contract.name}`;
            });
            setContractsMap(contractMap);

            const employeeMap = {};
            (usersRes.data?.items || []).forEach(user => {
                employeeMap[user.id] = user.display_name;
            });
            setUsersMap(employeeMap);

            const cpMap = {};
            (cpRes.data?.items || []).forEach(cp => {
                cpMap[cp.id] = cp.name;
            });
            setCounterpartyMap(cpMap);
            setError(null);
        } catch (err) {
            setError(err.message || '加载交易失败');
            console.error('Error loading transaction detail:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleStatusChange = async (txnId, nextStatus) => {
        try {
            setUpdatingStatusId(txnId);
            await financeApi.updateTransaction(txnId, { reconcile_status: nextStatus });
            setTransactions(prev => prev.map(item => (
                item.id === txnId ? { ...item, reconcile_status: nextStatus } : item
            )));
        } catch (err) {
            console.error('Failed to update transaction status', err);
            alert('更新状态失败: ' + (err.response?.data?.message || err.message));
        } finally {
            setUpdatingStatusId('');
        }
    };

    const handleExport = async () => {
        try {
            setExporting(true);
            const res = await financeApi.exportTransactions({
                date_from: dateFrom || undefined,
                date_to: dateTo || undefined,
            });
            const url = URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a');
            a.href = url;
            let filename = '交易明细';
            if (dateFrom) filename += `_${dateFrom}`;
            if (dateTo) filename += `_${dateTo}`;
            filename += '.xlsx';
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            alert('导出失败: ' + (err.response?.data?.message || err.message));
        } finally {
            setExporting(false);
        }
    };

    if (loading) return <div className="page-content"><div className="loading">加载中...</div></div>;
    if (error) return <div className="page-content"><div className="error">错误: {error}</div></div>;

    return (
        <div className="page-content">
            <div className="toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem', color: '#475569' }}>
                        起始日期
                        <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="form-input" style={{ padding: '0.35rem 0.5rem', fontSize: '0.85rem' }} />
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem', color: '#475569' }}>
                        截止日期
                        <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="form-input" style={{ padding: '0.35rem 0.5rem', fontSize: '0.85rem' }} />
                    </label>
                    {(dateFrom || dateTo) && (
                        <button className="btn btn-sm btn-outline-secondary" onClick={() => { setDateFrom(''); setDateTo(''); setPage(1); }} style={{ fontSize: '0.8rem' }}>
                            清除筛选
                        </button>
                    )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-outline-secondary" onClick={handleExport} disabled={exporting} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Download size={16} />
                        {exporting ? '导出中...' : '导出 Excel'}
                    </button>
                    <button className="btn btn-primary" onClick={() => { setEditingTransaction(null); setIsCreateModalOpen(true); }}>
                        新增交易明细
                    </button>
                </div>
            </div>

            <div className="data-table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>日期</th>
                            <th>交易类型</th>
                            <th>描述</th>
                            <th>账户</th>
                            <th>交易对象</th>
                            <th>关联合同</th>
                            <th>发票附件</th>
                            <th className="text-right">金额</th>
                            <th>状态</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {transactions.length === 0 ? (
                            <tr>
                                <td colSpan="10" style={{ textAlign: 'center', padding: '2rem' }}>
                                    暂无交易记录。点击“新增交易明细”创建。
                                </td>
                            </tr>
                        ) : (
                            transactions.map(txn => (
                                <tr key={txn.id}>
                                    <td>{txn.txn_date || '-'}</td>
                                    <td>{TXN_TYPE_MAP[txn.txn_type] || (txn.txn_direction === 'in' ? '收款' : '付款')}</td>
                                    <td>{txn.purpose || '-'}</td>
                                    <td>{accountsMap[txn.account_id] || txn.account_id}</td>
                                    <td>
                                        {txn.txn_type === 'reimbursement'
                                            ? (usersMap[txn.employee_user_id] || txn.employee_user_id || '-')
                                            : (txn.counterparty_id ? (counterpartyMap[txn.counterparty_id] || txn.counterparty_id) : '-')}
                                    </td>
                                    <td>{txn.contract_id ? (contractsMap[txn.contract_id] || txn.contract_id) : '-'}</td>
                                    <td>{(txn.attachments || []).length > 0 ? `${txn.attachments.length} 份` : '未上传'}</td>
                                    <td className={`text-right ${txn.txn_direction === 'in' ? 'text-success' : 'text-danger'}`}>
                                        {txn.txn_direction === 'in' ? '+' : '-'}
                                        {Number(txn.amount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td>
                                        <select
                                            className="form-select"
                                            value={txn.reconcile_status || 'unreconciled'}
                                            disabled={updatingStatusId === txn.id}
                                            onChange={(e) => handleStatusChange(txn.id, e.target.value)}
                                            style={{
                                                minWidth: 120,
                                                backgroundColor: '#ffffff',
                                                color: '#0f172a',
                                                border: '1px solid #cbd5e1'
                                            }}
                                        >
                                            <option value="unreconciled">未完成</option>
                                            <option value="completed">已完成</option>
                                            <option value="reconciled">已对账</option>
                                        </select>
                                    </td>
                                    <td>
                                        <button
                                            className="btn-link"
                                            onClick={() => {
                                                setEditingTransaction(txn);
                                                setIsCreateModalOpen(true);
                                            }}
                                        >
                                            编辑
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {total > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', marginTop: '8px' }}>
                    <span style={{ fontSize: '13px', color: '#64748b' }}>共 {total} 条记录</span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button className="btn btn-sm btn-outline-secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <ChevronLeft size={16} /> 上一页
                        </button>
                        <span style={{ fontSize: '13px', color: '#475569' }}>{page} / {Math.ceil(total / pageSize)}</span>
                        <button className="btn btn-sm btn-outline-secondary" disabled={page >= Math.ceil(total / pageSize)} onClick={() => setPage(p => p + 1)} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            下一页 <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            )}

            <CreateTransactionModal
                isOpen={isCreateModalOpen}
                onClose={() => { setIsCreateModalOpen(false); setEditingTransaction(null); }}
                onSuccess={loadData}
                initialData={editingTransaction}
            />
        </div>
    );
}
