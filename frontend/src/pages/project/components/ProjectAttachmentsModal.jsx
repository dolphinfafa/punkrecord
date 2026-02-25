import React, { useEffect, useState, useRef } from 'react';
import { Upload, Paperclip, Trash2, Download, CloudUpload, File as FileIcon, Loader2 } from 'lucide-react';
import Modal from '@/components/common/Modal';
import projectApi from '@/api/project';
import './ProjectAttachmentsModal.css';

function formatSize(bytes) {
    if (!Number.isFinite(bytes)) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ProjectAttachmentsModal({ isOpen, onClose, projectId, projectName }) {
    const [attachments, setAttachments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef(null);

    const loadAttachments = React.useCallback(async () => {
        if (!projectId) return;
        try {
            setLoading(true);
            const res = await projectApi.getProjectAttachments(projectId);
            setAttachments(res?.data || []);
        } catch (err) {
            alert(err.message || '加载附件失败');
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        if (isOpen) {
            loadAttachments();
            setIsDragging(false); // Reset drag state when modal opens
        }
    }, [isOpen, loadAttachments]);

    const handleUpload = async (file) => {
        if (!file) return;

        // Basic size validation (20MB)
        if (file.size > 20 * 1024 * 1024) {
            alert(`文件过大: ${(file.size / (1024 * 1024)).toFixed(1)} MB。单个文件最大限制为 20 MB。`);
            return;
        }

        try {
            setUploading(true);
            const res = await projectApi.uploadProjectAttachment(projectId, file);
            const created = res?.data || res;
            setAttachments(prev => [...prev, created]);
        } catch (err) {
            alert(err.message || '上传附件失败');
        } finally {
            setUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!uploading) {
            setIsDragging(true);
        }
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (uploading) return;

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            await handleUpload(files[0]);
        }
    };

    const handleClickDropzone = () => {
        if (!uploading && fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleDownload = async (attachment) => {
        try {
            const response = await projectApi.downloadProjectAttachment(projectId, attachment.id);
            const blobUrl = window.URL.createObjectURL(response.data);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = attachment.file_name || 'attachment';
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(blobUrl);
        } catch (err) {
            alert(err.message || '下载附件失败');
        }
    };

    const handleDelete = async (attachmentId) => {
        if (!window.confirm('确定删除该附件吗？此操作不可恢复。')) return;
        try {
            await projectApi.deleteProjectAttachment(projectId, attachmentId);
            setAttachments(prev => prev.filter(item => item.id !== attachmentId));
        } catch (err) {
            alert(err.message || '删除附件失败');
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`项目附件 - ${projectName || '当前项目'}`}
            style={{ maxWidth: '800px', width: '90%' }}
        >
            <div className={`attachment-dropzone ${isDragging ? 'dragging' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={handleClickDropzone}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    style={{ display: 'none' }}
                    onChange={async (e) => {
                        const file = e.target.files?.[0];
                        await handleUpload(file);
                    }}
                />
                <div className="attachment-dropzone-content">
                    {uploading ? (
                        <>
                            <Loader2 className="attachment-dropzone-icon" size={48} strokeWidth={1.5} style={{ animation: 'spin 1s linear infinite' }} />
                            <span className="attachment-dropzone-title">上传中, 请稍候...</span>
                        </>
                    ) : (
                        <>
                            <CloudUpload className="attachment-dropzone-icon" size={48} strokeWidth={1.5} />
                            <span className="attachment-dropzone-title">点击或拖拽文件到此处上传</span>
                            <span className="attachment-dropzone-subtitle">单个文件最大 20 MB</span>
                        </>
                    )}
                </div>
            </div>

            <div style={{ marginTop: '24px' }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '16px', color: 'var(--text-color, #1e293b)' }}>
                    已上传附件 ({attachments.length})
                </h4>

                {loading ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        加载中...
                    </div>
                ) : attachments.length === 0 ? (
                    <div className="empty-state">
                        <FileIcon className="empty-state-icon" size={32} />
                        <p>暂无附件</p>
                    </div>
                ) : (
                    <ul className="attachment-list">
                        {attachments.map((item) => (
                            <li key={item.id} className="attachment-item">
                                <div className="attachment-info">
                                    <div className="attachment-icon-wrapper">
                                        <Paperclip size={20} strokeWidth={2} />
                                    </div>
                                    <div className="attachment-details">
                                        <button
                                            className="attachment-name"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDownload(item);
                                            }}
                                            title={item.file_name}
                                        >
                                            {item.file_name}
                                        </button>
                                        <div className="attachment-meta">
                                            <span>{formatSize(item.size)}</span>
                                            <span>•</span>
                                            <span>{item.uploaded_at ? new Date(item.uploaded_at).toLocaleString() : '-'}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="attachment-actions">
                                    <button
                                        className="attachment-action-btn"
                                        title="下载"
                                        onClick={() => handleDownload(item)}
                                    >
                                        <Download size={16} />
                                    </button>
                                    <button
                                        className="attachment-action-btn danger"
                                        title="删除"
                                        onClick={() => handleDelete(item.id)}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Global styles for the spinner if needed */}
            <style jsx="true">{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </Modal>
    );
}
