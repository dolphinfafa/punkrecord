import React, { useEffect, useMemo, useState } from 'react';
import { X, Save, Download, CheckCircle, FileText } from 'lucide-react';
import projectApi from '@/api/project';

function todayISO() {
    return new Date().toISOString().slice(0, 10);
}

function buildMarkdown({
    projectName,
    projectNo,
    prototypeUrl,
    designUrl,
    confirmDate,
    pmName,
}) {
    return `# 原型确认单

项目名称：${projectName || '____'}
项目编号：${projectNo || '____'}
确认日期：${confirmDate || '____'}
项目经理：${pmName || '____'}

## 一、确认资料

1. 原型地址：${prototypeUrl || '____'}
2. 设计地址：${designUrl || '____'}

## 二、确认说明

1. 本确认单用于锁定当前版本的原型与设计稿，作为后续开发、测试、验收的依据。
2. 乙方将按确认内容进行功能实现；甲方新增或变更需求，按项目变更流程评估排期与费用。
3. 原型与设计中的交互说明、页面结构、字段规则为实现标准；未明确项由双方书面补充确认。
4. 本确认单生效后，若因甲方原因造成返工，双方按合同约定或补充协议执行。

## 三、范围与边界

1. 本次确认范围仅包含上述链接中的页面与交互，不包含链接外内容。
2. 视觉细节在不改变功能语义的前提下允许工程化落地微调。
3. 第三方接口、账号、资质、域名等外部依赖不在本确认单交付范围内。

## 四、签署栏

甲方代表（签字）：________________

日期：____年__月__日

乙方项目经理（签字）：________________

日期：____年__月__日
`;
}

const fieldStyle = {
    width: '100%',
    marginTop: '6px',
    border: '1px solid #cbd5e1',
    borderRadius: '10px',
    padding: '10px 12px',
    outline: 'none',
    fontSize: '0.9rem',
    backgroundColor: '#fff',
};

