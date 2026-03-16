import React, { useState, useRef } from 'react';
import { meetingApi } from '@/api/meeting';
import { Upload, X, FileAudio, Loader2, AlertCircle } from 'lucide-react';
import './UploadAudioModal.css';

const ACCEPTED_FORMATS = ['.mp3', '.wav', '.m4a', '.flac', '.ogg'];
const ACCEPTED_MIME = 'audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,audio/flac,audio/ogg';
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function UploadAudioModal({ onClose, onSuccess }) {
    const [file, setFile] = useState(null);
    const [title, setTitle] = useState('');
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef(null);

    const validateFile = (f) => {
        if (!f) return '请选择文件';
        const ext = '.' + f.name.split('.').pop().toLowerCase();
        if (!ACCEPTED_FORMATS.includes(ext)) {
            return `不支持的文件格式。支持格式: ${ACCEPTED_FORMATS.join(', ')}`;
        }
        if (f.size > MAX_FILE_SIZE) {
            return `文件大小超过限制 (最大 ${formatFileSize(MAX_FILE_SIZE)})`;
        }
        return '';
    };

    const handleFileSelect = (f) => {
        const err = validateFile(f);
        if (err) {
            setError(err);
            setFile(null);
            return;
        }
        setError('');
        setFile(f);
        if (!title) {
            // Auto-fill title from filename (without extension)
            const nameWithoutExt = f.name.replace(/\.[^/.]+$/, '');
            setTitle(nameWithoutExt);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        const droppedFile = e.dataTransfer.files?.[0];
        if (droppedFile) {
            handleFileSelect(droppedFile);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setDragOver(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setDragOver(false);
    };

    const handleUpload = async () => {
        if (!file) {
            setError('请选择音频文件');
            return;
        }
        if (!title.trim()) {
            setError('请输入会议标题');
            return;
        }

        try {
            setUploading(true);
            setError('');
            await meetingApi.createMeeting(file, title.trim());
            onSuccess();
        } catch (err) {
            setError(err?.response?.data?.message || err.message || '上传失败，请重试');
        } finally {
            setUploading(false);
        }
    };

    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget && !uploading) {
            onClose();
        }
    };

    return (
        <div className="modal-overlay" onClick={handleOverlayClick}>
            <div className="upload-modal">
                <div className="upload-modal-header">
                    <h2>上传会议音频</h2>
                    <button className="modal-close-btn" onClick={onClose} disabled={uploading}>
                        <X size={20} />
                    </button>
                </div>

                <div className="upload-modal-body">
                    {/* Title input */}
                    <div className="form-group">
                        <label className="form-label">会议标题 <span className="required">*</span></label>
                        <input
                            type="text"
                            className="form-input"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="输入会议标题"
                            disabled={uploading}
                        />
                    </div>

                    {/* Drop zone */}
                    <div className="form-group">
                        <label className="form-label">音频文件 <span className="required">*</span></label>
                        <div
                            className={`drop-zone ${dragOver ? 'drop-zone-active' : ''} ${file ? 'drop-zone-has-file' : ''}`}
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onClick={() => !uploading && fileInputRef.current?.click()}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept={ACCEPTED_MIME}
                                onChange={(e) => handleFileSelect(e.target.files?.[0])}
                                style={{ display: 'none' }}
                                disabled={uploading}
                            />

                            {file ? (
                                <div className="file-selected">
                                    <FileAudio size={32} className="file-icon" />
                                    <div className="file-info">
                                        <span className="file-name">{file.name}</span>
                                        <span className="file-size">{formatFileSize(file.size)}</span>
                                    </div>
                                    {!uploading && (
                                        <button
                                            className="file-remove-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setFile(null);
                                            }}
                                        >
                                            <X size={16} />
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="drop-zone-content">
                                    <Upload size={36} className="drop-icon" />
                                    <p className="drop-text">拖拽音频文件到此处，或点击选择</p>
                                    <p className="drop-hint">
                                        支持格式: MP3, WAV, M4A, FLAC, OGG (最大 {formatFileSize(MAX_FILE_SIZE)})
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="upload-error">
                            <AlertCircle size={16} />
                            <span>{error}</span>
                        </div>
                    )}
                </div>

                <div className="upload-modal-footer">
                    <button className="btn btn-secondary" onClick={onClose} disabled={uploading}>
                        取消
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={handleUpload}
                        disabled={uploading || !file || !title.trim()}
                    >
                        {uploading ? (
                            <>
                                <Loader2 size={16} className="spin" /> 上传中...
                            </>
                        ) : (
                            <>
                                <Upload size={16} /> 上传
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
