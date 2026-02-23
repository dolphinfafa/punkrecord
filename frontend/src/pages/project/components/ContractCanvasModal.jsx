import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    X, Send, Bot, User, RefreshCw, FileText,
    Save, Maximize2, Minimize2, Download,
    Building2, Calendar, ChevronDown, ChevronUp, DollarSign, PenTool
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import projectApi from '@/api/project';

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = {
    overlay: {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.7)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    modal: (fullscreen) => ({
        backgroundColor: '#f8fafc',
        width: fullscreen ? '100%' : '95%',
        maxWidth: '1700px',
        height: fullscreen ? '100%' : '94%',
        borderRadius: fullscreen ? '0' : '16px',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    }),
    header: {
        padding: '0.75rem 1.5rem',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
        color: 'white',
        flexShrink: 0,
    },
    leftPanel: {
        width: '380px', flexShrink: 0,
        borderRight: '1px solid #e2e8f0',
        display: 'flex', flexDirection: 'column',
        backgroundColor: '#ffffff',
        overflow: 'hidden',
    },
    rightPanel: {
        flex: 1, display: 'flex', flexDirection: 'column',
        backgroundColor: '#dde1e7', overflow: 'hidden',
    },
    docToolbar: {
        padding: '0.6rem 1.2rem', backgroundColor: '#f1f5f9',
        borderBottom: '1px solid #cbd5e1',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexShrink: 0,
    },
    docPage: {
        backgroundColor: 'white',
        maxWidth: '800px', margin: '0 auto',
        padding: '5rem 6rem',
        minHeight: '297mm', // A4 height
        boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
        fontFamily: "'Source Han Serif CN', 'Noto Serif SC', 'SimSun', serif",
        lineHeight: 1.9,
        fontSize: '14px',
        color: '#1a1a1a',
    },
    contextCard: {
        backgroundColor: '#f0f7ff',
        border: '1px solid #bfdbfe',
        borderRadius: '8px',
        padding: '0.75rem 1rem',
        margin: '0.75rem',
        fontSize: '0.82rem',
    },
    btn: {
        padding: '0.45rem 1rem', borderRadius: '6px', border: 'none',
        cursor: 'pointer', fontWeight: '500',
        display: 'flex', alignItems: 'center', gap: '0.4rem',
        fontSize: '0.85rem',
        transition: 'all 0.15s',
    },
};

// ─── Markdown Document Styles ──────────────────────────────────────────────────
const mdDocStyles = `
.contract-doc h1 { font-size: 18px; font-weight: bold; text-align: center; margin: 0 0 1.5rem; letter-spacing: 2px; }
.contract-doc h2 { font-size: 15px; font-weight: bold; margin: 1.5rem 0 0.5rem; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
.contract-doc h3 { font-size: 14px; font-weight: bold; margin: 1rem 0 0.4rem; }
.contract-doc p  { margin: 0.5rem 0; text-align: justify; text-indent: 2em; }
.contract-doc ul, .contract-doc ol { margin: 0.4rem 0 0.4rem 2rem; }
.contract-doc li { margin: 0.25rem 0; }
.contract-doc table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
.contract-doc th, .contract-doc td { border: 1px solid #999; padding: 6px 10px; }
.contract-doc th { background: #f0f0f0; font-weight: bold; text-align: center; }
.contract-doc td { text-align: center; }
.contract-doc hr { border: none; border-top: 1px solid #ccc; margin: 1rem 0; }
.contract-doc strong { font-weight: bold; }
.contract-doc em { font-style: italic; }
.contract-doc blockquote { border-left: 3px solid #0ea5e9; margin: 0.5rem 0 0.5rem 1rem; padding: 0.25rem 1rem; color: #475569; background: #f0f9ff; }
`;

