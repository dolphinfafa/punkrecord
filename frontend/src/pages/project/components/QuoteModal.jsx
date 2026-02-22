import React, { useState, useEffect } from 'react';
import { X, Save, Download, Plus, Trash2, CheckCircle } from 'lucide-react';
import client from '../../../api/client';
import projectApi from '../../../api/project';

const CHINESE_NUMS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

const defaultRow = () => ({
    id: Date.now() + Math.random(),
    name: '',
    spec: '',
    unit: '套',
    total_price: '',
    discount: '100%',
    final_price: '',
    remark: '',
    is_subtotal: false,
    subtotal_label: ''
});

const defaultSubtotal = (label) => ({
    id: Date.now() + Math.random(),
    is_subtotal: true,
    subtotal_label: label || '小计',
    name: '',
    spec: '',
    unit: '',
    total_price: '',
    discount: '',
    final_price: '',
    remark: ''
});

function calcFinalPrice(row) {
    const total = parseFloat(row.total_price) || 0;
    const discountStr = (row.discount || '100%').replace('%', '');
    const disc = parseFloat(discountStr) / 100;
    return isNaN(disc) ? '' : Math.round(total * disc);
}

export default function QuoteModal({ isOpen, onClose, stage, allStages, onSave, projectId }) {
    const [rows, setRows] = useState([defaultRow()]);
    const [notes, setNotes] = useState(['此报价不含第三方软件费用；', '所有报价均为含税报价，税率3%；', '功能清单详见sheet页；']);
    const [finalConfirmed, setFinalConfirmed] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    // Load saved quote on open
    useEffect(() => {
        if (isOpen && stage) {
            try {
                if (stage.feature_list && stage.feature_list.trim().startsWith('{')) {
                    const saved = JSON.parse(stage.feature_list);
                    if (saved.rows) setRows(saved.rows);
                    if (saved.notes) setNotes(saved.notes);
                    if (saved.final_confirmed !== undefined) setFinalConfirmed(saved.final_confirmed);
                } else {
                    setRows([defaultRow()]);
                }
            } catch (e) {
                setRows([defaultRow()]);
            }
        }
    }, [isOpen, stage]);

    if (!isOpen || !stage) return null;

    // Compute totals
    const dataRows = rows.filter(r => !r.is_subtotal);
    const totalPrice = dataRows.reduce((s, r) => s + (parseFloat(r.total_price) || 0), 0);
    const totalFinal = dataRows.reduce((s, r) => {
        const fp = parseFloat(r.final_price !== '' ? r.final_price : calcFinalPrice(r));
        return s + (isNaN(fp) ? 0 : fp);
    }, 0);

    const handleRowChange = (id, field, value) => {
        setRows(prev => prev.map(r => {
            if (r.id !== id) return r;
            const updated = { ...r, [field]: value };
            // Auto-calc final price if total_price or discount changed
            if (field === 'total_price' || field === 'discount') {
                updated.final_price = calcFinalPrice(updated);
            }
            return updated;
        }));
    };

    const addRow = () => setRows(prev => [...prev, defaultRow()]);
    const addSubtotal = (label) => setRows(prev => [...prev, defaultSubtotal(label)]);
    const removeRow = (id) => setRows(prev => prev.filter(r => r.id !== id));

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const payload = JSON.stringify({ rows, notes, final_confirmed: finalConfirmed });
            const stageId = stage?.id;
            if (!projectId || !stageId) {
                alert('缺少项目 ID 或阶段 ID，无法保存');
                return;
            }
            // Call API directly to ensure the PATCH is sent
            await projectApi.updateProjectStage(projectId, stageId, { feature_list: payload });
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
            // Also notify parent to reload data
            if (onSave) onSave({ feature_list: payload });
        } catch (err) {
            console.error('Save failed:', err);
            alert('保存失败：' + (err?.response?.data?.message || err.message || '未知错误'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleExport = async () => {
        setIsExporting(true);
        try {
            // Get the feature list from stage 1 (requirement_alignment)
            const featureStage = allStages?.find(s => s.stage_code === 'requirement_alignment');
            let featureList = [];
            if (featureStage?.feature_list) {
                try {
                    const raw = featureStage.feature_list;
                    featureList = raw.trim().startsWith('[') ? JSON.parse(raw) : [];
                } catch (e) { featureList = []; }
            }

            const response = await client.post('/project/export_quote_excel', {
                project_name: stage.project_name || '项目',
                rows,
                notes,
                total_price: totalPrice,
                total_final: totalFinal,
                final_confirmed: finalConfirmed,
                feature_list: featureList
            }, { responseType: 'blob' });

            const url = window.URL.createObjectURL(new Blob([response]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${stage.project_name || '项目'}_报价单.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
        } catch (err) {
            console.error('Export error:', err);
            alert('导出失败，请检查后端服务。');
        } finally {
            setIsExporting(false);
        }
    };

    // Chinese numeral counter for data rows
    let chineseCounter = 0;

    const inputStyle = {
        border: 'none',
        borderBottom: '1px solid #e2e8f0',
        background: 'transparent',
        outline: 'none',
        width: '100%',
        padding: '2px 4px',
        fontSize: '0.875rem'
    };

    const thStyle = {
        background: '#1f497d',
        color: '#fff',
        fontWeight: '600',
        padding: '8px 6px',
        textAlign: 'center',
        fontSize: '0.85rem',
        border: '1px solid #1a3d6e'
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div style={{
                background: '#fff', borderRadius: '12px', width: '95vw', maxWidth: '1200px',
                height: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
            }}>
                {/* Header */}
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '1rem 1.5rem', borderBottom: '1px solid #e2e8f0', background: '#f8fafc'
                }}>
                    <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#1e293b' }}>
                        📋 报价单 — {stage.project_name || '当前项目'}
                    </h2>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        {saveSuccess && (
                            <span style={{ fontSize: '0.875rem', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <CheckCircle size={14} /> 已保存至云端
                            </span>
                        )}
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                padding: '6px 14px', background: '#2563eb', color: '#fff',
                                border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem'
                            }}
                        >
                            <Save size={14} /> {isSaving ? '保存中...' : '保存'}
                        </button>
                        <button
                            onClick={handleExport}
                            disabled={isExporting}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                padding: '6px 14px', background: '#16a34a', color: '#fff',
                                border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem'
                            }}
                        >
                            <Download size={14} /> {isExporting ? '生成中...' : '导出 Excel'}
                        </button>
                        <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px' }}>
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
                    {/* Title */}
                    <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '0.25rem' }}>
                        {stage.project_name || '项目'}项目报价
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '0.85rem', color: '#666', marginBottom: '1rem' }}>
                        单位：人民币（元）
                    </div>

                    {/* Table */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                        <colgroup>
                            <col style={{ width: '60px' }} />
                            <col style={{ width: 'auto' }} />
                            <col style={{ width: '60px' }} />
                            <col style={{ width: '60px' }} />
                            <col style={{ width: '110px' }} />
                            <col style={{ width: '90px' }} />
                            <col style={{ width: '110px' }} />
                            <col style={{ width: '180px' }} />
                            <col style={{ width: '60px' }} />
                        </colgroup>
                        <thead>
                            <tr>
                                {['序号', '服务内容', '规格', '单位', '产品总价', '折扣率(%)', '折后价', '备注', ''].map((h, i) => (
                                    <th key={i} style={thStyle}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => {
                                if (row.is_subtotal) {
                                    const subtotalFinal = rows
                                        .filter(r => !r.is_subtotal)
                                        .reduce((s, r) => {
                                            const fp = parseFloat(r.final_price !== '' ? r.final_price : calcFinalPrice(r));
                                            return s + (isNaN(fp) ? 0 : fp);
                                        }, 0);
                                    return (
                                        <tr key={row.id} style={{ background: '#f0f7ff', fontStyle: 'italic', fontWeight: '600' }}>
                                            <td colSpan={4} style={{ padding: '6px 8px', textAlign: 'center', border: '1px solid #d4e4f7' }}>
                                                <input
                                                    value={row.subtotal_label}
                                                    onChange={e => handleRowChange(row.id, 'subtotal_label', e.target.value)}
                                                    style={{ ...inputStyle, textAlign: 'center', fontWeight: '600', fontStyle: 'italic' }}
                                                />
                                            </td>
                                            <td style={{ padding: '6px', border: '1px solid #d4e4f7', textAlign: 'center', fontStyle: 'italic', fontWeight: '600' }}>
                                                <input value={row.total_price} onChange={e => handleRowChange(row.id, 'total_price', e.target.value)} style={{ ...inputStyle, textAlign: 'center' }} />
                                            </td>
                                            <td style={{ border: '1px solid #d4e4f7' }} />
                                            <td style={{ padding: '6px', border: '1px solid #d4e4f7', textAlign: 'center', fontStyle: 'italic', fontWeight: '600' }}>
                                                <input value={row.final_price} onChange={e => handleRowChange(row.id, 'final_price', e.target.value)} style={{ ...inputStyle, textAlign: 'center' }} />
                                            </td>
                                            <td style={{ border: '1px solid #d4e4f7' }} />
                                            <td style={{ padding: '4px', border: '1px solid #d4e4f7', textAlign: 'center' }}>
                                                <button onClick={() => removeRow(row.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444' }}>
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                }

                                chineseCounter++;
                                const autoFinal = calcFinalPrice(row);
                                return (
                                    <tr key={row.id}>
                                        <td style={{ padding: '6px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                                            {CHINESE_NUMS[chineseCounter - 1] || chineseCounter}
                                        </td>
                                        <td style={{ padding: '6px', border: '1px solid #e2e8f0' }}>
                                            <input value={row.name} onChange={e => handleRowChange(row.id, 'name', e.target.value)} style={inputStyle} placeholder="服务内容" />
                                        </td>
                                        <td style={{ padding: '6px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                                            <input value={row.spec} onChange={e => handleRowChange(row.id, 'spec', e.target.value)} style={{ ...inputStyle, textAlign: 'center' }} placeholder="1" />
                                        </td>
                                        <td style={{ padding: '6px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                                            <input value={row.unit} onChange={e => handleRowChange(row.id, 'unit', e.target.value)} style={{ ...inputStyle, textAlign: 'center' }} />
                                        </td>
                                        <td style={{ padding: '6px', border: '1px solid #e2e8f0', textAlign: 'right' }}>
                                            <input value={row.total_price} onChange={e => handleRowChange(row.id, 'total_price', e.target.value)} style={{ ...inputStyle, textAlign: 'right' }} placeholder="0" />
                                        </td>
                                        <td style={{ padding: '6px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                                            <input value={row.discount} onChange={e => handleRowChange(row.id, 'discount', e.target.value)} style={{ ...inputStyle, textAlign: 'center' }} placeholder="100%" />
                                        </td>
                                        <td style={{ padding: '6px', border: '1px solid #e2e8f0', textAlign: 'right' }}>
                                            <input value={row.final_price !== '' ? row.final_price : autoFinal} onChange={e => handleRowChange(row.id, 'final_price', e.target.value)} style={{ ...inputStyle, textAlign: 'right' }} />
                                        </td>
                                        <td style={{ padding: '6px', border: '1px solid #e2e8f0' }}>
                                            <input value={row.remark} onChange={e => handleRowChange(row.id, 'remark', e.target.value)} style={inputStyle} placeholder="备注" />
                                        </td>
                                        <td style={{ padding: '4px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                                            <button onClick={() => removeRow(row.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444' }}>
                                                <Trash2 size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}

                            {/* Totals */}
                            <tr style={{ fontWeight: 'bold', color: '#dc2626' }}>
                                <td colSpan={4} style={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'center', background: '#fff7f7' }}>总计</td>
                                <td style={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', background: '#fff7f7' }}>{totalPrice.toLocaleString()}</td>
                                <td style={{ border: '1px solid #e2e8f0', background: '#fff7f7' }} />
                                <td style={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', background: '#fff7f7' }}>{totalFinal.toLocaleString()}</td>
                                <td colSpan={2} style={{ border: '1px solid #e2e8f0', background: '#fff7f7' }} />
                            </tr>
                            <tr style={{ fontWeight: 'bold', color: '#dc2626' }}>
                                <td colSpan={4} style={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'center', background: '#fff7f7' }}>最终确认</td>
                                <td style={{ border: '1px solid #e2e8f0', background: '#fff7f7' }} />
                                <td style={{ border: '1px solid #e2e8f0', background: '#fff7f7' }} />
                                <td style={{ padding: '4px 8px', border: '1px solid #e2e8f0', background: '#fff7f7' }}>
                                    <input
                                        type="number"
                                        value={finalConfirmed}
                                        onChange={e => setFinalConfirmed(e.target.value)}
                                        style={{ ...inputStyle, color: '#dc2626', fontWeight: 'bold', textAlign: 'right' }}
                                        placeholder={totalFinal || ''}
                                    />
                                </td>
                                <td colSpan={2} style={{ border: '1px solid #e2e8f0', background: '#fff7f7' }} />
                            </tr>
                        </tbody>
                    </table>

                    {/* Add row buttons */}
                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
                        <button
                            onClick={addRow}
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 12px', border: '1px dashed #94a3b8', borderRadius: '4px', background: '#f8fafc', cursor: 'pointer', fontSize: '0.8rem', color: '#475569' }}
                        >
                            <Plus size={12} /> 添加服务行
                        </button>
                        <button
                            onClick={() => {
                                const idx = rows.filter(r => r.is_subtotal).length + 1;
                                addSubtotal(`小计${idx}`);
                            }}
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 12px', border: '1px dashed #a5b4fc', borderRadius: '4px', background: '#f5f3ff', cursor: 'pointer', fontSize: '0.8rem', color: '#6366f1' }}
                        >
                            <Plus size={12} /> 添加小计行
                        </button>
                    </div>

                    {/* Notes section */}
                    <div style={{ marginTop: '1.5rem', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                        <div style={{ background: '#f1f5f9', padding: '8px 16px', fontWeight: '600', fontSize: '0.9rem', borderBottom: '1px solid #e2e8f0' }}>
                            备注
                        </div>
                        <div style={{ padding: '12px 16px' }}>
                            {notes.map((note, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
                                    <span style={{ minWidth: '20px', fontSize: '0.875rem', color: '#64748b' }}>{i + 1}、</span>
                                    <input
                                        value={note}
                                        onChange={e => {
                                            const arr = [...notes];
                                            arr[i] = e.target.value;
                                            setNotes(arr);
                                        }}
                                        style={{ flex: 1, border: 'none', borderBottom: '1px dashed #cbd5e1', outline: 'none', background: 'transparent', fontSize: '0.875rem', padding: '2px' }}
                                    />
                                    <button onClick={() => setNotes(notes.filter((_, j) => j !== i))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444' }}>
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            ))}
                            <button
                                onClick={() => setNotes([...notes, ''])}
                                style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', border: 'none', background: 'none', cursor: 'pointer', color: '#64748b', fontSize: '0.8rem' }}
                            >
                                <Plus size={12} /> 添加备注
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
