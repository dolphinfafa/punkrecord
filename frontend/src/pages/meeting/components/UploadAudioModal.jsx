import React, { useState } from 'react';
import { meetingApi } from '@/api/meeting';
import { Plus, X, Loader2, AlertCircle } from 'lucide-react';
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
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');

    const handleCreate = async () => {
        if (!title.trim()) {
            setError('请输入会议标题');
            return;
        }

        try {
            setCreating(true);
            setError('');
            const res = await meetingApi.createMeeting(title.trim(), meetingType, meetingDate);
            onSuccess(res.data);
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
