import React, { useState, useEffect } from 'react';
import { Clipboard, ArrowDown } from 'lucide-react';
import Modal from '@/components/common/Modal';
import contractApi from '@/api/contract';

export default function CreateCounterpartyModal({ isOpen, onClose, onSuccess }) {
    const [formData, setFormData] = useState({
        name: '',
        type: 'individual',
        identifier: '',
        address: '',
        phone: '',
        bank_name: '',
        bank_account: ''
    });
    const [loading, setLoading] = useState(false);
    const [smartPasteContent, setSmartPasteContent] = useState('');
    const [showSmartPaste, setShowSmartPaste] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setFormData({
                name: '',
                type: 'individual',
                identifier: '',
                address: '',
                phone: '',
                bank_name: '',
                bank_account: ''
            });
            setSmartPasteContent('');
            setShowSmartPaste(false);
        }
    }, [isOpen]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSmartPaste = () => {
        if (!smartPasteContent.trim()) return;

        const content = smartPasteContent;
        const updates = {};

        // Parsing logic (Heuristic)

        // 1. Identifier (Tax ID) - 15-20 alphanumeric
        const taxIdMatch = content.match(/[A-Z0-9]{15,20}/);
        if (taxIdMatch) updates.identifier = taxIdMatch[0];

        // 2. Phone - Mobile or Landline
        const phoneMatch = content.match(/1[3-9]\d{9}/) || content.match(/0\d{2,3}[-\s]?\d{7,8}/);
        if (phoneMatch) updates.phone = phoneMatch[0];

        // 3. Bank Account - 16-19 digits
        const accountMatch = content.match(/\d{16,19}/);
        if (accountMatch) updates.bank_account = accountMatch[0];

        const lines = content.split(/[\n,;，；]/);
        for (const line of lines) {
            const cleanLine = line.trim();
            if (!cleanLine) continue;

            // 4. Bank Name
            if (cleanLine.includes('银行') && !cleanLine.includes('账号') && !cleanLine.includes('卡号')) {
                updates.bank_name = cleanLine.replace(/^(开户行|银行账户|开户银行|银行)[:：\s]*/, '').trim();
            }

            // Name
            if (cleanLine.includes('名称') || cleanLine.includes('姓名') || cleanLine.includes('抬头')) {
                updates.name = cleanLine.replace(/^(名称|姓名|公司名称|发票抬头|抬头)[:：\s]*/, '').trim();
            }

            // Address
            if (cleanLine.includes('地址')) {
                updates.address = cleanLine.replace(/^(地址|注册地址)[:：\s]*/, '').trim();
            }
        }

        setFormData(prev => ({ ...prev, ...updates }));
        setShowSmartPaste(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            await contractApi.createCounterparty(formData);
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Failed to create counterparty', error);
            alert('创建交易方失败: ' + (error.message || '未知错误'));
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
            title="添加新交易方"
            footer={footer}
        >
            <div style={{ marginBottom: '1.5rem' }}>
                <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', borderStyle: 'dashed', padding: '0.8rem' }}
                    onClick={() => setShowSmartPaste(!showSmartPaste)}
                >
                    <Clipboard size={16} />
                    {showSmartPaste ? '隐藏智能粘贴' : '智能识别粘贴 (复制完整信息后点击)'}
                </button>

                {showSmartPaste && (
                    <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'var(--bg-base)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <textarea
                            className="form-input"
                            rows={5}
                            placeholder={`请粘贴文本，例如：\n名称：某某科技有限公司\n税号：91110108MA00XXXXXX\n银行：招商银行北京分行\n账号：11090XXXXXXX\n地址：北京市海淀区...`}
                            value={smartPasteContent}
                            onChange={(e) => setSmartPasteContent(e.target.value)}
                            style={{ marginBottom: '0.8rem', fontFamily: 'monospace', fontSize: '0.9rem' }}
                        />
                        <button
                            type="button"
                            className="btn btn-primary"
                            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                            onClick={handleSmartPaste}
                        >
                            <ArrowDown size={16} />
                            解析并填充表格
                        </button>
                    </div>
                )}
            </div>

            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>交易方名称</label>
                    <input
                        type="text"
                        name="name"
                        className="form-input"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        placeholder="请输入姓名或公司名称"
                    />
                </div>
                <div className="form-group">
                    <label>类型</label>
                    <select
                        name="type"
                        className="form-select"
                        value={formData.type}
                        onChange={handleChange}
                    >
                        <option value="individual">个人</option>
                        <option value="organization">企业/组织</option>
                    </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                        <label>联系电话</label>
                        <input
                            type="text"
                            name="phone"
                            className="form-input"
                            value={formData.phone}
                            onChange={handleChange}
                            placeholder="手机号或座机"
                        />
                    </div>
                    <div className="form-group">
                        <label>识别号 (身份证/税号)</label>
                        <input
                            type="text"
                            name="identifier"
                            className="form-input"
                            value={formData.identifier}
                            onChange={handleChange}
                        />
                    </div>
                </div>

                <div className="form-group">
                    <label>开户银行</label>
                    <input
                        type="text"
                        name="bank_name"
                        className="form-input"
                        value={formData.bank_name}
                        onChange={handleChange}
                        placeholder="例如：招商银行北京分行"
                    />
                </div>
                <div className="form-group">
                    <label>银行账号</label>
                    <input
                        type="text"
                        name="bank_account"
                        className="form-input"
                        value={formData.bank_account}
                        onChange={handleChange}
                    />
                </div>

                <div className="form-group">
                    <label>地址</label>
                    <textarea
                        name="address"
                        className="form-input"
                        value={formData.address}
                        onChange={handleChange}
                        rows={2}
                    />
                </div>
            </form>
        </Modal>
    );
}
