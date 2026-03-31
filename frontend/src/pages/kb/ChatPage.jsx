import { useState, useEffect, useRef, useCallback } from 'react';
import { kbApi } from '@/api/kb';
import { useNavigate } from 'react-router-dom';
import {
    Plus, Send, Trash2, MessageSquare, FileText, Loader2, Bot, User
} from 'lucide-react';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import './ChatPage.css';

export default function ChatPage() {
    const navigate = useNavigate();
    const [conversations, setConversations] = useState([]);
    const [activeConvId, setActiveConvId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [loadingConvs, setLoadingConvs] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [sending, setSending] = useState(false);
    const [streamingContent, setStreamingContent] = useState('');
    const [streamingRefs, setStreamingRefs] = useState([]);
    const messagesEndRef = useRef(null);
    const textareaRef = useRef(null);
    const abortControllerRef = useRef(null);

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    const loadConversations = useCallback(async () => {
        try {
            setLoadingConvs(true);
            const res = await kbApi.getConversations();
            const data = res.data || res;
            setConversations(Array.isArray(data) ? data : data.items || []);
        } catch {
            // silent
        } finally {
            setLoadingConvs(false);
        }
    }, []);

    const loadMessages = useCallback(async (convId) => {
        if (!convId) return;
        try {
            setLoadingMessages(true);
            const res = await kbApi.getMessages(convId);
            const data = res.data || res;
            setMessages(Array.isArray(data) ? data : data.items || []);
        } catch {
            setMessages([]);
        } finally {
            setLoadingMessages(false);
        }
    }, []);

    useEffect(() => {
        loadConversations();
    }, [loadConversations]);

    useEffect(() => {
        if (activeConvId) {
            loadMessages(activeConvId);
        } else {
            setMessages([]);
        }
    }, [activeConvId, loadMessages]);

    useEffect(() => {
        scrollToBottom();
    }, [messages, streamingContent, scrollToBottom]);

    const handleNewConversation = () => {
        setActiveConvId(null);
        setMessages([]);
        setStreamingContent('');
        setStreamingRefs([]);
        setInputText('');
    };

    const handleSelectConversation = (convId) => {
        if (sending) return;
        setActiveConvId(convId);
        setStreamingContent('');
        setStreamingRefs([]);
    };

    const handleDeleteConversation = async (e, convId) => {
        e.stopPropagation();
        if (!window.confirm('确定要删除这个对话吗？')) return;
        try {
            await kbApi.deleteConversation(convId);
            if (activeConvId === convId) {
                setActiveConvId(null);
                setMessages([]);
            }
            loadConversations();
        } catch (err) {
            alert(err.message || '删除失败');
        }
    };

    const handleSend = async () => {
        const message = inputText.trim();
        if (!message || sending) return;

        const userMessage = {
            id: `temp-${Date.now()}`,
            role: 'user',
            content: message,
            created_at: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInputText('');
        setSending(true);
        setStreamingContent('');
        setStreamingRefs([]);

        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }

        let currentConvId = activeConvId;

        try {
            // If no active conversation, create one first
            if (!currentConvId) {
                const createRes = await kbApi.createConversation({
                    title: message.slice(0, 50),
                });
                const convData = createRes.data || createRes;
                currentConvId = convData.id;
                setActiveConvId(currentConvId);
                loadConversations();
            }

            // SSE streaming
            const controller = new AbortController();
            abortControllerRef.current = controller;

            const response = await fetch('/api/v1/kb/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
                body: JSON.stringify({
                    message,
                    conversation_id: currentConvId,
                }),
                signal: controller.signal,
            });

            if (!response.ok) {
                throw new Error(`请求失败: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let accumulated = '';
            let refs = [];
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const jsonStr = line.slice(6).trim();
                    if (jsonStr === '[DONE]') continue;

                    try {
                        const parsed = JSON.parse(jsonStr);

                        if (parsed.type === 'content' || parsed.content) {
                            accumulated += parsed.content || parsed.text || '';
                            setStreamingContent(accumulated);
                        }

                        if (parsed.type === 'references' || parsed.references) {
                            refs = parsed.references || [];
                            setStreamingRefs(refs);
                        }

                        if (parsed.type === 'error') {
                            accumulated += `\n\n[错误: ${parsed.message || '未知错误'}]`;
                            setStreamingContent(accumulated);
                        }
                    } catch {
                        // skip unparseable lines
                    }
                }
            }

            // After stream ends, add the assistant message to messages
            const assistantMessage = {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: accumulated,
                references: refs,
                created_at: new Date().toISOString(),
            };

            setMessages((prev) => [...prev, assistantMessage]);
            setStreamingContent('');
            setStreamingRefs([]);
            loadConversations();
        } catch (err) {
            if (err.name === 'AbortError') return;
            const errorMessage = {
                id: `error-${Date.now()}`,
                role: 'assistant',
                content: `抱歉，发生了错误: ${err.message || '请求失败'}`,
                created_at: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, errorMessage]);
            setStreamingContent('');
        } finally {
            setSending(false);
            abortControllerRef.current = null;
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleTextareaInput = (e) => {
        setInputText(e.target.value);
        // Auto-resize
        e.target.style.height = 'auto';
        e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
    };

    const renderMessage = (msg) => {
        const isUser = msg.role === 'user';
        return (
            <div key={msg.id} className={`kb-chat-message ${isUser ? 'kb-chat-message-user' : 'kb-chat-message-assistant'}`}>
                <div className="kb-chat-message-avatar">
                    {isUser ? <User size={18} /> : <Bot size={18} />}
                </div>
                <div className="kb-chat-message-content">
                    <div className="kb-chat-message-bubble">
                        {isUser ? (
                            <p>{msg.content}</p>
                        ) : (
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                        )}
                    </div>
                    {!isUser && msg.references && msg.references.length > 0 && (
                        <div className="kb-chat-references">
                            <span className="kb-chat-references-label">
                                <FileText size={12} />
                                参考文档:
                            </span>
                            {msg.references.map((ref, i) => (
                                <button
                                    key={i}
                                    className="kb-chat-reference-link"
                                    onClick={() => {
                                        if (ref.document_id) {
                                            navigate(`/kb/documents/${ref.document_id}`);
                                        }
                                    }}
                                >
                                    {ref.title || ref.document_title || `文档 ${i + 1}`}
                                </button>
                            ))}
                        </div>
                    )}
                    <span className="kb-chat-message-time">
                        {msg.created_at ? format(new Date(msg.created_at), 'HH:mm') : ''}
                    </span>
                </div>
            </div>
        );
    };

    return (
        <div className="kb-chat-container">
            {/* Left sidebar */}
            <div className="kb-chat-sidebar">
                <div className="kb-chat-sidebar-header">
                    <button className="kb-btn kb-btn-primary kb-btn-full" onClick={handleNewConversation}>
                        <Plus size={16} />
                        新对话
                    </button>
                </div>
                <div className="kb-chat-conv-list">
                    {loadingConvs ? (
                        <div className="kb-chat-sidebar-loading">加载中...</div>
                    ) : conversations.length === 0 ? (
                        <div className="kb-chat-sidebar-empty">
                            <MessageSquare size={24} strokeWidth={1} />
                            <span>暂无对话</span>
                        </div>
                    ) : (
                        conversations.map((conv) => (
                            <div
                                key={conv.id}
                                className={`kb-chat-conv-item ${activeConvId === conv.id ? 'kb-chat-conv-active' : ''}`}
                                onClick={() => handleSelectConversation(conv.id)}
                            >
                                <div className="kb-chat-conv-info">
                                    <MessageSquare size={14} className="kb-chat-conv-icon" />
                                    <span className="kb-chat-conv-title">
                                        {conv.title || conv.first_message || '新对话'}
                                    </span>
                                </div>
                                <div className="kb-chat-conv-meta">
                                    <span className="kb-chat-conv-time">
                                        {conv.updated_at
                                            ? format(new Date(conv.updated_at), 'MM/dd HH:mm')
                                            : conv.created_at
                                            ? format(new Date(conv.created_at), 'MM/dd HH:mm')
                                            : ''}
                                    </span>
                                    <button
                                        className="kb-chat-conv-delete"
                                        onClick={(e) => handleDeleteConversation(e, conv.id)}
                                        title="删除对话"
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Right chat area */}
            <div className="kb-chat-main">
                <div className="kb-chat-messages">
                    {loadingMessages ? (
                        <div className="kb-chat-messages-loading">加载消息中...</div>
                    ) : messages.length === 0 && !streamingContent ? (
                        <div className="kb-chat-empty-state">
                            <Bot size={48} strokeWidth={1} />
                            <h3>企业大脑</h3>
                            <p>基于企业知识库的 AI 助手，您可以询问任何与企业文档相关的问题。</p>
                        </div>
                    ) : (
                        <>
                            {messages.map(renderMessage)}
                            {sending && streamingContent && (
                                <div className="kb-chat-message kb-chat-message-assistant">
                                    <div className="kb-chat-message-avatar">
                                        <Bot size={18} />
                                    </div>
                                    <div className="kb-chat-message-content">
                                        <div className="kb-chat-message-bubble">
                                            <ReactMarkdown>{streamingContent}</ReactMarkdown>
                                        </div>
                                        {streamingRefs.length > 0 && (
                                            <div className="kb-chat-references">
                                                <span className="kb-chat-references-label">
                                                    <FileText size={12} />
                                                    参考文档:
                                                </span>
                                                {streamingRefs.map((ref, i) => (
                                                    <button
                                                        key={i}
                                                        className="kb-chat-reference-link"
                                                        onClick={() => {
                                                            if (ref.document_id) {
                                                                navigate(`/kb/documents/${ref.document_id}`);
                                                            }
                                                        }}
                                                    >
                                                        {ref.title || ref.document_title || `文档 ${i + 1}`}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                            {sending && !streamingContent && (
                                <div className="kb-chat-message kb-chat-message-assistant">
                                    <div className="kb-chat-message-avatar">
                                        <Bot size={18} />
                                    </div>
                                    <div className="kb-chat-message-content">
                                        <div className="kb-chat-message-bubble kb-chat-typing">
                                            <span className="kb-typing-dot"></span>
                                            <span className="kb-typing-dot"></span>
                                            <span className="kb-typing-dot"></span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <div className="kb-chat-input-area">
                    <div className="kb-chat-input-wrapper">
                        <textarea
                            ref={textareaRef}
                            className="kb-chat-input"
                            value={inputText}
                            onChange={handleTextareaInput}
                            onKeyDown={handleKeyDown}
                            placeholder="输入问题，按 Enter 发送，Shift+Enter 换行..."
                            rows={1}
                            disabled={sending}
                        />
                        <button
                            className="kb-chat-send-btn"
                            onClick={handleSend}
                            disabled={sending || !inputText.trim()}
                            title="发送"
                        >
                            {sending ? <Loader2 size={18} className="kb-spin" /> : <Send size={18} />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
