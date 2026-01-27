import React, { useState, useEffect } from 'react';
import contractApi from '@/api/contract';

export default function CounterpartyListPage() {
    const [counterparties, setCounterparties] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

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
            <div className="toolbar">
                <button className="btn btn-primary">添加交易方</button>
            </div>

            <div className="data-table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>名称</th>
                            <th>类型</th>
                            <th>税号</th>
                            <th>地址</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {counterparties.length === 0 ? (
                            <tr>
                                <td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>
                                    暂无交易方。点击“添加交易方”来创建一个。
                                </td>
                            </tr>
                        ) : (
                            counterparties.map(cp => (
                                <tr key={cp.id}>
                                    <td>{cp.name}</td>
                                    <td><span className="badge">{cp.type}</span></td>
                                    <td>{cp.identifier}</td>
                                    <td>{cp.address}</td>
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
