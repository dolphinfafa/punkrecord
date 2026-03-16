import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { meetingApi } from '@/api/meeting';
import { useAuth } from '@/contexts/AuthContext';
import ReactMarkdown from 'react-markdown';
import { format } from 'date-fns';
import {
    ArrowLeft, Loader2, Save, Users, Brain, Archive,
    ChevronDown, ChevronUp, Play, Check, AlertCircle, ExternalLink
} from 'lucide-react';
import './MeetingDetailPage.css';

const STATUS_MAP = {
    uploading: { label: '上传中', className: 'status-uploading' },
    transcribing: { label: '转录中', className: 'status-transcribing' },
    transcribed: { label: '已转录', className: 'status-transcribed' },
    summarizing: { label: '总结中', className: 'status-summarizing' },
    summarized: { label: '已总结', className: 'status-summarized' },
    archived: { label: '已归档', className: 'status-archived' },
    failed: { label: '失败', className: 'status-failed' },
};

function formatTime(seconds) {
    if (!seconds && seconds !== 0) return '00:00';
    const s = Math.floor(seconds);
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function MeetingDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const audioRef = useRef(null);

    const [meeting, setMeeting] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Audio
    const [audioUrl, setAudioUrl] = useState(null);
    const [audioLoading, setAudioLoading] = useState(false);

    // Transcript
    const [transcript, setTranscript] = useState(null);
    const [segments, setSegments] = useState([]);
    const [editedSegments, setEditedSegments] = useState({});
    const [speakerMapping, setSpeakerMapping] = useState({});
    const [showSpeakerPanel, setShowSpeakerPanel] = useState(false);
    const [savingTranscript, setSavingTranscript] = useState(false);
    const [savingSpeakers, setSavingSpeakers] = useState(false);

    // Summary
    const [summary, setSummary] = useState('');
    const [summaryStreaming, setSummaryStreaming] = useState(false);

    // Archive
    const [archiving, setArchiving] = useState(false);
    const [archiveResult, setArchiveResult] = useState(null);

    // Polling
    const pollingRef = useRef(null);

    const loadMeeting = useCallback(async () => {
        try {
            const response = await meetingApi.getMeeting(id);
            const data = response.data;
            setMeeting(data);

            if (data.summary) {
                setSummary(data.summary);
            }
            if (data.archive_doc_id) {
                setArchiveResult({ doc_id: data.archive_doc_id });
            }

            return data;
        } catch (err) {
            setError(err.message || '加载会议详情失败');
            return null;
        }
    }, [id]);

    const loadTranscript = useCallback(async () => {
        try {
            const response = await meetingApi.getTranscript(id);
            const data = response.data;
            setTranscript(data);
            setSegments(data?.segments || []);
            setSpeakerMapping(data?.speaker_mapping || {});
        } catch (err) {
            console.error('Error loading transcript:', err);
        }
    }, [id]);

    const loadAudio = useCallback(async () => {
        try {
            setAudioLoading(true);
            const token = localStorage.getItem('token');
            const response = await fetch(`/punkrecord/api/v1/meeting/records/${id}/audio`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to load audio');
            const blob = await response.blob();
            setAudioUrl(URL.createObjectURL(blob));
        } catch (err) {
            console.error('Error loading audio:', err);
        } finally {
            setAudioLoading(false);
        }
    }, [id]);

    // Initial load
    useEffect(() => {
        const init = async () => {
            setLoading(true);
            const data = await loadMeeting();
            if (data) {
                // Load audio for all states
                loadAudio();

                // Load transcript if available
                if (['transcribed', 'summarized', 'summarizing', 'archived'].includes(data.status)) {
                    loadTranscript();
                }
            }
            setLoading(false);
        };
        init();

        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
            if (audioUrl) URL.revokeObjectURL(audioUrl);
        };
    }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

    // Poll status while processing
    useEffect(() => {
        if (!meeting) return;
        const isProcessing = ['uploading', 'transcribing', 'summarizing'].includes(meeting.status);

        if (isProcessing) {
            pollingRef.current = setInterval(async () => {
                try {
                    const response = await meetingApi.getStatus(id);
                    const newStatus = response.data?.status;
                    if (newStatus && newStatus !== meeting.status) {
                        const data = await loadMeeting();
                        if (data && ['transcribed', 'summarized', 'archived'].includes(data.status)) {
                            loadTranscript();
                        }
                    }
                } catch (err) {
                    console.error('Polling error:', err);
                }
            }, 3000);
        }

        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, [meeting?.status, id]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSeek = (startTime) => {
        if (audioRef.current) {
            audioRef.current.currentTime = startTime;
            audioRef.current.play();
        }
    };

    const handleSegmentEdit = (index, newText) => {
        setEditedSegments(prev => ({ ...prev, [index]: newText }));
    };

    const handleSaveTranscript = async () => {
        try {
            setSavingTranscript(true);
            const updatedSegments = segments.map((seg, idx) => {
                if (editedSegments[idx] !== undefined) {
                    return { ...seg, text: editedSegments[idx] };
                }
                return seg;
            });
            await meetingApi.updateTranscript(id, { segments: updatedSegments });
            setSegments(updatedSegments);
            setEditedSegments({});
            alert('转录文本已保存');
        } catch (err) {
            alert(err.message || '保存失败');
        } finally {
            setSavingTranscript(false);
        }
    };

    const handleSaveSpeakers = async () => {
        try {
            setSavingSpeakers(true);
            await meetingApi.updateSpeakers(id, { speaker_mapping: speakerMapping });
            alert('说话人映射已更新');
        } catch (err) {
            alert(err.message || '保存失败');
        } finally {
            setSavingSpeakers(false);
        }
    };

    const handleGenerateSummary = async () => {
        try {
            setSummaryStreaming(true);
            setSummary('');
            const token = localStorage.getItem('token');
            const response = await fetch(`/punkrecord/api/v1/meeting/records/${id}/summarize`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'text/event-stream',
                },
            });

            if (!response.ok) {
                throw new Error('生成会议纪要失败');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let accumulated = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') continue;
                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.content) {
                                accumulated += parsed.content;
                                setSummary(accumulated);
                            }
                        } catch {
                            // Could be plain text SSE
                            accumulated += data;
                            setSummary(accumulated);
                        }
                    }
                }
            }

            // Reload meeting to get updated status
            await loadMeeting();
        } catch (err) {
            alert(err.message || '生成会议纪要失败');
        } finally {
            setSummaryStreaming(false);
        }
    };

    const handleArchive = async () => {
        if (!window.confirm('确定要将此会议纪要归档到企业大脑吗？')) return;
        try {
            setArchiving(true);
            const response = await meetingApi.archiveToKB(id);
            setArchiveResult(response.data);
            await loadMeeting();
            alert('归档成功');
        } catch (err) {
            alert(err.message || '归档失败');
        } finally {
            setArchiving(false);
        }
    };

    const getSpeakerName = (speakerId) => {
        if (speakerMapping && speakerMapping[speakerId]) {
            return speakerMapping[speakerId];
        }
        return speakerId || '未知';
    };

    const hasEdits = Object.keys(editedSegments).length > 0;

    if (loading) {
        return (
            <div className="meeting-detail-container">
                <div className="loading-center"><Loader2 className="spin" size={24} /> 加载中...</div>
            </div>
        );
    }

    if (error || !meeting) {
        return (
            <div className="meeting-detail-container">
                <div className="error-message">{error || '未找到会议记录'}</div>
            </div>
        );
    }

    const statusInfo = STATUS_MAP[meeting.status] || { label: meeting.status, className: 'status-unknown' };
    const isProcessing = ['uploading', 'transcribing', 'summarizing'].includes(meeting.status);
    const hasTranscript = ['transcribed', 'summarized', 'archived'].includes(meeting.status);
    const hasSummary = ['summarized', 'archived'].includes(meeting.status) || summary;
    const isArchived = meeting.status === 'archived';

    return (
        <div className="meeting-detail-container">
            {/* Toolbar */}
            <div className="meeting-toolbar">
                <button className="btn btn-secondary" onClick={() => navigate('/meeting')}>
                    <ArrowLeft size={16} /> 返回列表
                </button>
            </div>

            {/* Header */}
            <div className="meeting-detail-header">
                <div className="meeting-detail-title-row">
                    <h1>{meeting.title}</h1>
                    <span className={`meeting-status-badge ${statusInfo.className}`}>
                        {isProcessing && <Loader2 size={14} className="spin" />}
                        {statusInfo.label}
                    </span>
                </div>
                <div className="meeting-detail-meta">
                    {meeting.created_at && (
                        <span>创建时间: {format(new Date(meeting.created_at), 'yyyy-MM-dd HH:mm')}</span>
                    )}
                    {meeting.creator_name && <span>创建人: {meeting.creator_name}</span>}
                    {meeting.duration && <span>时长: {formatTime(meeting.duration)}</span>}
                </div>
            </div>

            {/* Processing indicator */}
            {isProcessing && (
                <div className="processing-banner">
                    <Loader2 size={20} className="spin" />
                    <span>
                        {meeting.status === 'uploading' && '音频正在上传处理中...'}
                        {meeting.status === 'transcribing' && '正在转录音频，请稍候...'}
                        {meeting.status === 'summarizing' && '正在生成会议纪要...'}
                    </span>
                </div>
            )}

            {/* Section 1: Audio Player */}
            <div className="detail-section audio-section">
                <h2 className="section-title">音频播放</h2>
                <div className="audio-player-wrapper">
                    {audioLoading ? (
                        <div className="audio-loading">
                            <Loader2 size={20} className="spin" /> 加载音频中...
                        </div>
                    ) : audioUrl ? (
                        <audio ref={audioRef} controls src={audioUrl} className="audio-player" />
                    ) : (
                        <div className="audio-unavailable">音频不可用</div>
                    )}
                </div>
            </div>

            {/* Section 2: Transcript Editor */}
            {hasTranscript && (
                <div className="detail-section transcript-section">
                    <div className="section-header">
                        <h2 className="section-title">转录文本</h2>
                        <div className="section-actions">
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => setShowSpeakerPanel(!showSpeakerPanel)}
                            >
                                <Users size={16} />
                                说话人映射
                                {showSpeakerPanel ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                            {hasEdits && (
                                <button
                                    className="btn btn-primary btn-sm"
                                    onClick={handleSaveTranscript}
                                    disabled={savingTranscript}
                                >
                                    {savingTranscript ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
                                    保存修改
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Speaker Mapping Panel */}
                    {showSpeakerPanel && (
                        <div className="speaker-mapping-panel">
                            <h3>说话人名称映射</h3>
                            <div className="speaker-mapping-grid">
                                {Object.entries(speakerMapping).map(([speakerId, name]) => (
                                    <div key={speakerId} className="speaker-mapping-item">
                                        <label className="speaker-id-label">{speakerId}</label>
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) =>
                                                setSpeakerMapping(prev => ({
                                                    ...prev,
                                                    [speakerId]: e.target.value
                                                }))
                                            }
                                            className="speaker-name-input"
                                            placeholder="输入姓名"
                                        />
                                    </div>
                                ))}
                            </div>
                            <button
                                className="btn btn-primary btn-sm"
                                onClick={handleSaveSpeakers}
                                disabled={savingSpeakers}
                                style={{ marginTop: '0.75rem' }}
                            >
                                {savingSpeakers ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
                                更新说话人
                            </button>
                        </div>
                    )}

                    {/* Segments List */}
                    <div className="segments-list">
                        {segments.length === 0 ? (
                            <div className="no-segments">暂无转录内容</div>
                        ) : (
                            segments.map((segment, index) => (
                                <div
                                    key={index}
                                    className={`segment-item ${index % 2 === 0 ? 'segment-even' : 'segment-odd'}`}
                                >
                                    <div className="segment-meta">
                                        <span className="segment-speaker">
                                            {getSpeakerName(segment.speaker_id || segment.speaker)}
                                        </span>
                                        <button
                                            className="segment-time"
                                            onClick={() => handleSeek(segment.start_time || segment.start)}
                                            title="点击跳转到此时间"
                                        >
                                            <Play size={12} />
                                            {formatTime(segment.start_time || segment.start)}
                                            {' - '}
                                            {formatTime(segment.end_time || segment.end)}
                                        </button>
                                    </div>
                                    <textarea
                                        className="segment-text"
                                        value={editedSegments[index] !== undefined ? editedSegments[index] : segment.text}
                                        onChange={(e) => handleSegmentEdit(index, e.target.value)}
                                        rows={Math.max(1, Math.ceil((segment.text || '').length / 80))}
                                    />
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Section 3: AI Summary & Archive */}
            {(hasTranscript || hasSummary) && (
                <div className="detail-section summary-section">
                    <div className="section-header">
                        <h2 className="section-title">AI 会议纪要</h2>
                        <div className="section-actions">
                            {!isArchived && hasTranscript && (
                                <button
                                    className="btn btn-primary btn-sm"
                                    onClick={handleGenerateSummary}
                                    disabled={summaryStreaming}
                                >
                                    {summaryStreaming ? <Loader2 size={16} className="spin" /> : <Brain size={16} />}
                                    {summary ? '重新生成' : '生成会议纪要'}
                                </button>
                            )}
                            {hasSummary && !isArchived && (
                                <button
                                    className="btn btn-archive btn-sm"
                                    onClick={handleArchive}
                                    disabled={archiving}
                                >
                                    {archiving ? <Loader2 size={16} className="spin" /> : <Archive size={16} />}
                                    归档到企业大脑
                                </button>
                            )}
                        </div>
                    </div>

                    {isArchived && (
                        <div className="archive-badge">
                            <Check size={16} />
                            已归档到企业大脑
                            {archiveResult?.doc_id && (
                                <a
                                    href={`/punkrecord/kb/doc/${archiveResult.doc_id}`}
                                    className="archive-link"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <ExternalLink size={14} /> 查看文档
                                </a>
                            )}
                        </div>
                    )}

                    {summary ? (
                        <div className="summary-content">
                            <ReactMarkdown>{summary}</ReactMarkdown>
                        </div>
                    ) : (
                        !summaryStreaming && (
                            <div className="summary-empty">
                                <Brain size={32} color="#cbd5e0" />
                                <p>尚未生成会议纪要，点击上方按钮使用 AI 生成。</p>
                            </div>
                        )
                    )}

                    {summaryStreaming && !summary && (
                        <div className="summary-loading">
                            <Loader2 size={20} className="spin" />
                            <span>正在生成会议纪要...</span>
                        </div>
                    )}
                </div>
            )}

            {/* Failed state */}
            {meeting.status === 'failed' && (
                <div className="detail-section failed-section">
                    <AlertCircle size={24} />
                    <div>
                        <h3>处理失败</h3>
                        <p>{meeting.error_message || '音频处理过程中发生错误，请重试或联系管理员。'}</p>
                    </div>
                </div>
            )}
        </div>
    );
}
