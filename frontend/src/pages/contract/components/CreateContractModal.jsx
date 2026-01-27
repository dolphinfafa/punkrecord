import React, { useState, useEffect } from 'react';
import Modal from '@/components/common/Modal';
import contractApi from '@/api/contract';

export default function CreateContractModal({ isOpen, onClose, onSuccess }) {
    const [formData, setFormData] = useState({
        contract_no: '',
        name: '',
        counterparty: '',
        contract_type: 'service',
        amount_total: '',
        sign_date: '',
        status: 'draft'
    });
    const [loading, setLoading] = useState(false);
    const [counterparties, setCounterparties] = useState([]);

    useEffect(() => {
        if (isOpen) {
            loadCounterparties();
            setFormData({
                contract_no: `CNT-${Date.now()}`, // Auto-generate dummy ID
                name: '',
                counterparty: '',
                contract_type: 'service',
                amount_total: '',
                sign_date: new Date().toISOString().split('T')[0],
                status: 'draft'
            });
        }
    }, [isOpen]);

    const loadCounterparties = async () => {
        try {
            const res = await contractApi.listCounterparties();
            setCounterparties(res.data || []);
        } catch (error) {
            console.error('Failed to load counterparties', error);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            await contractApi.createContract({
                ...formData,
                amount_total: parseFloat(formData.amount_total),
                amount_paid: 0
            });
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Failed to create contract', error);
            alert('创建合同失败: ' + (error.message || '未知错误'));
        } finally {
            setLoading(false);
        }
    };

    const footer = (
        <>
            <button className="btn btn-secondary" onClick={onClose} disabled={loading}>取消</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
                {loading ? '创建中...' : '创建'}
            </button>
        </>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="创建新合同"
            footer={footer}
        >
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>合同编号</label>
                    <input
                        type="text"
                        name="contract_no"
                        className="form-input"
                        value={formData.contract_no}
                        onChange={handleChange}
                        required
                    />
                </div>
                <div className="form-group">
                    <label>合同名称</label>
                    <input
                        type="text"
                        name="name"
                        className="form-input"
                        value={formData.name}
                        onChange={handleChange}
                        required
                    />
                </div>
                <div className="form-group">
                    <label>交易均方</label>
                    <select
                        name="counterparty"
                        className="form-select"
                        value={formData.counterparty}
                        onChange={handleChange}
                        required
                    >
                        <option value="">请选择交易方</option>
                        {counterparties.map(cp => (
                            <option key={cp.id} value={cp.name}>{cp.name}</option>
                        ))}
                    </select>
                </div>
                <div className="form-group">
                    <label>合同类型</label>
                    <select
                        name="contract_type"
                        className="form-select"
                        value={formData.contract_type}
                        onChange={handleChange}
                    >
                        <option value="service">服务合同</option>
                        <option value="purchase">采购合同</option>
                        <option value="sales">销售合同</option>
                        <option value="lease">租赁合同</option>
                        <option value="other">其他</option>
                    </select>
                </div>
                <div className="form-group">
                    <label>总金额</label>
                    <input
                        type="number"
                        name="amount_total"
                        className="form-input"
                        value={formData.amount_total}
                        onChange={handleChange}
                        step="0.01"
                        min="0"
                        required
                    />
                </div>
                <div className="form-group">
                    <label>签约日期</label>
                    <input
                        type="date"
                        name="sign_date"
                        className="form-input"
                        value={formData.sign_date}
                        onChange={handleChange}
                        required
                    />
                </div>
            </form>
        </Modal>
    );
}
