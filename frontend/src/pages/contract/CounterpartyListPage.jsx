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
            setError(err.message || 'Failed to load counterparties');
            console.error('Error loading counterparties:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="page-content"><div className="loading">Loading counterparties...</div></div>;
    if (error) return <div className="page-content"><div className="error">Error: {error}</div></div>;

    return (
        <div className="page-content">
            <div className="toolbar">
                <button className="btn btn-primary">Add Counterparty</button>
            </div>

            <div className="data-table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Type</th>
                            <th>Identifier (Tax ID)</th>
                            <th>Address</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {counterparties.length === 0 ? (
                            <tr>
                                <td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>
                                    No counterparties found. Click "Add Counterparty" to create one.
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