// ─── Helper: build context summary string for system prompt ───────────────────
function buildContextSummary(ctx) {
    if (!ctx) return '';
    const lines = [];
    const p = ctx.project;
    if (p) {
        lines.push(`项目名称: ${p.name}，项目编号: ${p.project_no}`);
        if (p.description) lines.push(`项目描述: ${p.description}`);
        if (p.start_at) lines.push(`开始日期: ${p.start_at}，截止日期: ${p.due_at || '未设定'}`);
    }
    if (ctx.pm?.name) lines.push(`项目经理: ${ctx.pm.name}，邮箱: ${ctx.pm.email || ''}`);

    // 甲方 = customer / party_a
    const a = ctx.party_a;
    if (a?.name) {
        let line = `甲方（客户）: ${a.name}`;
        if (a.identifier) line += `，统一社会信用代码：${a.identifier}`;
        if (a.address) line += `，地址：${a.address}`;
        if (a.bank_name) line += `，开户行：${a.bank_name}`;
        if (a.bank_account) line += `，账号：${a.bank_account}`;
        if (a.phone) line += `，电话：${a.phone}`;
        lines.push(line);
    }

    // 乙方 = 我方主体
    const b = ctx.party_b || ctx.our_entity;
    if (b?.name) {
        let line = `乙方（我方）: ${b.legal_name || b.name}`;
        if (b.uscc) line += `，统一社会信用代码：${b.uscc}`;
        if (b.address) line += `，地址：${b.address}`;
        lines.push(line);
    }

    if (ctx.party_c?.name) {
        lines.push(`丙方: ${ctx.party_c.name}${ctx.party_c.identifier ? `，税号：${ctx.party_c.identifier}` : ''}`);
    }

    if (ctx.contract) {
        const c = ctx.contract;
        let line = `合同金额: ${c.amount_total} ${c.currency}`;
        if (c.sign_date) line += `，签署日期：${c.sign_date}`;
        if (c.expire_date) line += `，到期日：${c.expire_date}`;
        lines.push(line);
        if (c.summary) lines.push(`合同摘要: ${c.summary}`);
    }
    return lines.join('\n');
}


