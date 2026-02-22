import React, { useState, useEffect, useRef } from 'react';
import { X, Bot, Save, Sparkles, Send, Copy, Plus, Trash2, Download, CheckCircle2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import * as XLSX from 'xlsx';
import client from '../../../api/client';
import './StageEditModal.css';

const emptyRow = {
    index: '',
    product: '',
    module: '',
    l1_feature: '',
    l2_feature: '',
    description: '',
    dev_backend: '',
    dev_frontend: '',
    dev_ui: '',
    dev_product: ''
};

const FeatureListModal = ({ isOpen, onClose, stage, onSave }) => {
    const [tableData, setTableData] = useState([]);
    const [messages, setMessages] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [selectedModel, setSelectedModel] = useState('gemini-3.1-pro-preview');
    const messagesEndRef = useRef(null);

    useEffect(() => {
        if (isOpen && stage) {
            // Try parsing existing feature_list as JSON
            try {
                if (stage.feature_list && stage.feature_list.trim().startsWith('[')) {
                    setTableData(JSON.parse(stage.feature_list));
                } else {
                    setTableData([{ ...emptyRow }]);
                }
            } catch (e) {
                console.warn('Failed to parse existing feature_list, starting fresh');
                setTableData([{ ...emptyRow }]);
            }

            if (messages.length === 0) {
                setMessages([
                    {
                        role: 'model',
                        parts: ['你好！我是 Atlas AI。您可以直接在这里描述本项目需要哪些功能，我来帮您生成专业的《功能清单》。收到清单后，您可以点击一键采纳直接将表格渲染到左侧编辑区。']
                    }
                ]);
            }
        }
    }, [isOpen, stage]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    if (!isOpen || !stage) return null;

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave({ feature_list: JSON.stringify(tableData) });
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (error) {
            console.error('Failed to save feature list:', error);
            alert('保存失败，请稍后重试');
        } finally {
            setIsSaving(false);
        }
    };

    const exportToExcel = async () => {
        if (tableData.length === 0) return;
        try {
            const response = await client.post('/project/export_features_excel', {
                project_name: stage?.project_name || '当前项目',
                features: tableData
            }, {
                responseType: 'blob' // Important for downloading files
            });

            // Create a blob link to download
            const url = window.URL.createObjectURL(new Blob([response]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${stage?.project_name || '当前项目'}_功能清单.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
        } catch (error) {
            console.error('Failed to export Excel:', error);
            alert('导出 Excel 失败，请检查网络或后端服务。');
        }
    };

    const handleSendMessage = async () => {
        if (!inputValue.trim() || isGenerating) return;

        const newUserMessage = { role: 'user', parts: [inputValue] };
        const newMessages = [...messages, newUserMessage];
        setMessages(newMessages);
        setInputValue('');
        setIsGenerating(true);

        try {
            const apiMessages = newMessages.filter(m => m.role === 'user' || m.role === 'model');
            const response = await client.post('/ai/chat', {
                messages: apiMessages,
                model_name: selectedModel
            });

            if (response.code === 0 && response.data?.text) {
                setMessages(prev => [...prev, { role: 'model', parts: [response.data.text] }]);
            } else {
                setMessages(prev => [...prev, { role: 'model', parts: ['(AI服务返回异常，请稍后重试)'] }]);
            }
        } catch (error) {
            console.error('AI Chat error:', error);
            const errMsg = error.response ? JSON.stringify(error.response.data) : error.message;
            setMessages(prev => [...prev, { role: 'model', parts: [`(网络或服务出错，可能需要检查代理: ${errMsg})`] }]);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handleApplyTable = (text) => {
        // Try extracting JSON from markdown block if any
        let jsonStr = text;
        const jsonMatch = text.match(/```(?:json)?([\s\S]*?)```/);
        if (jsonMatch) {
            jsonStr = jsonMatch[1].trim();
        }

        try {
            const parsed = JSON.parse(jsonStr);
            if (Array.isArray(parsed)) {
                setTableData(parsed);
                alert('已成功覆盖至左侧表格！');
            } else {
                alert('AI 返回的数据格式不是标准的清单数组，无法解析！');
            }
        } catch (e) {
            console.error("JSON parse failed", e, text);
            alert('解析 AI 响应失败，因为返回内容不是标准 JSON 格式。');
        }
    };

    const handleCellChange = (index, field, value) => {
        const newData = [...tableData];
        newData[index][field] = value;
        setTableData(newData);
    };

    const handleAddRow = () => {
        setTableData([...tableData, { ...emptyRow }]);
    };

    const handleRemoveRow = (index) => {
        const newData = tableData.filter((_, i) => i !== index);
        setTableData(newData);
    };

    // Styling for minimal inputs
    const inputStyle = {
        width: '100%', border: 'none', background: 'transparent', outline: 'none', fontSize: '0.95rem', padding: '6px'
    };
    const inputWrapper = { borderBottom: '1px solid #e2e8f0', transition: 'border-color 0.2s', padding: '4px 0' };

    return (
        <div className="modal-overlay">
            <div className="modal-container" style={{ maxWidth: '1800px', width: '98vw', height: '95vh', display: 'flex', flexDirection: 'column' }}>
                <div className="modal-header">
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Sparkles size={20} className="text-primary" />
                        功能清单助手 - {stage.stage_name}
                    </h2>
                    <button className="btn-icon" onClick={onClose}><X size={20} /></button>
                </div>

                <div className="modal-body" style={{ display: 'flex', flex: 1, overflow: 'hidden', padding: 0, gap: '1px', backgroundColor: '#e2e8f0' }}>

                    {/* Left Pane: Data Table Editor */}
                    <div style={{ flex: 2, display: 'flex', flexDirection: 'column', backgroundColor: 'white', padding: '1.5rem', overflowY: 'auto', minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                详细功能清单记录单
                                {saveSuccess && <span style={{ fontSize: '0.85rem', color: '#16a34a', fontWeight: 'normal', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle2 size={14} /> 已保存至云端</span>}
                            </h3>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                    className="btn-secondary"
                                    onClick={exportToExcel}
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                                >
                                    <Download size={16} />
                                    导出 Excel
                                </button>
                                <button
                                    className="btn-primary"
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                                >
                                    <Save size={16} />
                                    {isSaving ? '保存中...' : '保存至项目'}
                                </button>
                            </div>
                        </div>

                        <div style={{ flex: 1, overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                            <table style={{ minWidth: '1200px', width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                                <thead style={{ backgroundColor: '#f8fafc', color: '#475569', position: 'sticky', top: 0, zIndex: 10 }}>
                                    <tr>
                                        <th style={{ padding: '0.75rem', borderBottom: '1px solid #e2e8f0', width: '50px' }}>序号</th>
                                        <th style={{ padding: '0.75rem', borderBottom: '1px solid #e2e8f0', width: '100px' }}>产品</th>
                                        <th style={{ padding: '0.75rem', borderBottom: '1px solid #e2e8f0', width: '100px' }}>模块</th>
                                        <th style={{ padding: '0.75rem', borderBottom: '1px solid #e2e8f0', width: '120px' }}>一级功能</th>
                                        <th style={{ padding: '0.75rem', borderBottom: '1px solid #e2e8f0', width: '120px' }}>二级功能</th>
                                        <th style={{ padding: '0.75rem', borderBottom: '1px solid #e2e8f0', minWidth: '200px' }}>功能说明</th>
                                        <th colSpan="4" style={{ padding: '0.75rem', borderBottom: '1px solid #e2e8f0', textAlign: 'center', borderLeft: '1px solid #e2e8f0' }}>开发时间估算</th>
                                        <th style={{ padding: '0.75rem', borderBottom: '1px solid #e2e8f0', width: '60px', textAlign: 'center' }}>操作</th>
                                    </tr>
                                    <tr style={{ backgroundColor: '#f1f5f9', color: '#64748b', fontSize: '0.8rem' }}>
                                        <th colSpan="6" style={{ borderBottom: '1px solid #cbd5e1' }}></th>
                                        <th style={{ padding: '0.5rem', borderBottom: '1px solid #cbd5e1', borderLeft: '1px solid #cbd5e1', width: '70px', textAlign: 'center' }}>后端</th>
                                        <th style={{ padding: '0.5rem', borderBottom: '1px solid #cbd5e1', width: '70px', textAlign: 'center' }}>前端</th>
                                        <th style={{ padding: '0.5rem', borderBottom: '1px solid #cbd5e1', width: '70px', textAlign: 'center' }}>UI设计</th>
                                        <th style={{ padding: '0.5rem', borderBottom: '1px solid #cbd5e1', width: '70px', textAlign: 'center' }}>产品</th>
                                        <th style={{ borderBottom: '1px solid #cbd5e1' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tableData.length === 0 ? (
                                        <tr>
                                            <td colSpan="11" style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>暂无数据</td>
                                        </tr>
                                    ) : tableData.map((row, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                                            <td style={{ padding: '0.5rem' }}>
                                                <div style={inputWrapper}><input style={inputStyle} value={row.index || ''} onChange={e => handleCellChange(idx, 'index', e.target.value)} placeholder="-" /></div>
                                            </td>
                                            <td style={{ padding: '0.5rem' }}>
                                                <div style={inputWrapper}><input style={inputStyle} value={row.product || ''} onChange={e => handleCellChange(idx, 'product', e.target.value)} placeholder="产品" /></div>
                                            </td>
                                            <td style={{ padding: '0.5rem' }}>
                                                <div style={inputWrapper}><input style={inputStyle} value={row.module || ''} onChange={e => handleCellChange(idx, 'module', e.target.value)} placeholder="模块" /></div>
                                            </td>
                                            <td style={{ padding: '0.5rem' }}>
                                                <div style={inputWrapper}><input style={inputStyle} value={row.l1_feature || ''} onChange={e => handleCellChange(idx, 'l1_feature', e.target.value)} placeholder="一功能" /></div>
                                            </td>
                                            <td style={{ padding: '0.5rem' }}>
                                                <div style={inputWrapper}><input style={inputStyle} value={row.l2_feature || ''} onChange={e => handleCellChange(idx, 'l2_feature', e.target.value)} placeholder="二功能" /></div>
                                            </td>
                                            <td style={{ padding: '0.5rem' }}>
                                                <div style={inputWrapper}>
                                                    <textarea
                                                        style={{ ...inputStyle, resize: 'vertical', minHeight: '60px', lineHeight: '1.4' }}
                                                        value={row.description || ''}
                                                        onChange={e => handleCellChange(idx, 'description', e.target.value)}
                                                        placeholder="支持换行输入说明..."
                                                    />
                                                </div>
                                            </td>
                                            <td style={{ padding: '0.5rem', borderLeft: '1px solid #f1f5f9' }}>
                                                <div style={inputWrapper}><input style={{ ...inputStyle, textAlign: 'center' }} value={row.dev_backend || ''} onChange={e => handleCellChange(idx, 'dev_backend', e.target.value)} placeholder="-" /></div>
                                            </td>
                                            <td style={{ padding: '0.5rem' }}>
                                                <div style={inputWrapper}><input style={{ ...inputStyle, textAlign: 'center' }} value={row.dev_frontend || ''} onChange={e => handleCellChange(idx, 'dev_frontend', e.target.value)} placeholder="-" /></div>
                                            </td>
                                            <td style={{ padding: '0.5rem' }}>
                                                <div style={inputWrapper}><input style={{ ...inputStyle, textAlign: 'center' }} value={row.dev_ui || ''} onChange={e => handleCellChange(idx, 'dev_ui', e.target.value)} placeholder="-" /></div>
                                            </td>
                                            <td style={{ padding: '0.5rem' }}>
                                                <div style={inputWrapper}><input style={{ ...inputStyle, textAlign: 'center' }} value={row.dev_product || ''} onChange={e => handleCellChange(idx, 'dev_product', e.target.value)} placeholder="-" /></div>
                                            </td>
                                            <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                                <button className="btn-icon text-danger" onClick={() => handleRemoveRow(idx)} title="删除行">
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
                            <button className="btn-secondary" onClick={handleAddRow} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Plus size={16} /> 添加一行功能
                            </button>
                            <span style={{ color: '#64748b', fontSize: '0.85rem', display: 'flex', alignItems: 'center' }}>提示：支持从右侧 AI 生成的功能清单中一键覆盖导入数据。</span>
                        </div>
                    </div>

                    {/* Right Pane: AI Chat */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc', minWidth: '400px' }}>
                        <div style={{ padding: '1rem 1.5rem', backgroundColor: 'white', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Bot size={20} className="text-primary" />
                                AI 列单助手
                            </h3>
                            <select
                                value={selectedModel}
                                onChange={(e) => setSelectedModel(e.target.value)}
                                style={{
                                    padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1',
                                    fontSize: '0.85rem', backgroundColor: '#f1f5f9', cursor: 'pointer', outline: 'none'
                                }}
                            >
                                <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (最新)</option>
                                <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                                <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                                <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                            </select>
                        </div>

                        {/* Chat History */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {messages.map((msg, idx) => (
                                <div key={idx} style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start'
                                }}>
                                    <div style={{
                                        maxWidth: '90%',
                                        padding: '1rem',
                                        borderRadius: '0.5rem',
                                        backgroundColor: msg.role === 'user' ? '#3b82f6' : 'white',
                                        color: msg.role === 'user' ? 'white' : '#1e293b',
                                        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                                        border: msg.role !== 'user' ? '1px solid #e2e8f0' : 'none'
                                    }}>
                                        {msg.role === 'model' && msg.parts[0].trim().startsWith('[') ? (() => {
                                            try {
                                                const parsedData = JSON.parse(msg.parts[0].replace(/```(?:json)?([\s\S]*?)```/g, '$1').trim());
                                                return (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                        <div style={{ fontSize: '0.9rem', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <CheckCircle2 size={16} /> <b>AI 已成功为您生成 {parsedData.length} 条结构化记录。</b>
                                                        </div>
                                                        <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '4px', backgroundColor: '#f8fafc', padding: '0.5rem' }}>
                                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                                                                <thead>
                                                                    <tr style={{ color: '#64748b', borderBottom: '1px solid #cbd5e1' }}>
                                                                        <th style={{ padding: '4px' }}>产品</th>
                                                                        <th style={{ padding: '4px' }}>模块</th>
                                                                        <th style={{ padding: '4px' }}>一级功能</th>
                                                                        <th style={{ padding: '4px' }}>二级功能</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {parsedData.slice(0, 10).map((item, i) => (
                                                                        <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                                            <td style={{ padding: '4px' }}>{item.product}</td>
                                                                            <td style={{ padding: '4px' }}>{item.module}</td>
                                                                            <td style={{ padding: '4px' }}>{item.l1_feature}</td>
                                                                            <td style={{ padding: '4px' }}>{item.l2_feature}</td>
                                                                        </tr>
                                                                    ))}
                                                                    {parsedData.length > 10 && (
                                                                        <tr><td colSpan="4" style={{ padding: '4px', textAlign: 'center', color: '#94a3b8' }}>... 还有 {parsedData.length - 10} 条记录 ...</td></tr>
                                                                    )}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>下方点击按钮即可将全部明细覆盖至您的主表内。</span>
                                                    </div>
                                                );
                                            } catch (e) {
                                                // Fallback if parsing fails despite starting with [
                                                return (
                                                    <div className="markdown-prose" style={{ color: 'inherit', fontSize: '0.9rem' }}>
                                                        <ReactMarkdown>{msg.parts[0]}</ReactMarkdown>
                                                    </div>
                                                );
                                            }
                                        })() : (
                                            <div className="markdown-prose" style={{ color: 'inherit', fontSize: '0.9rem' }}>
                                                <ReactMarkdown>{msg.parts[0]}</ReactMarkdown>
                                            </div>
                                        )}
                                    </div>
                                    {msg.role === 'model' && idx > 0 && msg.parts[0].includes('index') && (
                                        <div style={{ marginTop: '0.5rem' }}>
                                            <button
                                                className="btn-link"
                                                onClick={() => handleApplyTable(msg.parts[0])}
                                                style={{ fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                                            >
                                                <Copy size={14} /> 解析并覆盖至左侧表格
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                            {isGenerating && (
                                <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                                    <div style={{ padding: '1rem', backgroundColor: 'white', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                                        <div className="typing-indicator">
                                            <span></span><span></span><span></span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Chat Input */}
                        <div style={{ padding: '1rem 1.5rem', backgroundColor: 'white', borderTop: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <textarea
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="输入需求，让 AI 帮您生成详细功能清单 (Shift+Enter换行)..."
                                    style={{
                                        flex: 1,
                                        resize: 'none',
                                        height: '60px',
                                        padding: '0.75rem',
                                        borderRadius: '0.375rem',
                                        border: '1px solid #cbd5e1'
                                    }}
                                />
                                <button
                                    className="btn-primary"
                                    onClick={handleSendMessage}
                                    disabled={!inputValue.trim() || isGenerating}
                                    style={{ padding: '0 1.5rem' }}
                                >
                                    <Send size={20} />
                                </button>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default FeatureListModal;