export default function PrototypeConfirmModal({ isOpen, onClose, stage, project, onSave }) {
    const [prototypeUrl, setPrototypeUrl] = useState('');
    const [designUrl, setDesignUrl] = useState('');
    const [confirmDate, setConfirmDate] = useState(todayISO());
    const [isSaving, setIsSaving] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    useEffect(() => {
        if (!isOpen || !stage) return;
        setPrototypeUrl('');
        setDesignUrl('');
        setConfirmDate(todayISO());
        setSaveSuccess(false);

        try {
            if (stage.feature_list && stage.feature_list.trim().startsWith('{')) {
                const parsed = JSON.parse(stage.feature_list);
                setPrototypeUrl(parsed.prototype_url || '');
                setDesignUrl(parsed.design_url || '');
                setConfirmDate(parsed.confirm_date || todayISO());
            }
        } catch (err) {
            console.warn('Failed to parse prototype confirmation payload:', err);
        }
    }, [isOpen, stage]);

    if (!isOpen || !stage) return null;

    const projectName = stage?.project_name || project?.name || '当前项目';
    const projectNo = project?.project_no || '';
    const pmName = project?.pm_name || '';

    const markdownContent = useMemo(() => {
        return buildMarkdown({
            projectName,
            projectNo,
            prototypeUrl,
            designUrl,
            confirmDate,
            pmName,
        });
    }, [projectName, projectNo, prototypeUrl, designUrl, confirmDate, pmName]);

    const handleSave = async () => {
        if (!prototypeUrl.trim() || !designUrl.trim()) {
            alert('请先填写原型地址和设计地址');
            return;
        }

        setIsSaving(true);
        try {
            const payload = JSON.stringify({
                doc_type: 'prototype_confirmation',
                prototype_url: prototypeUrl.trim(),
                design_url: designUrl.trim(),
                confirm_date: confirmDate || todayISO(),
                updated_at: new Date().toISOString(),
            });
            const deliverables = `原型: ${prototypeUrl.trim()} | 设计: ${designUrl.trim()}`;

            await projectApi.updateProjectStage(project.id, stage.id, {
                feature_list: payload,
                deliverables,
            });

            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2500);
            if (onSave) onSave();
        } catch (err) {
            console.error('Save prototype confirmation failed:', err);
            alert(err?.response?.data?.message || err.message || '保存失败');
        } finally {
            setIsSaving(false);
        }
    };

    const handleExportWord = async () => {
        if (!prototypeUrl.trim() || !designUrl.trim()) {
            alert('请先填写原型地址和设计地址');
            return;
        }

        setIsExporting(true);
        try {
            const token = localStorage.getItem('token');
            const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api/v1';
            const response = await fetch(`${baseUrl}/project/export-contract-docx`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    content_md: markdownContent,
                    filename: `${projectName}_原型确认单`,
                }),
            });
            if (!response.ok) throw new Error('导出失败');

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${projectName}_原型确认单.docx`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            alert(`导出失败: ${err.message}`);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'linear-gradient(130deg, rgba(15,23,42,0.82), rgba(30,58,138,0.72))',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '18px',
        }}>
            <div style={{
                width: 'min(1100px, 100%)',
                maxHeight: '92vh',
                overflow: 'hidden',
                background: '#ffffff',
                borderRadius: '18px',
                boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
                display: 'flex',
                flexDirection: 'column',
            }}>
                <div style={{
                    padding: '14px 18px',
                    borderBottom: '1px solid #e2e8f0',
                    background: 'linear-gradient(120deg, #0f172a 0%, #1d4ed8 55%, #0ea5e9 100%)',
                    color: '#fff',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '10px',
                    flexWrap: 'wrap',
                }}>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: '1.04rem' }}>原型确认单</div>
                        <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>{projectName} · 原型确认阶段</div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {saveSuccess && (
                            <span style={{ fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <CheckCircle size={14} /> 已保存
                            </span>
                        )}
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            style={{
                                border: 'none',
                                borderRadius: '9px',
                                padding: '7px 13px',
                                color: '#fff',
                                background: '#0284c7',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '0.85rem',
                            }}
                        >
                            <Save size={14} /> {isSaving ? '保存中...' : '保存'}
                        </button>
                        <button
                            onClick={handleExportWord}
                            disabled={isExporting}
                            style={{
                                border: 'none',
                                borderRadius: '9px',
                                padding: '7px 13px',
                                color: '#fff',
                                background: '#16a34a',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '0.85rem',
                            }}
                        >
                            <Download size={14} /> {isExporting ? '生成中...' : '生成确认单'}
                        </button>
                        <button
                            onClick={onClose}
                            style={{
                                border: '1px solid rgba(255,255,255,0.45)',
                                borderRadius: '8px',
                                padding: '6px',
                                color: '#fff',
                                background: 'transparent',
                                cursor: 'pointer',
                            }}
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                    gap: '16px',
                    padding: '16px',
                    overflow: 'auto',
                    background: '#f8fafc',
                }}>
                    <div style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: '14px',
                        padding: '16px',
                        background: 'linear-gradient(180deg, #f8fbff 0%, #ffffff 100%)',
                    }}>
                        <h3 style={{ margin: '0 0 12px', fontSize: '1rem', color: '#0f172a' }}>填写信息</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <label style={{ fontSize: '0.85rem', color: '#334155' }}>
                                原型地址
                                <input
                                    type="url"
                                    value={prototypeUrl}
                                    onChange={(e) => setPrototypeUrl(e.target.value)}
                                    placeholder="https://..."
                                    style={fieldStyle}
                                />
                            </label>
                            <label style={{ fontSize: '0.85rem', color: '#334155' }}>
                                设计地址
                                <input
                                    type="url"
                                    value={designUrl}
                                    onChange={(e) => setDesignUrl(e.target.value)}
                                    placeholder="https://..."
                                    style={fieldStyle}
                                />
                            </label>
                            <label style={{ fontSize: '0.85rem', color: '#334155' }}>
                                确认日期
                                <input
                                    type="date"
                                    value={confirmDate}
                                    onChange={(e) => setConfirmDate(e.target.value)}
                                    style={fieldStyle}
                                />
                            </label>
                        </div>
                    </div>

                    <div style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: '14px',
                        padding: '16px',
                        background: '#ffffff',
                    }}>
                        <h3 style={{ margin: '0 0 12px', fontSize: '1rem', color: '#0f172a' }}>模板预览</h3>
                        <div style={{
                            border: '1px solid #dbeafe',
                            borderRadius: '12px',
                            overflow: 'hidden',
                            background: '#fff',
                        }}>
                            <div style={{
                                background: 'linear-gradient(120deg, #eff6ff 0%, #f0f9ff 100%)',
                                borderBottom: '1px solid #dbeafe',
                                padding: '12px 14px',
                            }}>
                                <div style={{ textAlign: 'center', fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>原型确认单</div>
                                <div style={{ textAlign: 'center', marginTop: '4px', color: '#475569', fontSize: '0.8rem' }}>
                                    Prototype & Design Confirmation Form
                                </div>
                            </div>

                            <div style={{ padding: '14px', color: '#0f172a', lineHeight: 1.8, fontSize: '0.88rem' }}>
                                <div><strong>项目名称：</strong>{projectName}</div>
                                <div><strong>项目编号：</strong>{projectNo || '未填写'}</div>
                                <div><strong>确认日期：</strong>{confirmDate || '未填写'}</div>
                                <div><strong>项目经理：</strong>{pmName || '未填写'}</div>

                                <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #cbd5e1' }}>
                                    <div><strong>原型地址：</strong>{prototypeUrl || '未填写'}</div>
                                    <div><strong>设计地址：</strong>{designUrl || '未填写'}</div>
                                </div>

                                <div style={{
                                    marginTop: '10px',
                                    borderRadius: '10px',
                                    border: '1px solid #e2e8f0',
                                    background: '#f8fafc',
                                    padding: '10px 12px',
                                    color: '#334155',
                                }}>
                                    说明：本确认单用于锁定当前版本原型与设计，后续开发及验收以该版本为准；新增或变更需求按变更流程执行。
                                </div>

                                <div style={{ marginTop: '14px', color: '#2563eb', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                    <FileText size={14} />
                                    点击“生成确认单”导出 Word
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

