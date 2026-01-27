import React, { useState, useEffect } from 'react';
import iamApi from '@/api/iam';

export default function EntityListPage() {
    const [entities, setEntities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadEntities();
    }, []);

    const loadEntities = async () => {
        try {
            setLoading(true);
            const response = await iamApi.listEntities();
            setEntities(response.data || []);
            setError(null);
        } catch (err) {
            setError(err.message || '加载实体失败');
            console.error('Error loading entities:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="page-content"><div className="loading">加载中...</div></div>;
    if (error) return <div className="page-content"><div className="error">错误: {error}</div></div>;

    return (
        <div className="page-content">
            <div className="toolbar">
                <button className="btn btn-primary">添加实体</button>
            </div>

            <div className="data-table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>名称</th>
                            <th>法定名称</th>
                            <th>类型</th>
                            <th>统一社会信用代码</th>
                            <th>货币</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {entities.length === 0 ? (
                            <tr>
                                <td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>
                                    暂无实体。点击“添加实体”来创建一个。
                                </td>
                            </tr>
                        ) : (
                            entities.map(entity => (
                                <tr key={entity.id}>
                                    <td>{entity.name}</td>
                                    <td>{entity.legal_name}</td>
                                    <td>{entity.type}</td>
                                    <td>{entity.uscc}</td>
                                    <td>{entity.default_currency}</td>
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
