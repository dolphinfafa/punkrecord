import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { meetingApi } from '@/api/meeting';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { format } from 'date-fns';
import {
    ArrowLeft, Loader2, Save, Users, Brain, Archive,
    Play, Square, Check, AlertCircle, ExternalLink, X, Upload, RefreshCw, FileText,
    Plus, Trash2, UserPlus, CornerDownRight, CornerUpRight
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

const DEFAULT_SPEAKER_ID = 'speaker_1';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getApiErrorMessage(err, fallback = '操作失败') {
    const detail = err?.response?.data?.detail;
    if (Array.isArray(detail) && detail.length > 0) {
        return detail.map((item) => item.msg || JSON.stringify(item)).join('；');
    }
    return err?.response?.data?.message || err?.message || fallback;
}

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
    const audioRef = useRef(null);

    const [meeting, setMeeting] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Audio
    const [audioUrl, setAudioUrl] = useState(null);
    const [audioLoading, setAudioLoading] = useState(false);
    const [playingSegmentIndex, setPlayingSegmentIndex] = useState(null);

    // Transcript
    const [segments, setSegments] = useState([]);
    const [speakerMapping, setSpeakerMapping] = useState({});
    const [transcriptChanged, setTranscriptChanged] = useState(false);
    const [speakerMappingDirty, setSpeakerMappingDirty] = useState(false);
    const [savingTranscript, setSavingTranscript] = useState(false);
    const [savingSpeakers, setSavingSpeakers] = useState(false);

    // Speaker edit
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
    const [uploadingTranscript, setUploadingTranscript] = useState(false);
    const [retranscribing, setRetranscribing] = useState(false);

    // Polling
    const pollingRef = useRef(null);

    // Extract unique speaker IDs from segments and mappings (stable order)
    const speakerIds = useMemo(() => {
        const seen = new Set();
        const ids = [];
        for (const seg of segments) {
            const sid = seg.speaker_id || seg.speaker || DEFAULT_SPEAKER_ID;
            if (sid && !seen.has(sid)) {
                seen.add(sid);
                ids.push(sid);
            }
        }
        for (const sid of Object.keys(speakerMapping || {})) {
            if (sid && !seen.has(sid)) {
                seen.add(sid);
                ids.push(sid);
            }
        }
        return ids.length ? ids : [DEFAULT_SPEAKER_ID];
    }, [segments, speakerMapping]);

    // Initialize speaker mapping for new speaker IDs
    useEffect(() => {
        if (speakerIds.length > 0) {
            setSpeakerMapping(prev => {
                const updated = { ...prev };
                let changed = false;
                for (const sid of speakerIds) {
                    if (!(sid in updated)) {
                        updated[sid] = '';
                        changed = true;
                    }
                }
                return changed ? updated : prev;
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

            if (data.summary) {
                setSummary(data.summary);
            }
            if (data.speaker_mapping && Object.keys(data.speaker_mapping).length > 0) {
                setSpeakerMapping(prev => ({ ...prev, ...data.speaker_mapping }));
                setSpeakerMappingDirty(false);
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
            setSegments(Array.isArray(data) ? data : (data?.segments || []));
            setTranscriptChanged(false);
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
                if (data.audio_file_name || Number(data.audio_file_size || 0) > 0) {
                    loadAudio();
                }
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

    const normalizeSegmentOrder = (items) => items.map((item, idx) => ({
        ...item,
        segment_index: idx,
    }));

    const createDraftSegment = (speakerId = DEFAULT_SPEAKER_ID, startTime = 0, endTime = startTime) => ({
        _client_id: `draft-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        meeting_id: id,
        segment_index: 0,
        speaker_id: speakerId,
        start_time: startTime,
        end_time: endTime,
        content: '',
    });

    const getNextSpeakerId = () => {
        const used = new Set(speakerIds);
        const maxNum = speakerIds.reduce((max, sid) => {
            const match = /^speaker_(\d+)$/.exec(sid);
            return match ? Math.max(max, Number(match[1])) : max;
        }, 0);
        let next = Math.max(maxNum + 1, speakerIds.length + 1);
        while (used.has(`speaker_${next}`)) next += 1;
        return `speaker_${next}`;
    };

    const handleSegmentEdit = (index, newText) => {
        setSegments(prev => prev.map((seg, idx) => (
            idx === index ? { ...seg, content: newText } : seg
        )));
        setTranscriptChanged(true);
    };

    const handleSegmentSpeakerChange = (index, speakerId) => {
        setSegments(prev => prev.map((seg, idx) => (
            idx === index ? { ...seg, speaker_id: speakerId } : seg
        )));
        setSpeakerDropdownIndex(null);
        setTranscriptChanged(true);
    };

    const handleAddSpeaker = () => {
        const nextSpeakerId = getNextSpeakerId();
        const nextLabel = `讲话人${nextSpeakerId.replace('speaker_', '')}`;
        setSpeakerMapping(prev => ({ ...prev, [nextSpeakerId]: nextLabel }));
        setSpeakerMappingDirty(true);
    };

    const handleInsertSegment = (index, position = 'after') => {
        stopSegmentPlayback();
        const anchor = segments[index];
        const insertAt = position === 'before' ? index : index + 1;
        const speakerId = anchor?.speaker_id || speakerIds[0] || DEFAULT_SPEAKER_ID;
        const baseTime = position === 'before'
            ? (anchor?.start_time ?? anchor?.start ?? 0)
            : (anchor?.end_time ?? anchor?.end ?? anchor?.start_time ?? anchor?.start ?? 0);
        const draft = createDraftSegment(speakerId, baseTime, baseTime);
        setSegments(prev => normalizeSegmentOrder([
            ...prev.slice(0, insertAt),
            draft,
            ...prev.slice(insertAt),
        ]));
        setSpeakerDropdownIndex(null);
        setTranscriptChanged(true);
    };

    const handleAppendSegment = () => {
        stopSegmentPlayback();
        const last = segments[segments.length - 1];
        const baseTime = last?.end_time ?? last?.end ?? last?.start_time ?? last?.start ?? 0;
        const speakerId = last?.speaker_id || speakerIds[0] || DEFAULT_SPEAKER_ID;
        setSegments(prev => normalizeSegmentOrder([
            ...prev,
            createDraftSegment(speakerId, baseTime, baseTime),
        ]));
        setTranscriptChanged(true);
    };

    const handleDeleteSegment = (index) => {
        stopSegmentPlayback();
        setSegments(prev => normalizeSegmentOrder(prev.filter((_, idx) => idx !== index)));
        setSpeakerDropdownIndex(null);
        setTranscriptChanged(true);
    };

    const handleSaveTranscript = async () => {
        try {
            setSavingTranscript(true);
            const payload = segments.map((seg, idx) => {
                const startTime = Number(seg.start_time ?? seg.start ?? 0) || 0;
                const endTime = Number(seg.end_time ?? seg.end ?? startTime) || startTime;
                return {
                    ...(seg.id && UUID_RE.test(String(seg.id)) ? { id: seg.id } : {}),
                    content: seg.content || '',
                    speaker_id: seg.speaker_id || DEFAULT_SPEAKER_ID,
                    start_time: startTime,
                    end_time: endTime,
                    segment_index: idx,
                };
            });
            const response = await meetingApi.updateTranscript(id, { replace: true, segments: payload });
            if (response.data?.meeting && !speakerMappingDirty) setMeeting(response.data.meeting);
            if (speakerMappingDirty) {
                const speakerResponse = await meetingApi.updateSpeakers(id, { speaker_mapping: speakerMapping });
                if (speakerResponse.data) setMeeting(speakerResponse.data);
                setSpeakerMappingDirty(false);
            }
            setSegments(response.data?.segments || normalizeSegmentOrder(segments));
            setTranscriptChanged(false);
            alert('转录文本已保存');
        } catch (err) {
            alert(getApiErrorMessage(err, '保存失败'));
        } finally {
            setSavingTranscript(false);
        }
    };

    const handleSaveSpeakers = async () => {
        try {
            setSavingSpeakers(true);
            const response = await meetingApi.updateSpeakers(id, { speaker_mapping: speakerMapping });
            if (response.data) setMeeting(response.data);
            setSpeakerMappingDirty(false);
            setSavingSpeakers(false);
        } catch (err) {
            alert(getApiErrorMessage(err, '保存失败'));
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
            let streamError = '';

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
                            if (parsed.error) {
                                streamError = parsed.error;
                            } else if (parsed.text) {
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

            if (streamError) {
                setSummary('');
                alert(streamError);
                return;
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

    const handleRetranscribe = async () => {
        if (!window.confirm('确定要重新转写该会议音频吗？新转写成功后会替换当前转录文本。')) return;
        try {
            setRetranscribing(true);
            const response = await meetingApi.retranscribe(id);
            setMeeting(response.data);
            setSegments([]);
            setTranscriptChanged(false);
            setSpeakerDropdownIndex(null);
            alert('已开始重新转写，请稍后查看结果');
        } catch (err) {
            alert(err.response?.data?.message || err.message || '重新转写失败');
        } finally {
            setRetranscribing(false);
        }
    };

    const handleUploadTranscript = async (file) => {
        if (!file) return;
        try {
            setUploadingTranscript(true);
            const response = await meetingApi.uploadTranscript(id, file);
            const nextMeeting = response.data?.meeting;
            if (nextMeeting) setMeeting(nextMeeting);
            await loadTranscript();
            await loadMeeting();
            setTranscriptChanged(false);
            setSpeakerMappingDirty(false);
            setSpeakerDropdownIndex(null);
            alert(`文稿已导入，共 ${response.data?.segments || 0} 段`);
        } catch (err) {
            alert(err.response?.data?.message || err.message || '上传文稿失败');
        } finally {
            setUploadingTranscript(false);
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

    const hasEdits = transcriptChanged || speakerMappingDirty;

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
    const hasAudio = !!meeting.audio_file_name || Number(meeting.audio_file_size || 0) > 0;

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

            {/* Section 1: Audio / Transcript Upload */}
            <div className="detail-section audio-section">
                <h2 className="section-title">{hasAudio ? '音频播放' : '导入材料'}</h2>
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
                        <div className="meeting-import-actions">
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
                                        loadAudio();
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
                            <input
                                type="file"
                                id="transcript-upload-input"
                                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf"
                                style={{ display: 'none' }}
                                onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    e.target.value = '';
                                    await handleUploadTranscript(file);
                                }}
                            />
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => document.getElementById('transcript-upload-input').click()}
                                disabled={uploadingTranscript || isProcessing}
                            >
                                {uploadingTranscript ? <><Loader2 size={16} className="spin" /> 导入中...</> : <><FileText size={16} /> 上传文稿</>}
                            </button>
                            <span className="meeting-import-hint">支持 Word/PDF 文稿，按说话人格式导入转录文本</span>
                        </div>
                    )}
                </div>
                {hasAudio && !isProcessing && (
                    <div className="audio-actions-row">
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={handleRetranscribe}
                            disabled={retranscribing}
                        >
                            {retranscribing ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />}
                            重新转写
                        </button>
                        <input
                            type="file"
                            id="transcript-replace-input"
                            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf"
                            style={{ display: 'none' }}
                            onChange={async (e) => {
                                const file = e.target.files?.[0];
                                e.target.value = '';
                                await handleUploadTranscript(file);
                            }}
                        />
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => document.getElementById('transcript-replace-input').click()}
                            disabled={uploadingTranscript}
                        >
                            {uploadingTranscript ? <Loader2 size={16} className="spin" /> : <FileText size={16} />}
                            上传文稿
                        </button>
                    </div>
                )}
            </div>

            {/* Section 2: Transcript Editor */}
            {hasTranscript && (
                <div className="detail-section transcript-section">
                    <div className="section-header">
                        <h2 className="section-title">转录文本</h2>
                        <div className="section-actions">
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={handleAppendSegment}
                                disabled={savingTranscript}
                            >
                                <Plus size={16} />
                                添加行
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

                    {/* Speaker Mapping - always visible when there are speakers */}
                    {speakerIds.length > 0 && (
                        <div className="speaker-mapping-panel">
                            <div className="speaker-mapping-header">
                                <Users size={16} />
                                <span>说话人识别</span>
                                {savingSpeakers && <Loader2 size={14} className="spin" />}
                                {!savingSpeakers && <span className="speaker-hint">输入姓名后失焦或回车保存</span>}
                                <button
                                    type="button"
                                    className="speaker-add-btn"
                                    onClick={handleAddSpeaker}
                                    disabled={savingSpeakers}
                                >
                                    <UserPlus size={14} />
                                    新增讲话人
                                </button>
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
                                                onChange={(e) => {
                                                    setSpeakerMapping(prev => ({
                                                        ...prev,
                                                        [sid]: e.target.value
                                                    }));
                                                    setSpeakerMappingDirty(true);
                                                }}
                                                onKeyDown={handleSpeakerKeyDown}
                                                onBlur={handleSaveSpeakers}
                                                className="speaker-name-input"
                                                placeholder="输入姓名，失焦或回车保存"
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
                                const segmentStart = segment.start_time ?? segment.start ?? 0;
                                const segmentEnd = segment.end_time ?? segment.end ?? segmentStart;
                                return (
                                    <div
                                        key={segment.id || segment._client_id || index}
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
                                                    {getSpeakerName(sid)}
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
                                                                        handleSegmentSpeakerChange(index, optSid);
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
                                            {hasAudio ? (
                                                <button
                                                    className={`segment-time ${playingSegmentIndex === index ? 'segment-time-playing' : ''}`}
                                                    onClick={() => handleSeek(segmentStart, segmentEnd, index)}
                                                    title={playingSegmentIndex === index ? '点击停止' : '点击播放此片段'}
                                                >
                                                    {playingSegmentIndex === index
                                                        ? <Square size={10} fill="currentColor" />
                                                        : <Play size={12} />
                                                    }
                                                    {formatTime(segmentStart)}
                                                    {' - '}
                                                    {formatTime(segmentEnd)}
                                                </button>
                                            ) : (
                                                <span className="segment-time segment-time-static">文稿</span>
                                            )}
                                            <div className="segment-row-actions">
                                                <button
                                                    type="button"
                                                    className="segment-icon-btn"
                                                    onClick={() => handleInsertSegment(index, 'before')}
                                                    title="上方插入"
                                                >
                                                    <CornerUpRight size={14} />
                                                </button>
                                                <button
                                                    type="button"
                                                    className="segment-icon-btn"
                                                    onClick={() => handleInsertSegment(index, 'after')}
                                                    title="下方插入"
                                                >
                                                    <CornerDownRight size={14} />
                                                </button>
                                                <button
                                                    type="button"
                                                    className="segment-icon-btn segment-icon-btn-danger"
                                                    onClick={() => handleDeleteSegment(index)}
                                                    title="删除此行"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                        <textarea
                                            className="segment-text"
                                            value={segment.content || ''}
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
                                        // Append the preset text to whatever the user
                                        // already typed (both coexist), instead of
                                        // overwriting it. Switching presets first strips
                                        // the previously-appended preset to avoid stacking.
                                        const v = e.target.value;
                                        setSummaryPrompt((prev) => {
                                            let base = prev;
                                            if (selectedPresetPrompt && base.endsWith(selectedPresetPrompt)) {
                                                base = base
                                                    .slice(0, base.length - selectedPresetPrompt.length)
                                                    .replace(/\n+$/, '');
                                            }
                                            if (!v) return base;
                                            return base ? `${base}\n\n${v}` : v;
                                        });
                                        setSelectedPresetPrompt(v);
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
                                    onChange={(e) => setSummaryPrompt(e.target.value)}
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
