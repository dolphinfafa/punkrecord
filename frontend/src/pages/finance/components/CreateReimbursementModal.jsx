import React, { useEffect, useState } from 'react';
import Modal from '@/components/common/Modal';
import financeApi from '@/api/finance';
import { contractApi } from '@/api/contract';
import projectApi from '@/api/project';

const EMPTY_LINE = {
    expense_type: '交通',
    amount: '',
    expense_date: new Date().toISOString().split('T')[0],
    note: '',
    attachments: []
};

function filesToAttachmentPayload(files) {
    return Promise.all(files.map(file => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            resolve({
                name: file.name,
                type: file.type || 'application/octet-stream',
                size: file.size,
                uploaded_at: new Date().toISOString(),
                content: reader.result
            });
        };
        reader.onerror = () => reject(new Error(`读取文件失败: ${file.name}`));
        reader.readAsDataURL(file);
    })));
}

export default function CreateReimbursementModal({ isOpen, onClose, onSuccess }) {
    const [formData, setFormData] = useState({
        entity_source_account_id: '',
        our_entity_id: '',
        project_id: '',
        contract_id: '',
        expense_lines: [{ ...EMPTY_LINE }]
    });
    const [accounts, setAccounts] = useState([]);
    const [contracts, setContracts] = useState([]);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadDependencies();
            setFormData({
                entity_source_account_id: '',
                our_entity_id: '',
                project_id: '',
                contract_id: '',
                expense_lines: [{ ...EMPTY_LINE }]
            });
        }
    }, [isOpen]);

    const loadDependencies = async () => {
        try {
            const [accountsRes, projectsRes, contractsRes] = await Promise.all([
                financeApi.listAccounts(),
                projectApi.listProjects({ page_size: 200 }),
                contractApi.listContracts({ page_size: 200 })
            ]);
            setAccounts(accountsRes.data || []);
            setProjects(projectsRes.data?.items || []);
            setContracts(contractsRes.data?.items || []);
        } catch (error) {
            console.error('Failed to load reimbursement dependencies', error);
        }
    };

    const totalAmount = formData.expense_lines.reduce((sum, line) => {
        return sum + (Number(line.amount) || 0);
    }, 0);

    const handleAccountChange = (value) => {
        const selected = accounts.find(item => item.id === value);
        setFormData(prev => ({
            ...prev,
            entity_source_account_id: value,
            our_entity_id: selected?.entity_id || ''
        }));
    };

    const updateLine = (index, key, value) => {
        setFormData(prev => ({
            ...prev,
            expense_lines: prev.expense_lines.map((line, idx) => (
                idx === index ? { ...line, [key]: value } : line
            ))
        }));
    };

    const addExpenseLine = () => {
        setFormData(prev => ({
            ...prev,
            expense_lines: [...prev.expense_lines, { ...EMPTY_LINE }]
        }));
    };

    const removeExpenseLine = (index) => {
        setFormData(prev => ({
            ...prev,
            expense_lines: prev.expense_lines.filter((_, idx) => idx !== index)
        }));
    };

    const handleLineAttachmentChange = async (lineIndex, e) => {
        const selectedFiles = Array.from(e.target.files || []);
        if (selectedFiles.length === 0) {
            return;
        }

        try {
            const payloadFiles = await filesToAttachmentPayload(selectedFiles);
            setFormData(prev => ({
                ...prev,
                expense_lines: prev.expense_lines.map((line, idx) => (
                    idx === lineIndex
                        ? { ...line, attachments: [...(line.attachments || []), ...payloadFiles] }
                        : line
                ))
            }));
        } catch (error) {
            console.error('Failed to process line files', error);
            alert(error.message || '处理附件失败');
        } finally {
            e.target.value = '';
        }
    };

    const removeLineAttachment = (lineIndex, attachmentIndex) => {
        setFormData(prev => ({
            ...prev,
            expense_lines: prev.expense_lines.map((line, idx) => {
                if (idx !== lineIndex) {
                    return line;
                }
                return {
                    ...line,
                    attachments: (line.attachments || []).filter((_, i) => i !== attachmentIndex)
                };
            })
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.our_entity_id) {
            alert('请选择归属主体来源账户');
            return;
        }

        if (formData.expense_lines.length === 0) {
            alert('请至少填写一条费用明细');
            return;
        }

        if (totalAmount <= 0) {
            alert('报销总金额必须大于 0');
            return;
        }

        try {
            setLoading(true);
            const payload = {
                our_entity_id: formData.our_entity_id,
                project_id: formData.project_id || null,
                contract_id: formData.contract_id || null,
                total_amount: totalAmount,
                expense_lines: formData.expense_lines.map(line => ({
                    ...line,
                    amount: Number(line.amount || 0)
                }))
            };
            await financeApi.createReimbursement(payload);
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Failed to create reimbursement', error);
            alert('创建报销失败: ' + (error.response?.data?.message || error.message));
        } finally {
            setLoading(false);
        }
    };

    const footer = (
        <>
            <button className="btn btn-secondary" onClick={onClose} disabled={loading}>取消</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
                {loading ? '保存中...' : '提交报销'}
            </button>
        </>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="新建报销单"
            footer={footer}
            style={{ width: 'min(980px, 92vw)' }}
        >
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>归属主体来源账户</label>
                    <select
                        className="form-select"
                        value={formData.entity_source_account_id}
                        onChange={(e) => handleAccountChange(e.target.value)}
                        required
                    >
                        <option value="">请选择账户</option>
                        {accounts.map(item => (
                            <option key={item.id} value={item.id}>
                                {item.account_name} ({item.currency})
                            </option>
                        ))}
                    </select>
                </div>

                <div className="form-group">
                    <label>关联项目 (可选)</label>
                    <select
                        className="form-select"
                        value={formData.project_id}
                        onChange={(e) => setFormData(prev => ({ ...prev, project_id: e.target.value }))}
                    >
                        <option value="">无</option>
                        {projects.map(item => (
                            <option key={item.id} value={item.id}>
                                {item.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="form-group">
                    <label>关联合同 (可选)</label>
                    <select
                        className="form-select"
                        value={formData.contract_id}
                        onChange={(e) => setFormData(prev => ({ ...prev, contract_id: e.target.value }))}
                    >
                        <option value="">无</option>
                        {contracts.map(item => (
                            <option key={item.id} value={item.id}>
                                {item.contract_no} - {item.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <label style={{ margin: 0 }}>费用明细</label>
                        <button type="button" className="btn btn-secondary" onClick={addExpenseLine}>
                            新增明细
                        </button>
                    </div>

                    <div style={{ display: 'grid', gap: '1rem' }}>
                        {formData.expense_lines.map((line, index) => (
                            <div key={index} style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.75rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                                    <div>
                                        <label>费用类型</label>
                                        <select
                                            className="form-select"
                                            value={line.expense_type}
                                            onChange={(e) => updateLine(index, 'expense_type', e.target.value)}
                                        >
                                            <option value="交通">交通</option>
                                            <option value="餐饮">餐饮</option>
                                            <option value="差旅">差旅</option>
                                            <option value="办公采购">办公采购</option>
                                            <option value="其他">其他</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label>金额</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            className="form-input"
                                            value={line.amount}
                                            onChange={(e) => updateLine(index, 'amount', e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label>费用日期</label>
                                        <input
                                            type="date"
                                            className="form-input"
                                            value={line.expense_date}
                                            onChange={(e) => updateLine(index, 'expense_date', e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div style={{ marginTop: '0.75rem' }}>
                                    <label>备注</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={line.note}
                                        onChange={(e) => updateLine(index, 'note', e.target.value)}
                                        placeholder="补充说明"
                                    />
                                </div>

                                <div style={{ marginTop: '0.75rem' }}>
                                    <label>凭证附件</label>
                                    <input
                                        type="file"
                                        className="form-input"
                                        multiple
                                        accept=".pdf,.png,.jpg,.jpeg,.webp,.heic"
                                        onChange={(e) => handleLineAttachmentChange(index, e)}
                                    />
                                </div>

                                {(line.attachments || []).length > 0 && (
                                    <div style={{ marginTop: '0.5rem', display: 'grid', gap: '0.3rem' }}>
                                        {line.attachments.map((file, fileIndex) => (
                                            <div
                                                key={`${file.name}-${fileIndex}`}
                                                style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}
                                            >
                                                <span>{file.name}</span>
                                                <button
                                                    type="button"
                                                    className="btn btn-secondary"
                                                    style={{ padding: '0.2rem 0.5rem' }}
                                                    onClick={() => removeLineAttachment(index, fileIndex)}
                                                >
                                                    删除
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {formData.expense_lines.length > 1 && (
                                    <div style={{ marginTop: '0.75rem' }}>
                                        <button
                                            type="button"
                                            className="btn btn-secondary"
                                            onClick={() => removeExpenseLine(index)}
                                        >
                                            删除该明细
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ fontWeight: 600 }}>
                    报销总金额: {totalAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })} CNY
                </div>
            </form>
        </Modal>
    );
}
