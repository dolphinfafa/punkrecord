import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { meetingApi } from '@/api/meeting';
import { format } from 'date-fns';
import { Mic, Upload, Trash2, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import UploadAudioModal from './components/UploadAudioModal';
import './MeetingListPage.css';

const STATUS_MAP = {
    uploading: { label: '上传中', className: 'status-uploading' },
    transcribing: { label: '转录中', className: 'status-transcribing' },
    transcribed: { label: '已转录', className: 'status-transcribed' },
    summarizing: { label: '总结中', className: 'status-summarizing' },
    summarized: { label: '已总结', className: 'status-summarized' },
    archived: { label: '已归档', className: 'status-archived' },
    failed: { label: '失败', className: 'status-failed' },
};

function formatDuration(seconds) {
    if (!seconds && seconds !== 0) return '-';
    const s = Math.floor(seconds);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    if (hrs > 0) {
        return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function MeetingListPage() {
    const navigate = useNavigate();
    const [meetings, setMeetings] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [page, setPage] = useState(1);
    const pageSize = 20;

    const loadMeetings = useCallback(async () => {
        try {
            setLoading(true);
            const skip = (page - 1) * pageSize;
            const response = await meetingApi.getMeetings({ skip, limit: pageSize });
            setMeetings(response.data?.items || []);
            setTotal(response.data?.total || 0);
            setError(null);
        } catch (err) {
            setError(err.message || '加载会议记录失败');
            console.error('Error loading meetings:', err);
        } finally {
            setLoading(false);
        }
    }, [page]);

    useEffect(() => {
        loadMeetings();
    }, [loadMeetings]);

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        if (!window.confirm('确定要删除该会议记录吗？此操作不可恢复。')) return;
        try {
            await meetingApi.deleteMeeting(id);
            loadMeetings();
        } catch (err) {
            alert(err.message || '删除失败');
        }
    };

    const handleRowClick = (id) => {
        navigate(`/meeting/${id}`);
    };

    const totalPages = Math.ceil(total / pageSize);

    const getStatusInfo = (status) => {
        return STATUS_MAP[status] || { label: status, className: 'status-unknown' };
    };

    if (loading && meetings.length === 0) {
        return (
            <div className="meeting-list-container">
                <div className="loading-center"><Loader2 className="spin" size={24} /> 加载中...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="meeting-list-container">
                <div className="error-message">错误: {error}</div>
            </div>
        );
    }

    return (
        <div className="meeting-list-container">
            <div className="meeting-header">
                <div>
                    <h1>会议记录</h1>
                    <p className="meeting-subtitle">管理会议音频、转录文本与 AI 会议纪要</p>
                </div>
                <button className="btn btn-primary upload-btn" onClick={() => setShowUploadModal(true)}>
                    <Upload size={18} /> 上传音频
                </button>
            </div>

            {meetings.length === 0 ? (
                <div className="empty-state">
                    <Mic size={48} color="#cbd5e0" />
                    <h3>暂无会议记录</h3>
                    <p>点击右上角的"上传音频"按钮来创建第一条会议记录。</p>
                </div>
            ) : (
                <>
                    <div className="meeting-table-wrapper">
                        <table className="meeting-table">
                            <thead>
                                <tr>
                                    <th>会议标题</th>
                                    <th>状态</th>
                                    <th>时长</th>
                                    <th>创建人</th>
                                    <th>创建时间</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {meetings.map((meeting) => {
                                    const statusInfo = getStatusInfo(meeting.status);
                                    return (
                                        <tr key={meeting.id} onClick={() => handleRowClick(meeting.id)} className="meeting-row">
                                            <td className="col-title">
                                                <div className="meeting-title-cell">
                                                    <Mic size={16} className="title-icon" />
                                                    <span>{meeting.title}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`meeting-status-badge ${statusInfo.className}`}>
                                                    {statusInfo.label}
                                                </span>
                                            </td>
                                            <td className="col-duration">{formatDuration(meeting.duration)}</td>
                                            <td className="col-creator">{meeting.creator_name || meeting.creator_id || '-'}</td>
                                            <td className="col-time">
                                                {meeting.created_at
                                                    ? format(new Date(meeting.created_at), 'yyyy-MM-dd HH:mm')
                                                    : '-'}
                                            </td>
                                            <td className="col-actions">
                                                <button
                                                    className="btn-delete-icon"
                                                    onClick={(e) => handleDelete(e, meeting.id)}
                                                    title="删除"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {totalPages > 1 && (
                        <div className="meeting-pagination">
                            <span className="pagination-info">
                                共 {total} 条记录，第 {page}/{totalPages} 页
                            </span>
                            <div className="pagination-buttons">
                                <button
                                    className="btn btn-secondary btn-sm"
                                    disabled={page <= 1}
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                >
                                    <ChevronLeft size={16} /> 上一页
                                </button>
                                <button
                                    className="btn btn-secondary btn-sm"
                                    disabled={page >= totalPages}
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                >
                                    下一页 <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {showUploadModal && (
                <UploadAudioModal
                    onClose={() => setShowUploadModal(false)}
                    onSuccess={() => {
                        setShowUploadModal(false);
                        loadMeetings();
                    }}
                />
            )}
        </div>
    );
}
