import React, { useState, useEffect } from 'react';
import { Plus, Users, User, Building2, MapPin, FileBadge, Edit } from 'lucide-react';
import contractApi from '@/api/contract';
import CreateCounterpartyModal from './components/CreateCounterpartyModal';

const TYPE_MAP = {
    'individual': '个人',
    'organization': '企业/组织'
};

export default function CounterpartyListPage() {
    const [counterparties, setCounterparties] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    useEffect(() => {
        loadCounterparties();
    }, []);

    const loadCounterparties = async () => {
        try {
            setLoading(true);
            const response = await contractApi.listCounterparties();
            setCounterparties(response.data || []);
            setError(null);
        } catch (err) {
            setError(err.message || '加载交易方失败');
            console.error('Error loading counterparties:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="page-content"><div className="loading">加载中...</div></div>;
    if (error) return <div className="page-content"><div className="error">错误: {error}</div></div>;

    return (
        <div className="page-content">
            <div className="toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div className="toolbar-left">
                    {/* Search/Filter could go here */}
                </div>
                <button
                    className="btn btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    onClick={() => setIsCreateModalOpen(true)}
                >
                    <Plus size={18} />
                    添加交易方
                </button>
            </div>

            <div className="data-table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>名称</th>
                            <th>类型</th>
                            <th>税号/识别号</th>
                            <th>地址</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {counterparties.length === 0 ? (
                            <tr>
                                <td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                                        <Users size={48} opacity={0.5} />
                                        <p>暂无交易方信息</p>
                                        <button
                                            className="btn btn-primary"
                                            onClick={() => setIsCreateModalOpen(true)}
                                        >
                                            添加第一个交易方
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            counterparties.map(cp => (
                                <tr key={cp.id}>
                                    <td style={{ fontWeight: 500 }}>{cp.name}</td>
                                    <td>
                                        <span className="badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                            {cp.type === 'organization' ? <Building2 size={12} /> : <User size={12} />}
                                            {TYPE_MAP[cp.type] || cp.type}
                                        </span>
                                    </td>
                                    <td style={{ fontFamily: 'monospace' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <FileBadge size={14} className="text-secondary" />
                                            {cp.identifier || '-'}
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <MapPin size={14} className="text-secondary" />
                                            {cp.address || '-'}
                                        </div>
                                    </td>
                                    <td>
                                        <button className="btn-link" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                            <Edit size={14} />
                                            编辑
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <CreateCounterpartyModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={loadCounterparties}
            />
        </div>
    );
}
