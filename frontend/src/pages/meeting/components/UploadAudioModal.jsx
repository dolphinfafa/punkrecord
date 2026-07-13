import React, { useState } from 'react';
import { meetingApi } from '@/api/meeting';
import { Plus, X, Loader2, AlertCircle, FileAudio, FileText, ClipboardEdit } from 'lucide-react';
import './UploadAudioModal.css';

const MEETING_TYPES = [
    { value: 'morning', label: '早会' },
    { value: 'weekly', label: '周会' },
    { value: 'project', label: '项目会议' },
    { value: 'review', label: '复盘会议' },
    { value: 'brainstorm', label: '头脑风暴' },
    { value: 'other', label: '其他' },
];

export default function UploadAudioModal({ onClose, onSuccess }) {
    const [title, setTitle] = useState('');
    const [meetingType, setMeetingType] = useState('morning');
    const [meetingDate, setMeetingDate] = useState(new Date().toISOString().split('T')[0]);
    const [inputMode, setInputMode] = useState('blank');
    const [audioFile, setAudioFile] = useState(null);
    const [transcriptFile, setTranscriptFile] = useState(null);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');

    const handleCreate = async () => {
        if (!title.trim()) {
            setError('请输入会议标题');
            return;
        }
        if (inputMode === 'audio' && !audioFile) {
            setError('请选择会议音频');
            return;
        }
        if (inputMode === 'transcript' && !transcriptFile) {
            setError('请选择 Word 或 PDF 文稿');
            return;
        }

        try {
            setCreating(true);
            setError('');
            const res = await meetingApi.createMeeting(
                title.trim(),
                meetingType,
                meetingDate,
                inputMode === 'audio' ? audioFile : null
            );
            let data = res.data;
            if (inputMode === 'transcript' && data?.id) {
                const transcriptRes = await meetingApi.uploadTranscript(data.id, transcriptFile);
                data = transcriptRes.data?.meeting || data;
            }
            onSuccess(data);
        } catch (err) {
            setError(err?.response?.data?.message || err.message || '创建失败，请重试');
        } finally {
            setCreating(false);
        }
    };

    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget && !creating) {
            onClose();
        }
    };

    return (
        <div className="modal-overlay" onClick={handleOverlayClick}>
            <div className="upload-modal">
                <div className="upload-modal-header">
                    <h2>创建会议记录</h2>
                    <button className="modal-close-btn" onClick={onClose} disabled={creating}>
                        <X size={20} />
                    </button>
                </div>

                <div className="upload-modal-body">
                    <div className="form-group">
                        <label className="form-label">会议标题 <span className="required">*</span></label>
                        <input
                            type="text"
                            className="form-input"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="输入会议标题"
                            disabled={creating}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">会议类型</label>
                        <select
                            className="form-input"
                            value={meetingType}
                            onChange={(e) => setMeetingType(e.target.value)}
                            disabled={creating}
                        >
                            {MEETING_TYPES.map(t => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label">会议日期</label>
                        <input
                            type="date"
                            className="form-input"
                            value={meetingDate}
                            onChange={(e) => setMeetingDate(e.target.value)}
                            disabled={creating}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">导入方式</label>
                        <div className="meeting-input-mode-tabs">
                            <button
                                type="button"
                                className={inputMode === 'blank' ? 'active' : ''}
                                onClick={() => setInputMode('blank')}
                                disabled={creating}
                            >
                                <Plus size={15} /> 空白
                            </button>
                            <button
                                type="button"
                                className={inputMode === 'audio' ? 'active' : ''}
                                onClick={() => setInputMode('audio')}
                                disabled={creating}
                            >
                                <FileAudio size={15} /> 音频
                            </button>
                            <button
                                type="button"
                                className={inputMode === 'transcript' ? 'active' : ''}
                                onClick={() => setInputMode('transcript')}
                                disabled={creating}
                            >
                                <ClipboardEdit size={15} /> 文稿
                            </button>
                        </div>
                    </div>

                    {inputMode === 'audio' && (
                        <div className="form-group">
                            <label className="file-pick-zone">
                                <FileAudio size={18} />
                                <span>{audioFile ? audioFile.name : '选择会议音频'}</span>
                                <input
                                    type="file"
                                    accept="audio/*"
                                    hidden
                                    disabled={creating}
                                    onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                                />
                            </label>
                        </div>
                    )}

                    {inputMode === 'transcript' && (
                        <div className="form-group">
                            <label className="file-pick-zone">
                                <FileText size={18} />
                                <span>{transcriptFile ? transcriptFile.name : '选择 Word 或 PDF 文稿'}</span>
                                <input
                                    type="file"
                                    accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf"
                                    hidden
                                    disabled={creating}
                                    onChange={(e) => setTranscriptFile(e.target.files?.[0] || null)}
                                />
                            </label>
                            <span className="form-helper">文稿中按“讲话人1：内容”“张三：内容”等格式分段。</span>
                        </div>
                    )}

                    {error && (
                        <div className="upload-error">
                            <AlertCircle size={16} />
                            <span>{error}</span>
                        </div>
                    )}
                </div>

                <div className="upload-modal-footer">
                    <button className="btn btn-secondary" onClick={onClose} disabled={creating}>
                        取消
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={handleCreate}
                        disabled={creating || !title.trim()}
                    >
                        {creating ? (
                            <><Loader2 size={16} className="spin" /> 创建中...</>
                        ) : (
                            <><Plus size={16} /> 创建会议</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
