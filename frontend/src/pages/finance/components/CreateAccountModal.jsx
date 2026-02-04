import React, { useState, useEffect } from 'react';
import Modal from '@/components/common/Modal';
import financeApi from '@/api/finance';
import { contractApi } from '@/api/contract';

export default function CreateAccountModal({ isOpen, onClose, onSuccess, initialData = null }) {
    const [formData, setFormData] = useState({
        entity_id: '',
        account_name: '',
        account_category: 'public', // public/private
        bank_name: '',
        bank_branch: '',
        account_no: '',
        currency: 'CNY',
        initial_balance: '',
        is_default: false
    });
    const [loading, setLoading] = useState(false);
    const [counterparties, setCounterparties] = useState([]);

    useEffect(() => {
        if (isOpen) {
            loadCounterparties();
            if (initialData) {
                setFormData({
                    ...initialData,
                    account_no: initialData.account_no_masked || initialData.account_no || '',
                    initial_balance: initialData.initial_balance?.toString() || '',
                    // Note: Sensitive data like full account number might not be returned by list API
                    // User might need to re-enter it if editing, or we keep existing if not changed
                });
            } else {
                setFormData({
                    entity_id: '',
                    account_name: '',
                    account_category: 'public',
                    bank_name: '',
                    bank_branch: '',
                    account_no: '',
                    currency: 'CNY',
                    initial_balance: '',
                    is_default: false
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
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);

            // Basic validation
            if (!formData.entity_id) {
                alert('请选择所属主体');
                setLoading(false);
                return;
            }

            if (initialData) {
                await financeApi.updateAccount(initialData.id, formData);
            } else {
                await financeApi.createAccount(formData);
            }

            onSuccess();
            onClose();
        } catch (error) {
            console.error('Failed to save account', error);
            alert('保存账户失败: ' + (error.response?.data?.message || error.message || '未知错误'));
        } finally {
            setLoading(false);
        }
    };

    const footer = (
        <>
            <button className="btn btn-secondary" onClick={onClose} disabled={loading}>取消</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
                {loading ? '保存中...' : '保存'}
            </button>
        </>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={initialData ? "编辑账户" : "添加账户"}
            footer={footer}
        >
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>所属主体 (交易方)</label>
                    <select
                        name="entity_id"
                        className="form-select"
                        value={formData.entity_id}
                        onChange={handleChange}
                        required
                    >
                        <option value="">请选择主体</option>
                        {counterparties.map(cp => (
                            <option key={cp.id} value={cp.id}>{cp.name}</option>
                        ))}
                    </select>
                </div>
                <div className="form-group">
                    <label>账户名称</label>
                    <input
                        type="text"
                        name="account_name"
                        className="form-input"
                        value={formData.account_name}
                        onChange={handleChange}
                        placeholder="例如：基本户、一般户"
                        required
                    />
                </div>
                <div className="form-group">
                    <label>账户类型</label>
                    <select
                        name="account_category"
                        className="form-select"
                        value={formData.account_category}
                        onChange={handleChange}
                    >
                        <option value="public">对公账户</option>
                        <option value="private">对私账户</option>
                    </select>
                </div>
                <div className="form-group">
                    <label>开户行</label>
                    <input
                        type="text"
                        name="bank_name"
                        className="form-input"
                        value={formData.bank_name}
                        onChange={handleChange}
                        placeholder="例如：招商银行"
                    />
                </div>
                <div className="form-group">
                    <label>开户支行</label>
                    <input
                        type="text"
                        name="bank_branch"
                        className="form-input"
                        value={formData.bank_branch}
                        onChange={handleChange}
                        placeholder="例如：北京朝阳支行"
                    />
                </div>
                <div className="form-group">
                    <label>银行账号</label>
                    <input
                        type="text"
                        name="account_no"
                        className="form-input"
                        value={formData.account_no}
                        onChange={handleChange}
                        placeholder="请输入完整银行账号"
                    />
                </div>
                <div className="form-group">
                    <label>币种</label>
                    <select
                        name="currency"
                        className="form-select"
                        value={formData.currency}
                        onChange={handleChange}
                    >
                        <option value="CNY">人民币 (CNY)</option>
                        <option value="USD">美元 (USD)</option>
                        <option value="HKD">港币 (HKD)</option>
                    </select>
                </div>
                <div className="form-group">
                    <label>初始余额</label>
                    <input
                        type="number"
                        name="initial_balance"
                        className="form-input"
                        value={formData.initial_balance}
                        onChange={handleChange}
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                    />
                </div>
                <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: '0.5rem' }}>
                    <input
                        type="checkbox"
                        name="is_default"
                        id="is_default"
                        checked={formData.is_default}
                        onChange={handleChange}
                        style={{ width: 'auto', margin: 0 }}
                    />
                    <label htmlFor="is_default" style={{ marginBottom: 0, cursor: 'pointer' }}>设为默认账户</label>
                </div>
            </form>
        </Modal>
    );
}
