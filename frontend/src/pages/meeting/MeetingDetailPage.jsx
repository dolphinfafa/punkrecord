import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { meetingApi } from '@/api/meeting';
import { useAuth } from '@/contexts/AuthContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { format } from 'date-fns';
import {
    ArrowLeft, Loader2, Save, Users, Brain, Archive,
    Play, Square, Check, AlertCircle, ExternalLink, X, Upload
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

const PRESET_PROMPTS = [
    { value: '', label: '默认纪要' },
    { value: '这是一次早会/站会，请重点关注：每人昨日完成事项、今日计划、遇到的阻塞问题。', label: '早会/站会' },
    { value: '这是一次周会，请重点总结：本周各人工作进展、下周计划、需要协调的事项。', label: '周会' },
    { value: '这是一次复盘会议，请按照"做得好的、做得不好的、改进措施"三个方面来总结。', label: '复盘会议' },
    { value: '这是一次头脑风暴，请重点记录：提出的创意点子、讨论的可行性、最终筛选的方案。', label: '头脑风暴' },
    { value: '请用简洁的要点列表格式生成纪要，不需要长段落描述。', label: '简洁要点' },
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

    // Speaker edit
    const [editedSpeakers, setEditedSpeakers] = useState({});
    const [speakerDropdownIndex, setSpeakerDropdownIndex] = useState(null);

    // Previous meeting search
    const [prevMeetingSearch, setPrevMeetingSearch] = useState('');
    const [showPrevMeetingDropdown, setShowPrevMeetingDropdown] = useState(false);

    // Summary
    const [summary, setSummary] = useState('');
    const [summaryStreaming, setSummaryStreaming] = useState(false);
    const [summaryPrompt, setSummaryPrompt] = useState('');
    const [selectedPresetPrompt, setSelectedPresetPrompt] = useState('');
    const [previousMeetingId, setPreviousMeetingId] = useState('');
    const [summarizedMeetings, setSummarizedMeetings] = useState([]);

    // Archive
    const [archiving, setArchiving] = useState(false);
    const [archiveResult, setArchiveResult] = useState(null);

    // Audio upload (for meetings without audio)
    const [uploadingAudio, setUploadingAudio] = useState(false);

    // Attendees (for meetings without audio)
    const [attendeesInput, setAttendeesInput] = useState('');

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

    // Close speaker dropdown on click outside
    useEffect(() => {
        const handleClickOutside = () => setSpeakerDropdownIndex(null);
        if (speakerDropdownIndex !== null) {
            document.addEventListener('click', handleClickOutside);
            return () => document.removeEventListener('click', handleClickOutside);
        }
    }, [speakerDropdownIndex]);

    const loadMeeting = useCallback(async () => {
        try {
            const response = await meetingApi.getMeeting(id);
            const data = response.data;
            setMeeting(data);

            if (data.attendees && data.attendees.length > 0) {
                setAttendeesInput(data.attendees.join('，'));
            }
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
            const response = await fetch(`/api/v1/meeting/records/${id}/audio`, {
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

    const loadSummarizedMeetings = useCallback(async () => {
        try {
            const response = await meetingApi.getMeetings({ limit: 50, status: 'summarized' });
            const items = response.data?.items || [];
            // Also fetch archived meetings
            const response2 = await meetingApi.getMeetings({ limit: 50, status: 'archived' });
            const items2 = response2.data?.items || [];
            const all = [...items, ...items2].filter(m => m.id !== id);
            all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            setSummarizedMeetings(all);
        } catch (err) {
            console.error('Error loading summarized meetings:', err);
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
                loadSummarizedMeetings();
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
                const hasContentEdit = editedSegments[idx] !== undefined;
                const hasSpeakerEdit = editedSpeakers[idx] !== undefined;
                if (hasContentEdit || hasSpeakerEdit) {
                    const entry = {
                        id: seg.id,
                        content: hasContentEdit ? editedSegments[idx] : seg.content,
                    };
                    if (hasSpeakerEdit) entry.speaker_id = editedSpeakers[idx];
                    updatePayload.push(entry);
                    return {
                        ...seg,
                        content: hasContentEdit ? editedSegments[idx] : seg.content,
                        speaker_id: hasSpeakerEdit ? editedSpeakers[idx] : seg.speaker_id,
                    };
                }
                return seg;
            });
            await meetingApi.updateTranscript(id, { segments: updatePayload });
            setSegments(updatedSegments);
            setEditedSegments({});
            setEditedSpeakers({});
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
            const body = {};
            const promptText = summaryPrompt || selectedPresetPrompt;
            if (promptText) body.prompt = promptText;
            if (previousMeetingId) body.previous_meeting_id = previousMeetingId;
            const response = await fetch(`/api/v1/meeting/records/${id}/summarize`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'text/event-stream',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
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

    const getShortId = (uuid) => uuid ? uuid.substring(0, 8) : '';

    const filteredPrevMeetings = useMemo(() => {
        if (!prevMeetingSearch.trim()) return summarizedMeetings;
        const q = prevMeetingSearch.trim().toLowerCase();
        return summarizedMeetings.filter((m) => {
            const shortId = getShortId(m.id);
            const attendeesStr = (m.attendees || []).join(' ');
            const searchable = `${shortId} ${m.title} ${m.meeting_date || ''} ${attendeesStr}`.toLowerCase();
            return searchable.includes(q);
        });
    }, [summarizedMeetings, prevMeetingSearch]);

    const selectedPrevMeeting = useMemo(() => {
        if (!previousMeetingId) return null;
        return summarizedMeetings.find(m => m.id === previousMeetingId) || null;
    }, [previousMeetingId, summarizedMeetings]);

    // Close prev meeting dropdown on click outside
    const prevMeetingRef = useRef(null);
    useEffect(() => {
        if (!showPrevMeetingDropdown) return;
        const handleClick = (e) => {
            if (prevMeetingRef.current && !prevMeetingRef.current.contains(e.target)) {
                setShowPrevMeetingDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [showPrevMeetingDropdown]);

    const hasEdits = Object.keys(editedSegments).length > 0 || Object.keys(editedSpeakers).length > 0;

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
    const hasAudio = !!meeting.audio_stored_name;

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
                    {meeting.meeting_date && <span>会议日期: {meeting.meeting_date}</span>}
                    {meeting.created_at && (
                        <span>创建时间: {format(new Date(meeting.created_at), 'yyyy-MM-dd HH:mm')}</span>
                    )}
                    {meeting.creator_name && <span>创建人: {meeting.creator_name}</span>}
                    {meeting.duration_seconds && <span>时长: {formatTime(meeting.duration_seconds)}</span>}
                </div>
                {meeting.attendees && meeting.attendees.length > 0 && (
                    <div className="meeting-detail-attendees">
                        <Users size={14} />
                        <span>参会人员: {meeting.attendees.join('、')}</span>
                    </div>
                )}
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

            {/* Section 1: Audio Player / Upload */}
            <div className="detail-section audio-section">
                <h2 className="section-title">{hasAudio ? '音频播放' : '音频（可选）'}</h2>
                <div className="audio-player-wrapper">
                    {hasAudio ? (
                        audioLoading ? (
                            <div className="audio-loading">
                                <Loader2 size={20} className="spin" /> 加载音频中...
                            </div>
                        ) : audioUrl ? (
                            <audio ref={audioRef} controls src={audioUrl} className="audio-player" />
                        ) : (
                            <div className="audio-unavailable">音频加载失败</div>
                        )
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0' }}>
                            <input
                                type="file"
                                id="audio-upload-input"
                                accept="audio/*"
                                style={{ display: 'none' }}
                                onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    try {
                                        setUploadingAudio(true);
                                        await meetingApi.uploadAudio(id, file);
                                        const res = await meetingApi.getMeeting(id);
                                        setMeeting(res.data);
                                    } catch (err) {
                                        alert(err?.response?.data?.message || '上传失败');
                                    } finally {
                                        setUploadingAudio(false);
                                    }
                                }}
                            />
                            <button
                                className="btn btn-primary btn-sm"
                                onClick={() => document.getElementById('audio-upload-input').click()}
                                disabled={uploadingAudio || isProcessing}
                            >
                                {uploadingAudio ? <><Loader2 size={16} className="spin" /> 上传中...</> : <><Upload size={16} /> 上传音频</>}
                            </button>
                            <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>无音频也可直接使用自定义提示词生成会议纪要</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Section 1b: Attendees (for meetings without transcript from audio) */}
            {!hasAudio && !isProcessing && (
                <div className="detail-section" style={{ padding: '16px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <Users size={16} />
                        <h2 className="section-title" style={{ margin: 0 }}>参会人员</h2>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                            type="text"
                            value={attendeesInput}
                            onChange={(e) => setAttendeesInput(e.target.value)}
                            placeholder="输入参会人员姓名，用逗号分隔（如：张三,李四,王五）"
                            style={{ flex: 1, padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.9rem' }}
                        />
                        <button
                            className="btn btn-primary btn-sm"
                            onClick={async () => {
                                const names = attendeesInput.split(/[,，]/).map(s => s.trim()).filter(Boolean);
                                if (!names.length) return;
                                try {
                                    await meetingApi.updateAttendees(id, names);
                                    const res = await meetingApi.getMeeting(id);
                                    setMeeting(res.data);
                                } catch (err) {
                                    alert(err?.response?.data?.message || '保存失败');
                                }
                            }}
                        >
                            <Save size={14} /> 保存
                        </button>
                    </div>
                    {meeting.attendees && meeting.attendees.length > 0 && (
                        <div style={{ marginTop: '8px', color: '#64748b', fontSize: '0.85rem' }}>
                            已保存: {meeting.attendees.join('、')}
                        </div>
                    )}
                </div>
            )}

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
                                            <div className="segment-speaker-wrapper">
                                                <span
                                                    className="segment-speaker segment-speaker-clickable"
                                                    style={{ background: sc.bg, color: sc.color }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSpeakerDropdownIndex(speakerDropdownIndex === index ? null : index);
                                                    }}
                                                    title="点击切换说话人"
                                                >
                                                    {getSpeakerName(editedSpeakers[index] !== undefined ? editedSpeakers[index] : sid)}
                                                </span>
                                                {speakerDropdownIndex === index && (
                                                    <div className="speaker-dropdown">
                                                        {speakerIds.map((optSid) => {
                                                            const optSc = getSpeakerColor(optSid, speakerIds);
                                                            return (
                                                                <div
                                                                    key={optSid}
                                                                    className="speaker-dropdown-item"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setEditedSpeakers(prev => ({ ...prev, [index]: optSid }));
                                                                        setSpeakerDropdownIndex(null);
                                                                    }}
                                                                >
                                                                    <span className="speaker-color-dot" style={{ background: optSc.dot }} />
                                                                    <span>{getSpeakerName(optSid)}</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
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
            {(hasTranscript || hasSummary || !hasAudio) && !isProcessing && (
                <div className="detail-section summary-section">
                    <div className="section-header">
                        <h2 className="section-title">AI 会议纪要</h2>
                        <div className="section-actions">
                            {!isArchived && (hasTranscript || !hasAudio) && (
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

                    {/* Prompt & Previous Meeting options */}
                    {!isArchived && (hasTranscript || !hasAudio) && (
                        <div className="summary-options">
                            <div className="summary-option-row">
                                <label className="summary-option-label">提示词预设</label>
                                <select
                                    className="summary-option-select"
                                    value={selectedPresetPrompt}
                                    onChange={(e) => {
                                        setSelectedPresetPrompt(e.target.value);
                                        if (e.target.value) setSummaryPrompt('');
                                    }}
                                    disabled={summaryStreaming}
                                >
                                    {PRESET_PROMPTS.map((p) => (
                                        <option key={p.label} value={p.value}>{p.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="summary-option-row">
                                <label className="summary-option-label">自定义提示词</label>
                                <textarea
                                    className="summary-prompt-textarea"
                                    value={summaryPrompt}
                                    onChange={(e) => {
                                        setSummaryPrompt(e.target.value);
                                        if (e.target.value) setSelectedPresetPrompt('');
                                    }}
                                    placeholder={hasAudio ? "输入自定义提示词，覆盖预设..." : "输入会议记录内容，AI 将据此生成会议纪要..."}
                                    rows={hasAudio ? 2 : 6}
                                    disabled={summaryStreaming}
                                />
                            </div>
                            {summarizedMeetings.length > 0 && (
                                <div className="summary-option-row">
                                    <label className="summary-option-label">引用上次会议</label>
                                    <div className="prev-meeting-picker" ref={prevMeetingRef}>
                                        <div
                                            className="prev-meeting-display"
                                            onClick={() => !summaryStreaming && setShowPrevMeetingDropdown(!showPrevMeetingDropdown)}
                                        >
                                            {selectedPrevMeeting ? (
                                                <span className="prev-meeting-selected">
                                                    <span className="prev-meeting-short-id">{getShortId(selectedPrevMeeting.id)}</span>
                                                    {selectedPrevMeeting.title}
                                                    {selectedPrevMeeting.meeting_date && <span className="prev-meeting-date">{selectedPrevMeeting.meeting_date}</span>}
                                                </span>
                                            ) : (
                                                <span className="prev-meeting-placeholder">搜索 ID / 标题 / 日期 / 参会人...</span>
                                            )}
                                            {previousMeetingId && (
                                                <button
                                                    className="prev-meeting-clear"
                                                    onClick={(e) => { e.stopPropagation(); setPreviousMeetingId(''); setPrevMeetingSearch(''); }}
                                                    title="清除选择"
                                                >
                                                    <X size={14} />
                                                </button>
                                            )}
                                        </div>
                                        {showPrevMeetingDropdown && (
                                            <div className="prev-meeting-dropdown">
                                                <input
                                                    type="text"
                                                    className="prev-meeting-search-input"
                                                    placeholder="输入 ID、标题、日期或参会人搜索..."
                                                    value={prevMeetingSearch}
                                                    onChange={(e) => setPrevMeetingSearch(e.target.value)}
                                                    autoFocus
                                                />
                                                <div className="prev-meeting-list">
                                                    {filteredPrevMeetings.length === 0 ? (
                                                        <div className="prev-meeting-empty">无匹配会议</div>
                                                    ) : (
                                                        filteredPrevMeetings.map((m) => (
                                                            <div
                                                                key={m.id}
                                                                className={`prev-meeting-item ${m.id === previousMeetingId ? 'prev-meeting-item-active' : ''}`}
                                                                onClick={() => {
                                                                    setPreviousMeetingId(m.id);
                                                                    setShowPrevMeetingDropdown(false);
                                                                    setPrevMeetingSearch('');
                                                                }}
                                                            >
                                                                <div className="prev-meeting-item-main">
                                                                    <span className="prev-meeting-short-id">{getShortId(m.id)}</span>
                                                                    <span className="prev-meeting-item-title">{m.title}</span>
                                                                    {m.meeting_date && <span className="prev-meeting-date">{m.meeting_date}</span>}
                                                                </div>
                                                                {m.attendees && m.attendees.length > 0 && (
                                                                    <div className="prev-meeting-item-attendees">{m.attendees.join('、')}</div>
                                                                )}
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {isArchived && (
                        <div className="archive-badge">
                            <Check size={16} />
                            已归档到企业大脑
                            {archiveResult?.doc_id && (
                                <a
                                    href={`/kb/doc/${archiveResult.doc_id}`}
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
