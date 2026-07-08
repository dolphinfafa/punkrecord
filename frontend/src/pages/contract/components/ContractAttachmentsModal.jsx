import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    CloudUpload,
    Download,
    Eye,
    FileImage,
    FileText,
    Loader2,
    Paperclip,
    Trash2,
} from 'lucide-react';
import Modal from '@/components/common/Modal';
import contractApi from '@/api/contract';
import './ContractAttachmentsModal.css';

function formatSize(bytes) {
    if (!Number.isFinite(bytes)) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isPreviewable(item) {
    const type = item.content_type || '';
    return type === 'application/pdf' || type.startsWith('image/');
}

function AttachmentIcon({ item }) {
    const type = item.content_type || '';
    if (type.startsWith('image/')) return <FileImage size={20} />;
    if (type === 'application/pdf') return <FileText size={20} />;
    return <Paperclip size={20} />;
}

export default function ContractAttachmentsModal({ isOpen, onClose, contract, onChanged }) {
    const [attachments, setAttachments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [dragging, setDragging] = useState(false);
    const fileInputRef = useRef(null);

    const contractId = contract?.id;

    const loadAttachments = useCallback(async () => {
        if (!contractId) return;
        try {
            setLoading(true);
            const res = await contractApi.listAttachments(contractId);
            setAttachments(res.data || []);
        } catch (err) {
            alert(err.response?.data?.message || err.message || '加载附件失败');
        } finally {
            setLoading(false);
        }
    }, [contractId]);

    useEffect(() => {
        if (isOpen) {
            setDragging(false);
            loadAttachments();
        }
    }, [isOpen, loadAttachments]);

    const syncChanged = (nextAttachments) => {
        onChanged?.(contractId, nextAttachments);
    };

    const validateFile = (file) => {
        if (!file) return false;
        if (file.size > 20 * 1024 * 1024) {
            alert('单个附件最大 20MB');
            return false;
        }
        const type = file.type || '';
        const name = file.name || '';
        const suffix = name.slice(name.lastIndexOf('.')).toLowerCase();
        const validSuffixes = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tif', '.tiff'];
        if (type !== 'application/pdf' && !type.startsWith('image/') && !validSuffixes.includes(suffix)) {
            alert('合同附件仅支持 PDF 或图片格式');
            return false;
        }
        return true;
    };

    const handleUpload = async (file) => {
        if (!validateFile(file)) return;
        try {
            setUploading(true);
            const res = await contractApi.uploadAttachment(contractId, file);
            const created = res.data || res;
            setAttachments(prev => {
                const next = [...prev, created];
                syncChanged(next);
                return next;
            });
        } catch (err) {
            alert(err.response?.data?.message || err.message || '上传附件失败');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDrop = async (event) => {
        event.preventDefault();
        event.stopPropagation();
        setDragging(false);
        if (uploading) return;
        const files = Array.from(event.dataTransfer.files || []);
        for (const file of files) {
            await handleUpload(file);
        }
    };

    const handleView = async (item) => {
        try {
            const response = await contractApi.downloadAttachment(contractId, item.id);
            const blobUrl = window.URL.createObjectURL(response.data);
            window.open(blobUrl, '_blank', 'noopener,noreferrer');
            setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60 * 1000);
        } catch (err) {
            alert(err.response?.data?.message || err.message || '打开附件失败');
        }
    };

    const handleDownload = async (item) => {
        try {
            const response = await contractApi.downloadAttachment(contractId, item.id);
            const blobUrl = window.URL.createObjectURL(response.data);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = item.file_name || 'attachment';
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(blobUrl);
        } catch (err) {
            alert(err.response?.data?.message || err.message || '下载附件失败');
        }
    };

    const handleDelete = async (item) => {
        if (!window.confirm(`确定删除附件「${item.file_name}」吗？`)) return;
        try {
            await contractApi.deleteAttachment(contractId, item.id);
            const next = attachments.filter((attachment) => attachment.id !== item.id);
            setAttachments(next);
            syncChanged(next);
        } catch (err) {
            alert(err.response?.data?.message || err.message || '删除附件失败');
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`合同附件 - ${contract?.name || '当前合同'}`}
            style={{ maxWidth: '760px', width: '90%' }}
        >
            <div
                className={`contract-attachment-dropzone ${dragging ? 'dragging' : ''}`}
                onClick={() => !uploading && fileInputRef.current?.click()}
                onDragOver={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (!uploading) setDragging(true);
                }}
                onDragLeave={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setDragging(false);
                }}
                onDrop={handleDrop}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf,image/*"
                    multiple
                    style={{ display: 'none' }}
                    onChange={async (event) => {
                        const files = Array.from(event.target.files || []);
                        for (const file of files) {
                            await handleUpload(file);
                        }
                    }}
                />
                {uploading ? (
                    <>
                        <Loader2 size={32} className="spin" />
                        <span>上传中...</span>
                    </>
                ) : (
                    <>
                        <CloudUpload size={34} />
                        <span>点击或拖拽上传合同附件</span>
                        <small>支持 PDF、图片；单个文件最大 20MB；可一次选择多个文件</small>
                    </>
                )}
            </div>

            <div className="contract-attachment-header">
                <strong>已上传附件</strong>
                <span>{attachments.length} 个</span>
            </div>

            {loading ? (
                <div className="contract-attachment-empty">
                    <Loader2 size={20} className="spin" />
                    加载中...
                </div>
            ) : attachments.length === 0 ? (
                <div className="contract-attachment-empty">
                    <Paperclip size={26} />
                    暂无附件
                </div>
            ) : (
                <ul className="contract-attachment-list">
                    {attachments.map((item) => (
                        <li key={item.id} className="contract-attachment-item">
                            <div className="contract-attachment-info">
                                <span className="contract-attachment-icon">
                                    <AttachmentIcon item={item} />
                                </span>
                                <div className="contract-attachment-meta">
                                    <button
                                        type="button"
                                        className="contract-attachment-name"
                                        title={item.file_name}
                                        onClick={() => isPreviewable(item) ? handleView(item) : handleDownload(item)}
                                    >
                                        {item.file_name}
                                    </button>
                                    <span>
                                        {formatSize(item.size)}
                                        {item.uploaded_at ? ` · ${new Date(item.uploaded_at).toLocaleString()}` : ''}
                                    </span>
                                </div>
                            </div>
                            <div className="contract-attachment-actions">
                                <button
                                    type="button"
                                    title="查看"
                                    disabled={!isPreviewable(item)}
                                    onClick={() => handleView(item)}
                                >
                                    <Eye size={16} />
                                </button>
                                <button type="button" title="下载" onClick={() => handleDownload(item)}>
                                    <Download size={16} />
                                </button>
                                <button type="button" title="删除" className="danger" onClick={() => handleDelete(item)}>
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </Modal>
    );
}
