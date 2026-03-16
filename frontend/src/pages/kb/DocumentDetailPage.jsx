import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { kbApi } from '@/api/kb';
import {
    ArrowLeft, Download, RefreshCw, Save, Plus, X,
    FileText, Clock, User, HardDrive, Tag
} from 'lucide-react';
import { format } from 'date-fns';
import './DocumentDetailPage.css';

const STATUS_CONFIG = {
    processing: { label: '处理中', className: 'kb-detail-status-processing' },
    ready: { label: '已就绪', className: 'kb-detail-status-ready' },
    failed: { label: '处理失败', className: 'kb-detail-status-failed' },
};

function formatFileSize(bytes) {
    if (!bytes || !Number.isFinite(bytes)) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [doc, setDoc] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [editTitle, setEditTitle] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [editTags, setEditTags] = useState([]);
    const [newTag, setNewTag] = useState('');
    const [hasChanges, setHasChanges] = useState(false);
    const [reprocessing, setReprocessing] = useState(false);

    const loadDocument = useCallback(async () => {
        try {
            setLoading(true);
            const res = await kbApi.getDocument(id);
            const data = res.data || res;
            setDoc(data);
            setEditTitle(data.title || '');
            setEditDescription(data.description || '');
            setEditTags(data.tags || []);
            setHasChanges(false);
            setError(null);
        } catch (err) {
            setError(err.message || '加载文档详情失败');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        loadDocument();
    }, [loadDocument]);

    const handleTitleChange = (value) => {
        setEditTitle(value);
        setHasChanges(true);
    };

    const handleDescriptionChange = (value) => {
        setEditDescription(value);
        setHasChanges(true);
    };

    const handleAddTag = () => {
        const tag = newTag.trim();
        if (!tag || editTags.includes(tag)) return;
        setEditTags([...editTags, tag]);
        setNewTag('');
        setHasChanges(true);
    };

    const handleRemoveTag = (tagToRemove) => {
        setEditTags(editTags.filter((t) => t !== tagToRemove));
        setHasChanges(true);
    };

    const handleTagKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddTag();
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            await kbApi.updateDocument(id, {
                title: editTitle,
                description: editDescription,
                tags: editTags,
            });
            setHasChanges(false);
            loadDocument();
        } catch (err) {
            alert(err.message || '保存失败');
        } finally {
            setSaving(false);
        }
    };

    const handleDownload = () => {
        const url = kbApi.downloadDocument(id);
        const token = localStorage.getItem('token');
        const a = document.createElement('a');
        a.href = url + (url.includes('?') ? '&' : '?') + `token=${token}`;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const handleReprocess = async () => {
        if (!window.confirm('确定要重新处理这个文档吗？')) return;
        try {
            setReprocessing(true);
            await kbApi.reprocessDocument(id);
            loadDocument();
        } catch (err) {
            alert(err.message || '重新处理失败');
        } finally {
            setReprocessing(false);
        }
    };

    if (loading) {
        return (
            <div className="kb-detail-container">
                <div className="kb-loading">加载中...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="kb-detail-container">
                <div className="kb-error-banner">{error}</div>
                <button className="kb-btn" onClick={() => navigate('/kb/documents')}>
                    <ArrowLeft size={16} />
                    返回文档列表
                </button>
            </div>
        );
    }

    if (!doc) return null;

    const statusCfg = STATUS_CONFIG[doc.status] || STATUS_CONFIG.processing;

    return (
        <div className="kb-detail-container">
            <div className="kb-detail-top-bar">
                <button className="kb-btn kb-btn-ghost" onClick={() => navigate('/kb/documents')}>
                    <ArrowLeft size={16} />
                    返回文档列表
                </button>
                <div className="kb-detail-top-actions">
                    <button className="kb-btn" onClick={handleDownload}>
                        <Download size={16} />
                        下载原文件
                    </button>
                    {doc.status === 'failed' && (
                        <button
                            className="kb-btn kb-btn-warning"
                            onClick={handleReprocess}
                            disabled={reprocessing}
                        >
                            <RefreshCw size={16} className={reprocessing ? 'kb-spin' : ''} />
                            {reprocessing ? '处理中...' : '重新处理'}
                        </button>
                    )}
                    {hasChanges && (
                        <button
                            className="kb-btn kb-btn-primary"
                            onClick={handleSave}
                            disabled={saving}
                        >
                            <Save size={16} />
                            {saving ? '保存中...' : '保存修改'}
                        </button>
                    )}
                </div>
            </div>

            <div className="kb-detail-grid">
                <div className="kb-detail-main">
                    <div className="kb-detail-card">
                        <label className="kb-detail-label">文档标题</label>
                        <input
                            type="text"
                            className="kb-detail-title-input"
                            value={editTitle}
                            onChange={(e) => handleTitleChange(e.target.value)}
                            placeholder="输入文档标题"
                        />
                    </div>

                    <div className="kb-detail-card">
                        <label className="kb-detail-label">描述</label>
                        <textarea
                            className="kb-detail-textarea"
                            value={editDescription}
                            onChange={(e) => handleDescriptionChange(e.target.value)}
                            placeholder="添加文档描述..."
                            rows={4}
                        />
                    </div>

                    <div className="kb-detail-card">
                        <label className="kb-detail-label">标签</label>
                        <div className="kb-detail-tags">
                            {editTags.map((tag) => (
                                <span key={tag} className="kb-detail-tag">
                                    {tag}
                                    <button
                                        className="kb-detail-tag-remove"
                                        onClick={() => handleRemoveTag(tag)}
                                    >
                                        <X size={12} />
                                    </button>
                                </span>
                            ))}
                            <div className="kb-detail-tag-add">
                                <input
                                    type="text"
                                    className="kb-detail-tag-input"
                                    value={newTag}
                                    onChange={(e) => setNewTag(e.target.value)}
                                    onKeyDown={handleTagKeyDown}
                                    placeholder="添加标签..."
                                />
                                <button className="kb-icon-btn" onClick={handleAddTag} disabled={!newTag.trim()}>
                                    <Plus size={16} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {doc.ai_summary && (
                        <div className="kb-detail-card">
                            <label className="kb-detail-label">AI 摘要</label>
                            <div className="kb-detail-summary">{doc.ai_summary}</div>
                        </div>
                    )}

                    {doc.extracted_text && (
                        <div className="kb-detail-card">
                            <label className="kb-detail-label">文本预览</label>
                            <div className="kb-detail-text-preview">{doc.extracted_text}</div>
                        </div>
                    )}
                </div>

                <div className="kb-detail-sidebar">
                    <div className="kb-detail-card kb-detail-meta-card">
                        <h3 className="kb-detail-meta-title">文档信息</h3>

                        <div className="kb-detail-meta-row">
                            <FileText size={15} />
                            <span className="kb-detail-meta-label">文件名</span>
                            <span className="kb-detail-meta-value">{doc.file_name || '-'}</span>
                        </div>

                        <div className="kb-detail-meta-row">
                            <Tag size={15} />
                            <span className="kb-detail-meta-label">文件类型</span>
                            <span className="kb-detail-meta-value">{doc.file_type || doc.content_type || '-'}</span>
                        </div>

                        <div className="kb-detail-meta-row">
                            <HardDrive size={15} />
                            <span className="kb-detail-meta-label">文件大小</span>
                            <span className="kb-detail-meta-value">{formatFileSize(doc.file_size)}</span>
                        </div>

                        <div className="kb-detail-meta-row">
                            <Clock size={15} />
                            <span className="kb-detail-meta-label">上传时间</span>
                            <span className="kb-detail-meta-value">
                                {doc.created_at
                                    ? format(new Date(doc.created_at), 'yyyy-MM-dd HH:mm:ss')
                                    : '-'}
                            </span>
                        </div>

                        <div className="kb-detail-meta-row">
                            <User size={15} />
                            <span className="kb-detail-meta-label">上传人</span>
                            <span className="kb-detail-meta-value">{doc.uploader_name || doc.uploader || '-'}</span>
                        </div>

                        <div className="kb-detail-meta-row">
                            <span className="kb-detail-meta-label" style={{ marginLeft: 21 }}>状态</span>
                            <span className={`kb-status-badge ${statusCfg.className}`}>{statusCfg.label}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
