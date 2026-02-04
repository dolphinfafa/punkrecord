import React, { useState, useEffect } from 'react';
import Modal from '@/components/common/Modal';
import financeApi from '@/api/finance';
import { contractApi } from '@/api/contract';

export default function CreateTransactionModal({ isOpen, onClose, onSuccess }) {
    const [formData, setFormData] = useState({
        account_id: '',
        txn_direction: 'out', // in / out
        amount: '',
        currency: 'CNY',
        txn_date: new Date().toISOString().split('T')[0],
        purpose: '',
        counterparty_id: '',
        our_entity_id: '' // Will be auto-filled based on account
    });
    const [accounts, setAccounts] = useState([]);
    const [counterparties, setCounterparties] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadDependencies();
            setFormData({
                account_id: '',
                txn_direction: 'out',
                amount: '',
                currency: 'CNY',
                txn_date: new Date().toISOString().split('T')[0],
                purpose: '',
                counterparty_id: '',
                our_entity_id: ''
            });
        }
    }, [isOpen]);

    const loadDependencies = async () => {
        try {
            const [accRes, cpRes] = await Promise.all([
                financeApi.listAccounts(),
                contractApi.listCounterparties()
            ]);
            setAccounts(accRes.data || []);
            setCounterparties(cpRes.data || []);
        } catch (error) {
            console.error('Failed to load dependencies', error);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;

        if (name === 'account_id') {
            const selectedAccount = accounts.find(a => a.id === value);
            setFormData(prev => ({
                ...prev,
                account_id: value,
                our_entity_id: selectedAccount ? selectedAccount.entity_id : '',
                currency: selectedAccount ? selectedAccount.currency : prev.currency
            }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);

            if (!formData.account_id) {
                alert('请选择账户');
                return;
            }
            if (!formData.our_entity_id) {
                // Should encounter this rarely if account selection works
                alert('账户关联实体无效');
                return;
            }

            const payload = {
                ...formData,
                amount: Number(formData.amount),
                counterparty_id: formData.counterparty_id || null
            };

            await financeApi.createTransaction(payload);
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Failed to create transaction', error);
            alert('保存交易失败: ' + (error.response?.data?.message || error.message));
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
            title="记录交易"
            footer={footer}
        >
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>交易类型</label>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <label className="radio-label">
                            <input
                                type="radio"
                                name="txn_direction"
                                value="in"
                                checked={formData.txn_direction === 'in'}
                                onChange={handleChange}
                            />
                            收入
                        </label>
                        <label className="radio-label">
                            <input
                                type="radio"
                                name="txn_direction"
                                value="out"
                                checked={formData.txn_direction === 'out'}
                                onChange={handleChange}
                            />
                            支出
                        </label>
                    </div>
                </div>

                <div className="form-group">
                    <label>账户</label>
                    <select
                        name="account_id"
                        className="form-select"
                        value={formData.account_id}
                        onChange={handleChange}
                        required
                    >
                        <option value="">请选择账户</option>
                        {accounts.map(acc => (
                            <option key={acc.id} value={acc.id}>
                                {acc.account_name} ({acc.bank_name}) - {acc.currency}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="form-group">
                    <label>金额 ({formData.currency})</label>
                    <input
                        type="number"
                        name="amount"
                        className="form-input"
                        value={formData.amount}
                        onChange={handleChange}
                        step="0.01"
                        min="0"
                        required
                    />
                </div>

                <div className="form-group">
                    <label>交易日期</label>
                    <input
                        type="date"
                        name="txn_date"
                        className="form-input"
                        value={formData.txn_date}
                        onChange={handleChange}
                        required
                    />
                </div>

                <div className="form-group">
                    <label>交易对象 (可选)</label>
                    <select
                        name="counterparty_id"
                        className="form-select"
                        value={formData.counterparty_id}
                        onChange={handleChange}
                    >
                        <option value="">无</option>
                        {counterparties.map(cp => (
                            <option key={cp.id} value={cp.id}>{cp.name}</option>
                        ))}
                    </select>
                </div>

                <div className="form-group">
                    <label>用途/备注</label>
                    <input
                        type="text"
                        name="purpose"
                        className="form-input"
                        value={formData.purpose}
                        onChange={handleChange}
                        placeholder="例如：采购付款、服务费..."
                    />
                </div>
            </form>
        </Modal>
    );
}
