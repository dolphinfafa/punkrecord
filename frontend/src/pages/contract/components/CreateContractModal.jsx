import React, { useState, useEffect } from 'react';
import Modal from '@/components/common/Modal';
import contractApi from '@/api/contract';
import axios from 'axios';

export default function CreateContractModal({ isOpen, onClose, onSuccess, initialData = null }) {
    const [formData, setFormData] = useState({
        contract_no: '',
        name: '',
        party_a_id: '',  // 甲方 (Party A)
        party_b_id: '',  // 乙方 (Party B)
        party_c_id: '',  // 丙方 (Optional Party C)
        contract_type: 'sales',
        amount_total: '',
        sign_date: '',
        currency: 'CNY',
        payment_plans: []
    });
    const [loading, setLoading] = useState(false);
    const [counterparties, setCounterparties] = useState([]);

    useEffect(() => {
        if (isOpen) {
            loadCounterparties();
            if (initialData) {
                setFormData({
                    ...initialData,
                    amount_total: initialData.amount_total?.toString() || '',
                    payment_plans: initialData.payment_plans || []
                });
            } else {
                setFormData({
                    contract_no: `CNT-${Date.now()}`,
                    name: '',
                    party_a_id: '',
                    party_b_id: '',
                    party_c_id: '',
                    contract_type: 'sales',
                    amount_total: '',
                    sign_date: new Date().toISOString().split('T')[0],
                    currency: 'CNY',
                    payment_plans: []
                });
            }
        }
    }, [isOpen, initialData]);

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

            // Prepare data for API
            const submitData = {
                contract_no: formData.contract_no,
                name: formData.name,
                contract_type: formData.contract_type,
                party_a_id: formData.party_a_id,
                party_b_id: formData.party_b_id,
                party_c_id: formData.party_c_id || null,
                amount_total: Number(formData.amount_total),
                currency: formData.currency,
                sign_date: formData.sign_date,
                payment_plans: formData.payment_plans
            };

            if (initialData) {
                await contractApi.updateContract(initialData.id, submitData);
            } else {
                await contractApi.createContract(submitData);
            }

            onSuccess();
            onClose();
        } catch (error) {
            console.error('Failed to save contract', error);
            alert('保存合同失败: ' + (error.response?.data?.message || error.message || '未知错误'));
        } finally {
            setLoading(false);
        }
    };

    const footer = (
        <>
            <button className="btn btn-secondary" onClick={onClose} disabled={loading}>取消</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
                {loading ? '保存' : '保存中...'}
            </button>
        </>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={initialData ? "编辑合同" : "创建新合同"}
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
                        disabled={!!initialData} // Contract No usually not editable
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
                    <label>甲方</label>
                    <select
                        name="party_a_id"
                        className="form-select"
                        value={formData.party_a_id}
                        onChange={handleChange}
                        required
                    >
                        <option value="">请选择甲方</option>
                        {counterparties.map(cp => (
                            <option key={cp.id} value={cp.id}>{cp.name}</option>
                        ))}
                    </select>
                </div>
                <div className="form-group">
                    <label>乙方</label>
                    <select
                        name="party_b_id"
                        className="form-select"
                        value={formData.party_b_id}
                        onChange={handleChange}
                        required
                    >
                        <option value="">请选择乙方</option>
                        {counterparties.map(cp => (
                            <option key={cp.id} value={cp.id}>{cp.name}</option>
                        ))}
                    </select>
                </div>
                <div className="form-group">
                    <label>丙方（可选）</label>
                    <select
                        name="party_c_id"
                        className="form-select"
                        value={formData.party_c_id}
                        onChange={handleChange}
                    >
                        <option value="">无</option>
                        {counterparties.map(cp => (
                            <option key={cp.id} value={cp.id}>{cp.name}</option>
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
                        <option value="sales">销售合同</option>
                        <option value="purchase">采购合同</option>
                        <option value="third_party">第三方合同</option>
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
