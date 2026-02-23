import React, { useState, useEffect } from 'react';
import {
    X, CheckSquare, Square, ChevronDown, ChevronRight,
    Zap, Users, AlertCircle, CheckCircle, RefreshCw
} from 'lucide-react';
import projectApi from '@/api/project';

// ─── Constants ────────────────────────────────────────────────────────────────
const PRIORITY_OPTIONS = [
    { value: 'p0', label: 'P0 紧急', color: '#dc2626' },
    { value: 'p1', label: 'P1 高', color: '#ea580c' },
    { value: 'p2', label: 'P2 中', color: '#ca8a04' },
    { value: 'p3', label: 'P3 低', color: '#16a34a' },
];

const DEV_TYPE_LABELS = {
    dev_backend: '后端', dev_frontend: '前端', dev_ui: 'UI设计', dev_product: '产品'
};

const DEV_TYPE_COLORS = {
    dev_backend: '#3b82f6', dev_frontend: '#8b5cf6', dev_ui: '#ec4899', dev_product: '#f59e0b'
};

const STATUS_COLORS = { open: '#3b82f6', in_progress: '#f59e0b', done: '#16a34a', blocked: '#dc2626' };
const STATUS_LABELS = { open: '待开始', in_progress: '进行中', done: '已完成', blocked: '阻塞', pending_review: '待验收', dismissed: '已忽略' };

// ─── Helpers ─────────────────────────────────────────────────────────────────
function groupByModule(featureList) {
    const groups = {};
    (featureList || []).forEach(row => {
        const mod = row.module || '其他';
        if (!groups[mod]) groups[mod] = [];
        groups[mod].push(row);
    });
    return groups;
}

function buildTaskTitle(row, devType) {
    const typeLabel = DEV_TYPE_LABELS[devType] || devType;
    const name = [row.l1_feature, row.l2_feature].filter(Boolean).join(' - ');
    return `[${typeLabel}] ${name}`;
}

