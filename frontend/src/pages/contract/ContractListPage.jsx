import React, { useState, useEffect } from 'react';
import { Plus, FileText, ExternalLink, Calendar, Users, DollarSign, Tag, ChevronLeft, ChevronRight } from 'lucide-react';
import contractApi from '@/api/contract';
import CreateContractModal from './components/CreateContractModal';

// Status mapping
const STATUS_MAP = {
    'draft': { label: '草稿', color: 'bg-gray-500' },
    'active': { label: '执行中', color: 'bg-green-500' },
    'completed': { label: '已完成', color: 'bg-blue-500' },
    'terminated': { label: '已终止', color: 'bg-red-500' },
    'pending': { label: '待审批', color: 'bg-yellow-500' }
};

const TYPE_MAP = {
    'sales': '销售合同',
    'purchase': '采购合同',
    'third_party': '第三方合同'
};

export default function ContractListPage() {
    const [contracts, setContracts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingContract, setEditingContract] = useState(null);
    const [counterpartyMap, setCounterpartyMap] = useState({});
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const pageSize = 20;

    useEffect(() => {
        loadContracts();
    }, [page]);

    const loadContracts = async () => {
        try {
            setLoading(true);
            const [contractRes, cpRes] = await Promise.all([
                contractApi.listContracts({ page, page_size: pageSize }),
                contractApi.listCounterparties({ page_size: 200 })
            ]);
            setContracts(contractRes.data?.items || []);
            setTotal(contractRes.data?.total || 0);
            const cpMap = {};
            (cpRes.data?.items || cpRes.data || []).forEach(cp => { cpMap[cp.id] = cp.name; });
            setCounterpartyMap(cpMap);
            setError(null);
        } catch (err) {
            console.error('❌ Error loading contracts:', err);
            setError(err.message || '加载合同失败');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (contract) => {
        setEditingContract(contract);
        setIsCreateModalOpen(true);
    };

    const handleCreate = () => {
        setEditingContract(null);
        setIsCreateModalOpen(true);
    };

    if (loading) return <div className="page-content"><div className="loading">加载中...</div></div>;
    if (error) return <div className="page-content"><div className="error">错误: {error}</div></div>;

    return (
        <div className="page-content">
            <div className="toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div className="toolbar-left">
                    {/* Filter controls could go here */}
                </div>
                <button
                    className="btn btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    onClick={handleCreate}
                >
                    <Plus size={18} />
                    创建合同
                </button>
            </div>

            <div className="data-table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>合同编号</th>
                            <th>名称</th>
                            <th>类型</th>
                            <th>甲方</th>
                            <th>乙方</th>
                            <th className="text-right">总金额</th>
                            <th className="text-right">待付款金额</th>
                            <th>签约日期</th>
                            <th>状态</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {contracts.length === 0 ? (
                            <tr>
                                <td colSpan="10" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                                        <FileText size={48} opacity={0.5} />
                                        <p>暂无合同数据</p>
                                        <button
                                            className="btn btn-primary"
                                            onClick={handleCreate}
                                        >
                                            创建第一个合同
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            contracts.map(contract => {
                                const statusInfo = STATUS_MAP[contract.status] || { label: contract.status, color: '' };
                                return (
                                    <tr key={contract.id}>
                                        <td style={{ fontFamily: 'monospace' }}>{contract.contract_no}</td>
                                        <td style={{ fontWeight: 500 }}>{contract.name}</td>
                                        <td>
                                            <span className="badge">
                                                {TYPE_MAP[contract.contract_type] || contract.contract_type}
                                            </span>
                                        </td>
                                        <td>{counterpartyMap[contract.party_a_id] || '-'}</td>
                                        <td>{counterpartyMap[contract.party_b_id] || '-'}</td>
                                        <td className="text-right" style={{ fontFamily: 'monospace' }}>
                                            {(contract.amount_total || 0).toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' })}
                                        </td>
                                        <td className="text-right" style={{ fontFamily: 'monospace', fontWeight: 600, color: contract.pending_amount > 0 ? 'var(--color-warning)' : 'var(--color-success)' }}>
                                            {(contract.pending_amount || 0).toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' })}
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <Calendar size={14} className="text-secondary" />
                                                {contract.sign_date || '-'}
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`status-badge ${contract.status} ${STATUS_MAP[contract.status]?.color}`}>
                                                {statusInfo.label}
                                            </span>
                                        </td>
                                        <td>
                                            <button
                                                className="btn-link"
                                                style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                                onClick={() => handleEdit(contract)}
                                            >
                                                <i className="lucide-edit-2" />
                                                编辑
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
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

            <CreateContractModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={loadContracts}
                initialData={editingContract}
            />
        </div>
    );
}
