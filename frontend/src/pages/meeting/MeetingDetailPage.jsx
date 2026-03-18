import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { meetingApi } from '@/api/meeting';
import { useAuth } from '@/contexts/AuthContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { format } from 'date-fns';
import {
    ArrowLeft, Loader2, Save, Users, Brain, Archive,
    Play, Square, Check, AlertCircle, ExternalLink
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

const MEETING_TYPE_MAP = {
    morning: '早会',
    weekly: '周会',
    project: '项目会议',
    review: '复盘会议',
    brainstorm: '头脑风暴',
    other: '其他',
};

// 10 distinct speaker colors
const SPEAKER_COLORS = [
    { bg: '#dbeafe', color: '#1e40af', border: '#3b82f6', dot: '#3b82f6' },
    { bg: '#fce7f3', color: '#9d174d', border: '#ec4899', dot: '#ec4899' },
    { bg: '#d1fae5', color: '#065f46', border: '#10b981', dot: '#10b981' },
    { bg: '#fef3c7', color: '#92400e', border: '#f59e0b', dot: '#f59e0b' },
    { bg: '#ede9fe', color: '#5b21b6', border: '#8b5cf6', dot: '#8b5cf6' },
    { bg: '#ffedd5', color: '#9a3412', border: '#f97316', dot: '#f97316' },
    { bg: '#cffafe', color: '#155e75', border: '#06b6d4', dot: '#06b6d4' },
    { bg: '#fecdd3', color: '#9f1239', border: '#f43f5e', dot: '#f43f5e' },
    { bg: '#e0e7ff', color: '#3730a3', border: '#6366f1', dot: '#6366f1' },
    { bg: '#d9f99d', color: '#3f6212', border: '#84cc16', dot: '#84cc16' },
];

function getSpeakerColor(speakerId, speakerIds) {
    const idx = speakerIds.indexOf(speakerId);
    return SPEAKER_COLORS[idx >= 0 ? idx % SPEAKER_COLORS.length : 0];
}

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
    const [playingSegmentIndex, setPlayingSegmentIndex] = useState(null);

    // Transcript
    const [transcript, setTranscript] = useState(null);
    const [segments, setSegments] = useState([]);
    const [editedSegments, setEditedSegments] = useState({});
    const [speakerMapping, setSpeakerMapping] = useState({});
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

    // Extract unique speaker IDs from segments (stable order)
    const speakerIds = useMemo(() => {
        const seen = new Set();
        const ids = [];
        for (const seg of segments) {
            const sid = seg.speaker_id || seg.speaker || '';
            if (sid && !seen.has(sid)) {
                seen.add(sid);
                ids.push(sid);
            }
        }
        return ids;
    }, [segments]);

    // Initialize speaker mapping for new speaker IDs
    useEffect(() => {
        if (speakerIds.length > 0) {
            setSpeakerMapping(prev => {
                const updated = { ...prev };
                for (const sid of speakerIds) {
                    if (!(sid in updated)) {
                        updated[sid] = '';
                    }
                }
                return updated;
            });
        }
    }, [speakerIds]);

    const loadMeeting = useCallback(async () => {
        try {
            const response = await meetingApi.getMeeting(id);
            const data = response.data;
            setMeeting(data);

            if (data.summary) {
                setSummary(data.summary);
            }
            if (data.speaker_mapping && Object.keys(data.speaker_mapping).length > 0) {
                setSpeakerMapping(prev => ({ ...prev, ...data.speaker_mapping }));
            }
            if (data.archived_document_id) {
                setArchiveResult({ doc_id: data.archived_document_id });
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
            setSegments(Array.isArray(data) ? data : (data?.segments || []));
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
                loadAudio();
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

    const segmentEndRef = useRef(null);

    const stopSegmentPlayback = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            if (audioRef.current._segListener) {
                audioRef.current.removeEventListener('timeupdate', audioRef.current._segListener);
                audioRef.current._segListener = null;
            }
        }
        segmentEndRef.current = null;
        setPlayingSegmentIndex(null);
    };

    const handleSeek = (startTime, endTime, segIndex) => {
        if (!audioRef.current) return;

        // If clicking the same segment that's playing, stop it
        if (playingSegmentIndex === segIndex) {
            stopSegmentPlayback();
            return;
        }

        // Stop any current segment playback
        stopSegmentPlayback();

        audioRef.current.currentTime = startTime;
        audioRef.current.play();
        setPlayingSegmentIndex(segIndex);

        if (endTime && endTime > startTime) {
            segmentEndRef.current = endTime;
            const onTimeUpdate = () => {
                if (audioRef.current && audioRef.current.currentTime >= segmentEndRef.current) {
                    audioRef.current.pause();
                    audioRef.current.removeEventListener('timeupdate', onTimeUpdate);
                    audioRef.current._segListener = null;
                    segmentEndRef.current = null;
                    setPlayingSegmentIndex(null);
                }
            };
            if (audioRef.current._segListener) {
                audioRef.current.removeEventListener('timeupdate', audioRef.current._segListener);
            }
            audioRef.current._segListener = onTimeUpdate;
            audioRef.current.addEventListener('timeupdate', onTimeUpdate);
        }
    };

    const handleSegmentEdit = (index, newText) => {
        setEditedSegments(prev => ({ ...prev, [index]: newText }));
    };

    const handleSaveTranscript = async () => {
        try {
            setSavingTranscript(true);
            const updatePayload = [];
            const updatedSegments = segments.map((seg, idx) => {
                if (editedSegments[idx] !== undefined) {
                    updatePayload.push({ id: seg.id, content: editedSegments[idx] });
                    return { ...seg, content: editedSegments[idx] };
                }
                return seg;
            });
            await meetingApi.updateTranscript(id, { segments: updatePayload });
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
            setSavingSpeakers(false);
        } catch (err) {
            alert(err.message || '保存失败');
            setSavingSpeakers(false);
        }
    };

    const handleSpeakerKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSaveSpeakers();
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
                            if (parsed.text) {
                                accumulated += parsed.text;
                                setSummary(accumulated);
                            }
                        } catch {
                            accumulated += data;
                            setSummary(accumulated);
                        }
                    }
                }
            }

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
                    <span className="meeting-type-tag">{MEETING_TYPE_MAP[meeting.meeting_type] || '早会'}</span>
                    {meeting.created_at && (
                        <span>创建时间: {format(new Date(meeting.created_at), 'yyyy-MM-dd HH:mm')}</span>
                    )}
                    {meeting.creator_name && <span>创建人: {meeting.creator_name}</span>}
                    {meeting.duration_seconds && <span>时长: {formatTime(meeting.duration_seconds)}</span>}
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

                    {/* Speaker Mapping - always visible when there are speakers */}
                    {speakerIds.length > 0 && (
                        <div className="speaker-mapping-panel">
                            <div className="speaker-mapping-header">
                                <Users size={16} />
                                <span>说话人识别</span>
                                {savingSpeakers && <Loader2 size={14} className="spin" />}
                                {!savingSpeakers && <span className="speaker-hint">输入姓名后回车确认</span>}
                            </div>
                            <div className="speaker-mapping-grid">
                                {speakerIds.map((sid) => {
                                    const sc = getSpeakerColor(sid, speakerIds);
                                    return (
                                        <div key={sid} className="speaker-mapping-item">
                                            <span className="speaker-color-dot" style={{ background: sc.dot }} />
                                            <label className="speaker-id-label" style={{ background: sc.bg, color: sc.color }}>
                                                {sid}
                                            </label>
                                            <input
                                                type="text"
                                                value={speakerMapping[sid] || ''}
                                                onChange={(e) =>
                                                    setSpeakerMapping(prev => ({
                                                        ...prev,
                                                        [sid]: e.target.value
                                                    }))
                                                }
                                                onKeyDown={handleSpeakerKeyDown}
                                                className="speaker-name-input"
                                                placeholder="输入姓名，回车保存"
                                                style={{ borderColor: sc.border + '60' }}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Segments List */}
                    <div className="segments-list">
                        {segments.length === 0 ? (
                            <div className="no-segments">暂无转录内容</div>
                        ) : (
                            segments.map((segment, index) => {
                                const sid = segment.speaker_id || segment.speaker || '';
                                const sc = getSpeakerColor(sid, speakerIds);
                                return (
                                    <div
                                        key={index}
                                        className="segment-item"
                                        style={{ borderLeft: `3px solid ${sc.border}` }}
                                    >
                                        <div className="segment-meta">
                                            <span
                                                className="segment-speaker"
                                                style={{ background: sc.bg, color: sc.color }}
                                            >
                                                {getSpeakerName(sid)}
                                            </span>
                                            <button
                                                className={`segment-time ${playingSegmentIndex === index ? 'segment-time-playing' : ''}`}
                                                onClick={() => handleSeek(
                                                    segment.start_time || segment.start,
                                                    segment.end_time || segment.end,
                                                    index
                                                )}
                                                title={playingSegmentIndex === index ? '点击停止' : '点击播放此片段'}
                                            >
                                                {playingSegmentIndex === index
                                                    ? <Square size={10} fill="currentColor" />
                                                    : <Play size={12} />
                                                }
                                                {formatTime(segment.start_time || segment.start)}
                                                {' - '}
                                                {formatTime(segment.end_time || segment.end)}
                                            </button>
                                        </div>
                                        <textarea
                                            className="segment-text"
                                            value={editedSegments[index] !== undefined ? editedSegments[index] : (segment.content || '')}
                                            onChange={(e) => handleSegmentEdit(index, e.target.value)}
                                            rows={Math.max(1, Math.ceil((segment.content || '').length / 80))}
                                        />
                                    </div>
                                );
                            })
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
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary}</ReactMarkdown>
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
