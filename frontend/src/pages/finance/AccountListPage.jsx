import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import financeApi from '@/api/finance';
import CreateAccountModal from './components/CreateAccountModal';

const STATUS_MAP = {
    'active': { label: '正常', color: 'bg-green-500' },
    'inactive': { label: '停用', color: 'bg-gray-500' },
    'frozen': { label: '冻结', color: 'bg-red-500' }
};

export default function AccountListPage() {
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState(null);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const pageSize = 20;

    useEffect(() => {
        loadAccounts();
    }, [page]);

    const loadAccounts = async () => {
        try {
            setLoading(true);
            const response = await financeApi.listAccounts({ page, page_size: pageSize });
            setAccounts(response.data?.items || []);
            setTotal(response.data?.total || 0);
            setError(null);
        } catch (err) {
            setError(err.message || '加载账户失败');
            console.error('Error loading accounts:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (account) => {
        setEditingAccount(account);
        setIsCreateModalOpen(true);
    };

    const handleCreate = () => {
        setEditingAccount(null);
        setIsCreateModalOpen(true);
    };

    if (loading) return <div className="page-content"><div className="loading">加载中...</div></div>;
    if (error) return <div className="page-content"><div className="error">错误: {error}</div></div>;

    return (
        <div className="page-content">
            <div className="toolbar">
                <button className="btn btn-primary" onClick={handleCreate}>添加账户</button>
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
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                                        <p>暂无账户</p>
                                        <button className="btn btn-primary" onClick={handleCreate}>
                                            创建第一个账户
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            accounts.map(account => (
                                <tr key={account.id}>
                                    <td>{account.account_name || account.name}</td>
                                    <td>{account.bank_name}</td>
                                    <td>{account.account_no_masked || account.account_no}</td>
                                    <td>{account.currency}</td>
                                    <td className="text-right">{Number(account.balance || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</td>
                                    <td>
                                        <span className={`status-badge ${account.status} ${STATUS_MAP[account.status]?.color || ''}`}>
                                            {STATUS_MAP[account.status]?.label || account.status}
                                        </span>
                                    </td>
                                    <td>
                                        <button
                                            className="btn-link"
                                            onClick={() => handleEdit(account)}
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

            <CreateAccountModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={loadAccounts}
                initialData={editingAccount}
            />
        </div>
    );
}
