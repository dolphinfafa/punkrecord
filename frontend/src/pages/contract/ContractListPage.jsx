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
            setError(err.message || 'Failed to load contracts');
            console.error('Error loading contracts:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="page-content"><div className="loading">Loading contracts...</div></div>;
    if (error) return <div className="page-content"><div className="error">Error: {error}</div></div>;

    return (
        <div className="page-content">
            <div className="toolbar">
                <button className="btn btn-primary">Create Contract</button>
            </div>

            <div className="data-table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Contract No.</th>
                            <th>Name</th>
                            <th>Counterparty</th>
                            <th>Type</th>
                            <th className="text-right">Total Amount</th>
                            <th>Sign Date</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {contracts.length === 0 ? (
                            <tr>
                                <td colSpan="8" style={{ textAlign: 'center', padding: '2rem' }}>
                                    No contracts found. Click "Create Contract" to create one.
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
                                        <button className="btn-link">View</button>
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
