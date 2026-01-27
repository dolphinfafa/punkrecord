import React, { useState, useEffect } from 'react';
import contractApi from '@/api/contract';

export default function ContractListPage() {
    const [contracts, setContracts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadContracts();
    }, []);

    const loadContracts = async () => {
        try {
            setLoading(true);
            const response = await contractApi.listContracts();
            setContracts(response.data?.items || []);
            setError(null);
        } catch (err) {
            setError(err.message || '加载合同失败');
            console.error('Error loading contracts:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="page-content"><div className="loading">加载中...</div></div>;
    if (error) return <div className="page-content"><div className="error">错误: {error}</div></div>;

    return (
        <div className="page-content">
            <div className="toolbar">
                <button className="btn btn-primary">创建合同</button>
            </div>

            <div className="data-table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>合同编号</th>
                            <th>名称</th>
                            <th>交易对方</th>
                            <th>类型</th>
                            <th className="text-right">总金额</th>
                            <th>签约日期</th>
                            <th>状态</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {contracts.length === 0 ? (
                            <tr>
                                <td colSpan="8" style={{ textAlign: 'center', padding: '2rem' }}>
                                    暂无合同。点击“创建合同”来创建一个。
                                </td>
                            </tr>
                        ) : (
                            contracts.map(contract => (
                                <tr key={contract.id}>
                                    <td>{contract.contract_no}</td>
                                    <td>{contract.name}</td>
                                    <td>{contract.counterparty}</td>
                                    <td><span className="badge">{contract.contract_type || contract.type}</span></td>
                                    <td className="text-right">{(contract.amount_total || contract.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                    <td>{contract.sign_date || '-'}</td>
                                    <td><span className={`status-badge ${contract.status}`}>{contract.status}</span></td>
                                    <td>
                                        <button className="btn-link">查看</button>
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