// ─── Available Models ────────────────────────────────────────────────────────
const MODELS = [
    { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (Default)' },
    { value: 'gemini-2.0-flash', label: 'Flash 2.0 ⚡ (fast)' },
    { value: 'gemini-2.5-pro-exp-03-25', label: 'Pro 2.5 ✨ (advanced)' },
    { value: 'gemini-2.0-flash-thinking-exp', label: 'Flash Thinking 🧠' },
    { value: 'gemini-1.5-pro', label: 'Pro 1.5' },
];

// ─── Context Info Panel ────────────────────────────────────────────────────────
function ContextPanel({ ctx }) {
    const [expanded, setExpanded] = useState(false);
    if (!ctx) return null;

    const p = ctx.project;
    const a = ctx.party_a;          // 甲方 = customer
    const b = ctx.party_b || ctx.our_entity; // 乙方 = our entity

    const InfoRow = ({ label, value }) => value ? (
        <div style={{ display: 'flex', gap: '0.3rem' }}>
            <span style={{ color: '#6b7280', flexShrink: 0 }}>{label}:</span>
            <span style={{ color: '#1e40af', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</span>
        </div>
    ) : null;

    return (
        <div style={styles.contextCard}>
            <div
                onClick={() => setExpanded(e => !e)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            >
                <span style={{ fontWeight: '600', color: '#1d4ed8', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Building2 size={13} /> 已加载项目上下文
                </span>
                {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </div>
            {expanded && (
                <div style={{ marginTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.2rem', lineHeight: 1.7, fontSize: '0.8rem' }}>
                    {p && <InfoRow label="项目" value={`${p.name}（${p.project_no}）`} />}
                    {p?.start_at && <InfoRow label="周期" value={`${p.start_at} → ${p.due_at || '未定'}`} />}
                    {ctx.pm && <InfoRow label="负责人" value={ctx.pm.name} />}
                    {a && (
                        <div style={{ marginTop: '0.4rem', paddingTop: '0.4rem', borderTop: '1px solid #bfdbfe' }}>
                            <div style={{ color: '#1d4ed8', fontWeight: '600', marginBottom: '0.2rem' }}>甲方（客户）</div>
                            <InfoRow label="名称" value={a.name} />
                            <InfoRow label="税号" value={a.identifier} />
                            <InfoRow label="地址" value={a.address} />
                            <InfoRow label="开户行" value={a.bank_name} />
                            <InfoRow label="账号" value={a.bank_account} />
                            <InfoRow label="电话" value={a.phone} />
                        </div>
                    )}
                    {b && (
                        <div style={{ marginTop: '0.4rem', paddingTop: '0.4rem', borderTop: '1px solid #bfdbfe' }}>
                            <div style={{ color: '#1d4ed8', fontWeight: '600', marginBottom: '0.2rem' }}>乙方（我方）</div>
                            <InfoRow label="名称" value={b.legal_name || b.name} />
                            <InfoRow label="税号" value={b.uscc} />
                            <InfoRow label="地址" value={b.address} />
                        </div>
                    )}
                    {ctx.contract && (
                        <div style={{ marginTop: '0.4rem', paddingTop: '0.4rem', borderTop: '1px solid #bfdbfe' }}>
                            <InfoRow label="合同金额" value={`${ctx.contract.amount_total} ${ctx.contract.currency}`} />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function ContractCanvasModal({ isOpen, stage, project, onClose, onSave }) {
    const [messages, setMessages] = useState([]);
    const [inputPrompt, setInputPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [contractContent, setContractContent] = useState(stage?.deliverables || '');
    const [isFullscreen, setIsFullscreen] = useState(true);
    const [contractCtx, setContractCtx] = useState(null);
    const [isExporting, setIsExporting] = useState(false);
    const [selectedModel, setSelectedModel] = useState('gemini-3.1-pro-preview');
    const messagesEndRef = useRef(null);
    const textareaRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Load project context once on open
    useEffect(() => {
        if (!isOpen || !project?.id) return;
        projectApi.getProjectContractContext(project.id)
            .then(res => setContractCtx(res.data))
            .catch(err => console.warn('Failed to load contract context:', err));
    }, [isOpen, project?.id]);

    const getSystemPrompt = useCallback(() => {
        const contextSummary = buildContextSummary(contractCtx);
        return `你是一名专业的法律合同起草助手，帮助用户生成、润色和修改合同。
        
${contextSummary ? `以下是本次合同相关的项目基本信息，请在生成合同时尽量填入这些真实数据：\n---\n${contextSummary}\n---\n` : ''}

当前合同草稿（如有）：
---
${contractContent || '（空）'}
---

要求：
1. 以Markdown格式输出完整合同正文。用#标记大标题，##标记章节，###标记条款。
2. 直接输出合同内容，不要用代码块包裹，不要加前言或总结。
3. 合同中的金额、日期、当事方、项目名称等信息请使用上面提供的真实数据填入，若数据不存在则用空格占位（如"____元"）。
4. 如用户要求修改，只修改指定部分，保持其余内容不变。`;
    }, [contractContent, contractCtx]);

    const handleGenerate = async () => {
        if (!inputPrompt.trim() || isGenerating) return;

        const userMsg = { role: 'user', content: inputPrompt };
        const newMessages = [...messages, userMsg];
        setMessages(newMessages);
        setInputPrompt('');
        setIsGenerating(true);

        const apiMessages = newMessages.map(m => ({ role: m.role, parts: [m.content] }));

        try {
            setMessages(prev => [...prev, { role: 'model', content: '' }]);

            const token = localStorage.getItem('token');
            const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api/v1';
            const response = await fetch(`${baseUrl}/ai/chat-stream`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    messages: apiMessages,
                    model_name: selectedModel,
                    system_instruction: getSystemPrompt(),
                }),
            });

            if (!response.ok) throw new Error(`请求失败: ${response.status}`);

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let accumulated = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });

                for (const line of chunk.split('\n')) {
                    if (!line.startsWith('data: ')) continue;
                    const dataStr = line.replace('data: ', '').trim();
                    if (!dataStr) continue;
                    try {
                        const data = JSON.parse(dataStr);
                        if (data.error) { console.error('Stream error:', data.error); break; }
                        const textChunk = data.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (textChunk) {
                            accumulated += textChunk;
                            setMessages(prev => {
                                const msgs = [...prev];
                                msgs[msgs.length - 1] = { role: 'model', content: accumulated };
                                return msgs;
                            });
                            setContractContent(accumulated);
                        }
                    } catch { /* ignore parse errors */ }
                }
            }
        } catch (err) {
            console.error('Generation failed:', err);
            setMessages(prev => {
                const msgs = [...prev];
                msgs[msgs.length - 1] = { role: 'model', content: `*错误: ${err.message}*` };
                return msgs;
            });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSave = () => onSave({ deliverables: contractContent });

    const handleExportWord = async () => {
        if (!contractContent || isExporting) return;
        setIsExporting(true);
        try {
            const token = localStorage.getItem('token');
            const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api/v1';
            const response = await fetch(`${baseUrl}/project/export-contract-docx`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    content_md: contractContent,
                    filename: `${project?.name || '合同'}_合同`,
                }),
            });
            if (!response.ok) throw new Error('导出失败');
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${project?.name || '合同'}_合同.docx`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            alert('导出Word失败: ' + err.message);
        } finally {
            setIsExporting(false);
        }
    };

    const quickPrompts = [
        { label: '🔒 NDA保密协议', text: '帮我生成一份B2B软件开发保密协议(NDA)，请使用项目信息填入甲乙双方内容。' },
        { label: '📋 软件开发合同', text: '起草一份完整的软件开发外包合同，包含项目范围、工期、验收标准和付款条款，使用已有项目信息。' },
        { label: '🤝 技术服务协议', text: '生成一份技术服务框架协议，包含服务内容、服务级别(SLA)、双方权责、保密条款和争议解决。' },
    ];

    if (!isOpen) return null;

    return (
        <div style={styles.overlay}>
            <style>{mdDocStyles}</style>
            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                .spinning { animation: spin 1s linear infinite; }
                .doc-scroll::-webkit-scrollbar { width: 8px; }
                .doc-scroll::-webkit-scrollbar-track { background: #d1d5db; }
                .doc-scroll::-webkit-scrollbar-thumb { background: #9ca3af; border-radius: 4px; }
                .chat-scroll::-webkit-scrollbar { width: 6px; }
                .chat-scroll::-webkit-scrollbar-track { background: white; }
                .chat-scroll::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 3px; }
            `}</style>
            <div style={styles.modal(isFullscreen)}>

                {/* ── Header ── */}
                <div style={styles.header}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ padding: '8px', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: '8px' }}>
                            <PenTool size={20} />
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: '600', letterSpacing: '0.5px' }}>
                                AI 合同起草 Canvas
                            </h2>
                            <p style={{ margin: 0, fontSize: '0.78rem', opacity: 0.7 }}>{stage?.project_name} · 合同签署阶段</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {/* Model selector */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}>
                            <select
                                value={selectedModel}
                                onChange={e => setSelectedModel(e.target.value)}
                                disabled={isGenerating}
                                style={{
                                    backgroundColor: 'rgba(255,255,255,0.12)',
                                    color: 'white', border: '1px solid rgba(255,255,255,0.25)',
                                    borderRadius: '6px', padding: '0.35rem 0.5rem',
                                    fontSize: '0.78rem', cursor: 'pointer',
                                    outline: 'none', maxWidth: '200px',
                                }}
                            >
                                {MODELS.map(m => (
                                    <option key={m.value} value={m.value} style={{ backgroundColor: '#1e3a5f', color: 'white' }}>
                                        {m.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div style={{ width: '1px', height: '24px', backgroundColor: 'rgba(255,255,255,0.2)' }} />
                        <button
                            onClick={handleExportWord}
                            disabled={isExporting || !contractContent}
                            style={{
                                ...styles.btn,
                                backgroundColor: contractContent ? '#16a34a' : '#94a3b8',
                                color: 'white', opacity: isExporting ? 0.7 : 1
                            }}
                        >
                            {isExporting ? <RefreshCw size={14} className="spinning" /> : <Download size={14} />}
                            导出 Word
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!contractContent}
                            style={{
                                ...styles.btn,
                                backgroundColor: contractContent ? '#0ea5e9' : '#94a3b8',
                                color: 'white'
                            }}
                        >
                            <Save size={14} />保存到交付物
                        </button>
                        <div style={{ width: '1px', height: '24px', backgroundColor: 'rgba(255,255,255,0.2)', margin: '0 0.25rem' }} />
                        <button
                            onClick={() => setIsFullscreen(f => !f)}
                            style={{ ...styles.btn, backgroundColor: 'rgba(255,255,255,0.1)', color: 'white' }}
                        >
                            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                        </button>
                        <button
                            onClick={onClose}
                            style={{ ...styles.btn, backgroundColor: 'rgba(255,255,255,0.1)', color: 'white', padding: '0.45rem' }}
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* ── Body ── */}
                <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

                    {/* Left Panel: Chat */}
                    <div style={styles.leftPanel}>
                        {/* Context info */}
                        <ContextPanel ctx={contractCtx} />

                        {/* Quick prompts */}
                        {messages.length === 0 && (
                            <div style={{ padding: '0 0.75rem 0.5rem', flexShrink: 0 }}>
                                <p style={{ margin: '0 0 0.4rem 0.25rem', fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>快速模板:</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                    {quickPrompts.map(qp => (
                                        <button
                                            key={qp.label}
                                            onClick={() => { setInputPrompt(qp.text); textareaRef.current?.focus(); }}
                                            style={{
                                                background: '#f8fafc', border: '1px solid #e2e8f0',
                                                borderRadius: '6px', padding: '0.5rem 0.75rem',
                                                textAlign: 'left', cursor: 'pointer',
                                                fontSize: '0.8rem', color: '#334155',
                                                transition: 'all 0.15s',
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.background = '#e0f2fe'; e.currentTarget.style.borderColor = '#7dd3fc'; }}
                                            onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
                                        >
                                            {qp.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Messages */}
                        <div
                            className="chat-scroll"
                            style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
                        >
                            {messages.length === 0 && (
                                <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem 0' }}>
                                    <Bot size={36} style={{ margin: '0 auto 0.5rem', opacity: 0.25 }} />
                                    <p style={{ fontSize: '0.85rem', margin: 0 }}>请选择模板或输入需求开始生成</p>
                                </div>
                            )}
                            {messages.map((msg, idx) => (
                                <div key={idx} style={{
                                    display: 'flex', gap: '0.5rem',
                                    flexDirection: msg.role === 'user' ? 'row-reverse' : 'row'
                                }}>
                                    <div style={{
                                        width: '26px', height: '26px', borderRadius: '50%',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        backgroundColor: msg.role === 'user' ? '#0369a1' : '#0d9488',
                                        color: 'white', flexShrink: 0, marginTop: '2px'
                                    }}>
                                        {msg.role === 'user' ? <User size={12} /> : <Bot size={12} />}
                                    </div>
                                    <div style={{
                                        maxWidth: '88%',
                                        padding: '0.6rem 0.9rem',
                                        borderRadius: msg.role === 'user' ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
                                        backgroundColor: msg.role === 'user' ? '#0369a1' : '#f1f5f9',
                                        color: msg.role === 'user' ? 'white' : '#1e293b',
                                        border: msg.role === 'user' ? 'none' : '1px solid #e2e8f0',
                                        fontSize: '0.82rem',
                                        lineHeight: 1.55,
                                        whiteSpace: 'pre-wrap',
                                    }}>
                                        {msg.content
                                            ? (msg.role === 'model'
                                                ? <span style={{ opacity: 0.7 }}>{msg.content.length > 120 ? msg.content.slice(0, 120) + '...' : msg.content}</span>
                                                : msg.content)
                                            : (isGenerating && idx === messages.length - 1
                                                ? <span style={{ opacity: 0.5, display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                                                    <RefreshCw size={12} className="spinning" /> 正在生成...
                                                </span>
                                                : '')
                                        }
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <div style={{ padding: '0.75rem', borderTop: '1px solid #e2e8f0', flexShrink: 0 }}>
                            <div style={{
                                border: `1px solid ${isGenerating ? '#94a3b8' : '#cbd5e1'}`,
                                borderRadius: '8px', overflow: 'hidden', backgroundColor: 'white',
                                transition: 'border-color 0.2s',
                            }}>
                                <textarea
                                    ref={textareaRef}
                                    value={inputPrompt}
                                    onChange={e => setInputPrompt(e.target.value)}
                                    placeholder="描述合同需求，或修改右侧内容..."
                                    rows={3}
                                    style={{
                                        width: '100%', border: 'none', padding: '0.65rem 0.75rem',
                                        resize: 'none', outline: 'none', fontSize: '0.85rem',
                                        lineHeight: 1.6, boxSizing: 'border-box',
                                    }}
                                    disabled={isGenerating}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleGenerate();
                                        }
                                    }}
                                />
                                <div style={{
                                    display: 'flex', justifyContent: 'flex-end',
                                    padding: '0.4rem 0.5rem', backgroundColor: '#f8fafc',
                                    borderTop: '1px solid #f1f5f9'
                                }}>
                                    <button
                                        onClick={handleGenerate}
                                        disabled={isGenerating || !inputPrompt.trim()}
                                        style={{
                                            backgroundColor: (isGenerating || !inputPrompt.trim()) ? '#cbd5e1' : '#0369a1',
                                            color: 'white', border: 'none', borderRadius: '6px',
                                            padding: '0.35rem 0.85rem',
                                            cursor: (isGenerating || !inputPrompt.trim()) ? 'not-allowed' : 'pointer',
                                            display: 'flex', alignItems: 'center', gap: '0.35rem',
                                            fontSize: '0.82rem', fontWeight: '500',
                                        }}
                                    >
                                        {isGenerating ? <RefreshCw size={13} className="spinning" /> : <Send size={13} />}
                                        {isGenerating ? '生成中' : '发送'}
                                    </button>
                                </div>
                            </div>
                            <p style={{ margin: '0.4rem 0 0', fontSize: '0.72rem', color: '#94a3b8', textAlign: 'center' }}>
                                Enter 发送 · Shift+Enter 换行
                            </p>
                        </div>
                    </div>

                    {/* Right Panel: Document Preview */}
                    <div style={styles.rightPanel}>
                        <div style={styles.docToolbar}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: '#475569' }}>
                                {isGenerating
                                    ? <span style={{ color: '#0369a1', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <RefreshCw size={13} className="spinning" /> AI 实时生成中...
                                    </span>
                                    : <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <FileText size={13} /> 合同预览（Markdown 渲染）
                                    </span>
                                }
                            </div>
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                {contractContent ? `${contractContent.length} 字符` : ''}
                            </span>
                        </div>

                        <div className="doc-scroll" style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
                            <div style={styles.docPage}>
                                {contractContent ? (
                                    <div className="contract-doc">
                                        <ReactMarkdown>{contractContent}</ReactMarkdown>
                                    </div>
                                ) : (
                                    <div style={{
                                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                                        justifyContent: 'center', height: '50vh', color: '#cbd5e1'
                                    }}>
                                        <FileText size={72} style={{ marginBottom: '1rem', opacity: 0.3 }} />
                                        <p style={{ fontSize: '1.1rem', margin: '0 0 0.5rem', color: '#94a3b8' }}>文档为空</p>
                                        <p style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>在左侧发送指令以开始 AI 生成</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
