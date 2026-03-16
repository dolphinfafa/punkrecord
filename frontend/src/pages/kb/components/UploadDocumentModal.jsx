import { useState, useRef, useCallback } from 'react';
import { kbApi } from '@/api/kb';
import { Upload, X, File, Loader2 } from 'lucide-react';
import './UploadDocumentModal.css';

const SUPPORTED_FORMATS = [
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv',
    '.txt', '.md', '.png', '.jpg', '.jpeg', '.gif', '.webp'
];

function formatFileSize(bytes) {
    if (!bytes || !Number.isFinite(bytes)) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UploadDocumentModal({ onClose, onSuccess }) {
    const [selectedFile, setSelectedFile] = useState(null);
    const [title, setTitle] = useState('');
    const [uploading, setUploading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState('');
    const fileInputRef = useRef(null);

    const handleFileSelect = useCallback((file) => {
        if (!file) return;

        const maxSize = 50 * 1024 * 1024; // 50MB
        if (file.size > maxSize) {
            setError(`文件过大: ${formatFileSize(file.size)}。最大支持 50MB。`);
            return;
        }

        setSelectedFile(file);
        setError('');

        // Auto-fill title from filename if empty
        if (!title) {
            const nameWithoutExt = file.name.replace(/\.[^.]+$/, '');
            setTitle(nameWithoutExt);
        }
    }, [title]);

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleFileSelect(file);
    };

    const handleInputChange = (e) => {
        const file = e.target.files?.[0];
        if (file) handleFileSelect(file);
    };

    const handleUpload = async () => {
        if (!selectedFile) return;
        try {
            setUploading(true);
            setError('');
            await kbApi.uploadDocument(selectedFile, title.trim() || null);
            onSuccess();
        } catch (err) {
            setError(err?.response?.data?.message || err.message || '上传失败');
        } finally {
            setUploading(false);
        }
    };

    const handleRemoveFile = () => {
        setSelectedFile(null);
        setError('');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget && !uploading) {
            onClose();
        }
    };

    return (
        <div className="kb-modal-overlay" onClick={handleOverlayClick}>
            <div className="kb-modal">
                <div className="kb-modal-header">
                    <h2>上传文档</h2>
                    <button
                        className="kb-modal-close"
                        onClick={onClose}
                        disabled={uploading}
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="kb-modal-body">
                    {!selectedFile ? (
                        <div
                            className={`kb-upload-dropzone ${isDragging ? 'kb-upload-dropzone-active' : ''}`}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <Upload size={36} className="kb-upload-icon" />
                            <p className="kb-upload-text">拖拽文件到此处，或点击选择文件</p>
                            <span className="kb-upload-hint">
                                支持格式: PDF, Word, Excel, TXT, 图片
                            </span>
                            <span className="kb-upload-hint">最大 50MB</span>
                            <input
                                ref={fileInputRef}
                                type="file"
                                className="kb-upload-file-input"
                                accept={SUPPORTED_FORMATS.join(',')}
                                onChange={handleInputChange}
                            />
                        </div>
                    ) : (
                        <div className="kb-upload-selected">
                            <div className="kb-upload-file-info">
                                <File size={24} className="kb-upload-file-icon" />
                                <div className="kb-upload-file-details">
                                    <span className="kb-upload-file-name">{selectedFile.name}</span>
                                    <span className="kb-upload-file-size">{formatFileSize(selectedFile.size)}</span>
                                </div>
                                <button
                                    className="kb-icon-btn"
                                    onClick={handleRemoveFile}
                                    disabled={uploading}
                                    title="移除文件"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="kb-upload-title-field">
                        <label className="kb-upload-label">文档标题 (可选)</label>
                        <input
                            type="text"
                            className="kb-upload-title-input"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="留空将使用文件名作为标题"
                            disabled={uploading}
                        />
                    </div>

                    {error && (
                        <div className="kb-upload-error">{error}</div>
                    )}
                </div>

                <div className="kb-modal-footer">
                    <button
                        className="kb-btn"
                        onClick={onClose}
                        disabled={uploading}
                    >
                        取消
                    </button>
                    <button
                        className="kb-btn kb-btn-primary"
                        onClick={handleUpload}
                        disabled={!selectedFile || uploading}
                    >
                        {uploading ? (
                            <>
                                <Loader2 size={16} className="kb-spin" />
                                上传中...
                            </>
                        ) : (
                            <>
                                <Upload size={16} />
                                上传
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
