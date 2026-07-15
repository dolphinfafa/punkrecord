import React, { useEffect, useRef, useState } from 'react';
import { Clipboard, Plus, Upload, X } from 'lucide-react';
import { getImageFilesFromClipboard, getImageFilesFromList, mergeImageFiles } from '@/utils/clipboardImages';
import './ImagePasteUpload.css';

export default function ImagePasteUpload({
    files = [],
    onChange,
    onFiles,
    multiple = true,
    disabled = false,
    label = '点击选择或粘贴图片',
    hint = '支持拖拽、截图后 Ctrl+V 粘贴',
    compact = false,
    maxSizeMB = 10,
    className = '',
}) {
    const inputRef = useRef(null);
    const rootRef = useRef(null);
    const panelRef = useRef(null);
    const [dragging, setDragging] = useState(false);
    const [error, setError] = useState('');
    const [previews, setPreviews] = useState([]);
    const [panelOpen, setPanelOpen] = useState(false);

    useEffect(() => {
        const next = (files || []).map((file) => ({
            file,
            url: URL.createObjectURL(file),
        }));
        setPreviews(next);
        return () => {
            next.forEach((item) => URL.revokeObjectURL(item.url));
        };
    }, [files]);

    useEffect(() => {
        if (!panelOpen) return;
        panelRef.current?.focus();

        const handleMouseDown = (event) => {
            if (rootRef.current && !rootRef.current.contains(event.target)) {
                setPanelOpen(false);
                setDragging(false);
            }
        };
        document.addEventListener('mousedown', handleMouseDown);
        return () => document.removeEventListener('mousedown', handleMouseDown);
    }, [panelOpen]);

    const addFiles = async (incoming) => {
        if (disabled) return;
        const imageFiles = getImageFilesFromList(incoming);
        const accepted = [];
        for (const file of imageFiles) {
            if (maxSizeMB && file.size > maxSizeMB * 1024 * 1024) {
                setError(`图片不能超过 ${maxSizeMB}MB`);
                continue;
            }
            accepted.push(file);
        }
        if (accepted.length === 0) return;
        setError('');
        onChange?.(mergeImageFiles(files, accepted, multiple));
        await onFiles?.(multiple ? accepted : accepted.slice(-1));
        setPanelOpen(false);
    };

    const handlePaste = async (event) => {
        const pasted = getImageFilesFromClipboard(event.clipboardData);
        if (!pasted.length) return;
        event.preventDefault();
        await addFiles(pasted);
    };

    const removeFile = (index) => {
        onChange?.((files || []).filter((_, idx) => idx !== index));
    };

    const openLocalPicker = () => {
        if (disabled) return;
        inputRef.current?.click();
    };

    return (
        <div
            ref={rootRef}
            className={`image-paste-upload ${compact ? 'compact' : ''} ${className}`}
            onPaste={handlePaste}
        >
            <div className={`image-paste-strip ${previews.length === 0 ? 'empty' : ''}`}>
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    multiple={multiple}
                    disabled={disabled}
                    onChange={async (event) => {
                        await addFiles(event.target.files);
                        event.target.value = '';
                    }}
                />
                {previews.map(({ file, url }, index) => (
                    <div key={`${file.name}-${file.lastModified || index}-${index}`} className="image-paste-preview">
                        <img src={url} alt={file.name || `图片 ${index + 1}`} />
                        <div className="image-paste-preview-meta">
                            <span title={file.name}>{file.name || `图片 ${index + 1}`}</span>
                            {onChange && (
                                <button type="button" onClick={() => removeFile(index)} disabled={disabled} title="移除">
                                    <X size={13} />
                                </button>
                            )}
                        </div>
                    </div>
                ))}
                <button
                    type="button"
                    className={`image-paste-add-button ${panelOpen ? 'active' : ''}`}
                    disabled={disabled}
                    onClick={() => setPanelOpen((open) => !open)}
                    title={label}
                >
                    <Plus size={compact ? 18 : 20} />
                    {previews.length === 0 && <span>{label}</span>}
                </button>
            </div>
            {panelOpen && (
                <div className="image-paste-panel">
                    <div
                        ref={panelRef}
                        role="button"
                        tabIndex={disabled ? -1 : 0}
                        className={`image-paste-dropzone ${dragging ? 'dragging' : ''} ${disabled ? 'disabled' : ''}`}
                        onKeyDown={(event) => {
                            if (disabled) return;
                            if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                openLocalPicker();
                            }
                        }}
                        onDragOver={(event) => {
                            event.preventDefault();
                            if (!disabled) setDragging(true);
                        }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={async (event) => {
                            event.preventDefault();
                            setDragging(false);
                            await addFiles(event.dataTransfer.files);
                        }}
                    >
                        <Clipboard size={17} />
                        <span>粘贴或拖拽至这里上传</span>
                        {!compact && <small>{hint}</small>}
                    </div>
                    <button
                        type="button"
                        className="image-paste-local-button"
                        onClick={openLocalPicker}
                        disabled={disabled}
                    >
                        <Upload size={16} />
                        添加本地文件
                    </button>
                </div>
            )}
            {error && <div className="image-paste-error">{error}</div>}
        </div>
    );
}