function getDevTypes(row) {
    if (!row) return ['dev_backend'];
    // Values are stored as strings like "8", "16", "" or "-". Treat any non-empty, non-zero, non-dash as valid.
    const valid = ['dev_backend', 'dev_frontend', 'dev_ui', 'dev_product'].filter(k => {
        const v = String(row[k] || '').trim();
        return v && v !== '-' && v !== '0';
    });
    return valid.length > 0 ? valid : [];  // return empty if nothing, row won't appear as separate task type
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
    overlay: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.7)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    modal: { background: 'white', borderRadius: '16px', width: '96%', maxWidth: '1100px', height: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px rgba(0,0,0,0.3)' },
    header: { padding: '1rem 1.5rem', background: 'linear-gradient(135deg, #1e3a5f 0%, #0f766e 100%)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
    stepBar: { display: 'flex', gap: '1rem', padding: '0.75rem 1.5rem', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', flexShrink: 0 },
    step: (active) => ({ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 1rem', borderRadius: '20px', fontSize: '0.85rem', fontWeight: active ? '600' : '400', background: active ? '#0f172a' : 'transparent', color: active ? 'white' : '#94a3b8', cursor: 'default' }),
    body: { flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem' },
    footer: { padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, background: '#f8fafc' },
    btn: (variant) => ({
        padding: '0.5rem 1.2rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
        fontWeight: '500', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.4rem',
        background: variant === 'primary' ? '#0f172a' : variant === 'success' ? '#16a34a' : '#f1f5f9',
        color: variant === 'primary' || variant === 'success' ? 'white' : '#334155',
    }),
    tag: (color) => ({ display: 'inline-block', padding: '0.1rem 0.5rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: '600', background: color + '20', color }),
    input: { border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.35rem 0.6rem', fontSize: '0.82rem', width: '100%', outline: 'none' },
    select: { border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.35rem 0.5rem', fontSize: '0.82rem', outline: 'none', width: '100%' },
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function GenerateTasksModal({ isOpen, project, onClose, onSuccess }) {
    const [step, setStep] = useState(1); // 1=select, 2=configure
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [featureData, setFeatureData] = useState(null); // { feature_list, members, source_stage }
    const [selectedRows, setSelectedRows] = useState({}); // key: rowIndex_devType -> true
    const [collapsedModules, setCollapsedModules] = useState({});
    const [taskConfigs, setTaskConfigs] = useState({}); // key: rowIndex_devType -> { title, assignee_user_id, priority, due_at, description }
    const [successCount, setSuccessCount] = useState(null);

    useEffect(() => {
        if (!isOpen || !project?.id) return;
        setStep(1);
        setSelectedRows({});
        setTaskConfigs({});
        setError(null);
        setSuccessCount(null);
        setLoading(true);
        projectApi.getProjectFeatureList(project.id)
            .then(res => setFeatureData(res.data))
            .catch(err => setError('无法加载功能清单：' + (err.message || '未知错误')))
            .finally(() => setLoading(false));
    }, [isOpen, project?.id]);

    if (!isOpen) return null;

    const featureList = featureData?.feature_list || [];
    const members = featureData?.members || [];
    const grouped = groupByModule(featureList);
    const defaultAssignee = members[0]?.id || '';
    const defaultDue = project?.due_at ? project.due_at.slice(0, 10) : '';

    // ── Step 1: Selection ──
    const toggleRow = (rowKey) => {
        setSelectedRows(prev => ({ ...prev, [rowKey]: !prev[rowKey] }));
    };

    const toggleAll = () => {
        const allKeys = [];
        featureList.forEach((row, i) => {
            const types = getDevTypes(row);
            (types.length > 0 ? types : ['dev_backend']).forEach(t => allKeys.push(`${i}|${t}`));
        });
        const allSelected = allKeys.every(k => selectedRows[k]);
        const next = {};
        if (!allSelected) allKeys.forEach(k => (next[k] = true));
        setSelectedRows(next);
    };

    const selectedCount = Object.values(selectedRows).filter(Boolean).length;

    // ── Step 2: Config ──
    const goToStep2 = () => {
        // Init taskConfigs for selected rows
        const configs = {};
        Object.entries(selectedRows).filter(([, v]) => v).forEach(([key]) => {
            const sepIdx = key.indexOf('|');
            const iStr = key.slice(0, sepIdx);
            const devType = key.slice(sepIdx + 1);
            const row = featureList[parseInt(iStr)];
            if (!row) return;
            configs[key] = {
                title: buildTaskTitle(row, devType),
                description: row.description || '',
                assignee_user_id: defaultAssignee,
                priority: 'p2',
                due_at: defaultDue,
                dev_type: devType,
                feature_key: key,
            };
        });
        setTaskConfigs(configs);
        setStep(2);
    };

    const updateConfig = (key, field, value) => {
        setTaskConfigs(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
    };

    const handleGenerate = async () => {
        const tasks = Object.values(taskConfigs).filter(t => t.assignee_user_id);
        if (tasks.length === 0) { setError('至少需要为一个任务分配负责人'); return; }
        setSubmitting(true);
        setError(null);
        try {
            const payload = tasks.map(t => ({
                title: t.title,
                description: t.description,
                assignee_user_id: t.assignee_user_id,
                priority: t.priority,
                due_at: t.due_at ? new Date(t.due_at).toISOString() : null,
                dev_type: t.dev_type,
                feature_key: t.feature_key,
            }));
            const res = await projectApi.generateDevTasks(project.id, payload);
            setSuccessCount(res.data?.created || tasks.length);
            setTimeout(() => { onSuccess?.(); onClose(); }, 1500);
        } catch (err) {
            setError('生成失败：' + (err.response?.data?.message || err.message));
        } finally {
            setSubmitting(false);
        }
    };

    // ── Render Step 1: Feature Selection ──
    const renderStep1 = () => (
        <div>
            {featureData?.source_stage && (
                <div style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <AlertCircle size={13} /> 功能清单来源：{featureData.source_stage}
                </div>
            )}
            {Object.entries(grouped).map(([module, rows]) => {
                const collapsed = collapsedModules[module];
                const moduleKeys = [];
                rows.forEach((row, localIdx) => {
                    const globalIdx = featureList.indexOf(row);
                    const types = getDevTypes(row);
                    (types.length > 0 ? types : ['dev_backend']).forEach(t => moduleKeys.push(`${globalIdx}|${t}`));
                });
                const allModuleSelected = moduleKeys.every(k => selectedRows[k]);

                return (
                    <div key={module} style={{ marginBottom: '0.75rem', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                        {/* Module header */}
                        <div
                            style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 0.85rem', background: '#f1f5f9', cursor: 'pointer', userSelect: 'none' }}
                            onClick={() => setCollapsedModules(p => ({ ...p, [module]: !p[module] }))}
                        >
                            <span onClick={e => { e.stopPropagation(); const next = {}; moduleKeys.forEach(k => (next[k] = !allModuleSelected)); setSelectedRows(p => ({ ...p, ...next })); }} style={{ flexShrink: 0 }}>
                                {allModuleSelected ? <CheckSquare size={15} color="#0f172a" /> : <Square size={15} color="#94a3b8" />}
                            </span>
                            {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                            <span style={{ fontWeight: '600', fontSize: '0.875rem', color: '#1e293b' }}>{module}</span>
                            <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#64748b' }}>{rows.length} 项</span>
                        </div>
                        {/* Feature rows */}
                        {!collapsed && rows.map((row, localIdx) => {
                            const globalIdx = featureList.indexOf(row);
                            const types = getDevTypes(row);
                            const displayTypes = types.length > 0 ? types : ['dev_backend'];
                            return displayTypes.map(devType => {
                                const key = `${globalIdx}|${devType}`;
                                const checked = !!selectedRows[key];
                                return (
                                    <div
                                        key={key}
                                        onClick={() => toggleRow(key)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 0.85rem 0.5rem 2rem',
                                            borderTop: '1px solid #f1f5f9', cursor: 'pointer',
                                            background: checked ? '#f0fdf4' : 'white',
                                            transition: 'background 0.1s',
                                        }}
                                    >
                                        {checked ? <CheckSquare size={14} color="#16a34a" /> : <Square size={14} color="#cbd5e1" />}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: '0.82rem', color: '#1e293b', fontWeight: '500' }}>
                                                {[row.l1_feature, row.l2_feature].filter(Boolean).join(' / ')}
                                            </div>
                                            {row.description && (
                                                <div style={{ fontSize: '0.75rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.description}</div>
                                            )}
                                        </div>
                                        <span style={S.tag(DEV_TYPE_COLORS[devType] || '#64748b')}>{DEV_TYPE_LABELS[devType] || devType}</span>
                                        {row[devType] && (
                                            <span style={{ fontSize: '0.75rem', color: '#94a3b8', flexShrink: 0 }}>{row[devType]}h</span>
                                        )}
                                    </div>
                                );
                            });
                        })}
                    </div>
                );
            })}
        </div>
    );

    // ── Render Step 2: Task Configuration ──
    const renderStep2 = () => {
        const configEntries = Object.entries(taskConfigs);
        return (
            <div>
                <div style={{ marginBottom: '0.75rem', fontSize: '0.82rem', color: '#64748b' }}>
                    共 {configEntries.length} 个任务，请为每条任务指定负责人（必填）
                </div>
                {/* Header */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 0.6fr 1fr', gap: '0.5rem', padding: '0.4rem 0.5rem', background: '#f8fafc', borderRadius: '6px', marginBottom: '0.5rem', fontSize: '0.77rem', color: '#64748b', fontWeight: '600' }}>
                    <span>任务标题</span>
                    <span>负责人</span>
                    <span>优先级</span>
                    <span>截止日期</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {configEntries.map(([key, cfg]) => {
                        const sepIdx = key.indexOf('|');
                        const devType = key.slice(sepIdx + 1);
                        const row = featureList[parseInt(key.slice(0, sepIdx))];
                        return (
                            <div key={key} style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 0.6fr 1fr', gap: '0.5rem', alignItems: 'center', padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '8px', background: 'white' }}>
                                <div>
                                    <input
                                        style={S.input}
                                        value={cfg.title}
                                        onChange={e => updateConfig(key, 'title', e.target.value)}
                                    />
                                    <span style={{ ...S.tag(DEV_TYPE_COLORS[devType] || '#94a3b8'), marginTop: '0.2rem' }}>{DEV_TYPE_LABELS[devType] || devType}</span>
                                </div>
                                <select
                                    style={S.select}
                                    value={cfg.assignee_user_id}
                                    onChange={e => updateConfig(key, 'assignee_user_id', e.target.value)}
                                >
                                    <option value="">— 请选择 —</option>
                                    {members.map(m => (
                                        <option key={m.id} value={m.id}>{m.display_name}{m.is_pm ? ' (PM)' : ''}</option>
                                    ))}
                                </select>
                                <select
                                    style={S.select}
                                    value={cfg.priority}
                                    onChange={e => updateConfig(key, 'priority', e.target.value)}
                                >
                                    {PRIORITY_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                                </select>
                                <input
                                    type="date"
                                    style={S.input}
                                    value={cfg.due_at || ''}
                                    onChange={e => updateConfig(key, 'due_at', e.target.value)}
                                />
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div style={S.overlay}>
            <div style={S.modal}>
                {/* Header */}
                <div style={S.header}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ padding: '7px', background: 'rgba(255,255,255,0.15)', borderRadius: '8px' }}>
                            <Zap size={18} />
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: '600' }}>从功能清单生成开发任务</h2>
                            <p style={{ margin: 0, fontSize: '0.78rem', opacity: 0.7 }}>{project?.name} · 开发阶段</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '6px', padding: '0.4rem', cursor: 'pointer', color: 'white' }}>
                        <X size={16} />
                    </button>
                </div>

                {/* Step bar */}
                <div style={S.stepBar}>
                    <div style={S.step(step === 1)}>
                        <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: step === 1 ? 'white' : '#e2e8f0', color: step === 1 ? '#0f172a' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: '700' }}>1</span>
                        选择功能点
                    </div>
                    <div style={{ color: '#cbd5e1', fontSize: '1.2rem', lineHeight: 1 }}>›</div>
                    <div style={S.step(step === 2)}>
                        <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: step === 2 ? 'white' : '#e2e8f0', color: step === 2 ? '#0f172a' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: '700' }}>2</span>
                        配置任务
                    </div>
                </div>

                {/* Body */}
                <div style={S.body}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                            <RefreshCw size={32} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 0.75rem' }} />
                            正在加载功能清单...
                        </div>
                    ) : error ? (
                        <div style={{ padding: '1.5rem', background: '#fef2f2', borderRadius: '8px', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <AlertCircle size={16} /> {error}
                        </div>
                    ) : featureList.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                            <p>本项目暂无功能清单数据</p>
                            <p style={{ fontSize: '0.82rem' }}>请先在"报价"阶段使用 AI 生成功能清单</p>
                        </div>
                    ) : successCount !== null ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: '#16a34a' }}>
                            <CheckCircle size={48} style={{ margin: '0 auto 1rem' }} />
                            <p style={{ fontSize: '1.2rem', fontWeight: '600' }}>成功生成 {successCount} 个开发任务！</p>
                        </div>
                    ) : step === 1 ? renderStep1() : renderStep2()}
                </div>

                {/* Footer */}
                {!loading && !error && featureList.length > 0 && successCount === null && (
                    <div style={S.footer}>
                        <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                            {step === 1
                                ? `已选 ${selectedCount} 个任务点 · 总功能: ${featureList.length} 条`
                                : `${Object.keys(taskConfigs).length} 个任务待生成`
                            }
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {step === 1 && (
                                <button style={S.btn('secondary')} onClick={toggleAll}>
                                    {selectedCount > 0 ? '全不选' : '全选'}
                                </button>
                            )}
                            {step === 2 && (
                                <button style={S.btn('secondary')} onClick={() => setStep(1)}>← 返回</button>
                            )}
                            {step === 1 && (
                                <button
                                    style={{ ...S.btn('primary'), opacity: selectedCount === 0 ? 0.5 : 1 }}
                                    disabled={selectedCount === 0}
                                    onClick={goToStep2}
                                >
                                    下一步：配置任务 →
                                </button>
                            )}
                            {step === 2 && (
                                <button
                                    style={{ ...S.btn('success'), opacity: submitting ? 0.7 : 1 }}
                                    disabled={submitting}
                                    onClick={handleGenerate}
                                >
                                    {submitting ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> 生成中...</> : <><Zap size={14} /> 一键生成任务</>}
                                </button>
                            )}
                        </div>
                    </div>
                )}
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        </div>
    );
}
