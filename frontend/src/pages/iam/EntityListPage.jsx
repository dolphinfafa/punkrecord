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
            setError(err.message || 'Failed to load entities');
            console.error('Error loading entities:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="page-content"><div className="loading">Loading entities...</div></div>;
    if (error) return <div className="page-content"><div className="error">Error: {error}</div></div>;

    return (
        <div className="page-content">
            <div className="toolbar">
                <button className="btn btn-primary">Add Entity</button>
            </div>

            <div className="data-table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Legal Name</th>
                            <th>Type</th>
                            <th>USCC / Reg No.</th>
                            <th>Currency</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {entities.length === 0 ? (
                            <tr>
                                <td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>
                                    No entities found. Click "Add Entity" to create one.
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
                                        <button className="btn-link">Edit</button>
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
