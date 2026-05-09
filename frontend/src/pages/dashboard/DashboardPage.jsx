import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { todoApi } from '@/api/todo';
import iamApi from '@/api/iam';
import changelogApi from '@/api/changelog';
import agentTokenApi from '@/api/agentToken';
import { useAuth } from '@/contexts/AuthContext';
import {
    LayoutDashboard, CheckSquare, Clock, AlertCircle, Plus,
    TrendingUp, Activity, ArrowRight, CalendarClock, FileText, Edit3, Trash2, Save, X,
    Key, Copy, Check
} from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';
import ReactMarkdown from 'react-markdown';
import TodoModal from '@/components/todo/TodoModal';
import './DashboardPage.css';

export default function DashboardPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        open: 0,
        in_progress: 0,
        pending_review: 0,
        done: 0,
        total: 0
    });
    const [recentActivity, setRecentActivity] = useState([]);
    const [loading, setLoading] = useState(true);
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [leaves, setLeaves] = useState([]);
    const [teamPendingLeaves, setTeamPendingLeaves] = useState([]);
    const [leaveReviewingId, setLeaveReviewingId] = useState(null);
    const [leaveSubmitting, setLeaveSubmitting] = useState(false);
    const [myProfile, setMyProfile] = useState(null);
    const [leaveForm, setLeaveForm] = useState({
        leave_type: 'annual',
        start_date: '',
        start_half: 'am',
        end_date: '',
        end_half: 'pm',
        reason: ''
    });
    const [changelogs, setChangelogs] = useState([]);
    const [changelogEditing, setChangelogEditing] = useState(null); // id or 'new'
    const [changelogForm, setChangelogForm] = useState({ version: '', title: '', content: '' });
    const [changelogSaving, setChangelogSaving] = useState(false);
    const [selectedChangelogIdx, setSelectedChangelogIdx] = useState(0);

    // Agent Token
    const [agentTokens, setAgentTokens] = useState([]);
    const [showTokenCreate, setShowTokenCreate] = useState(false);
    const [tokenForm, setTokenForm] = useState({ name: '', expires_in_days: '' });
    const [newToken, setNewToken] = useState(null); // 刚创建的 token 明文
    const [tokenCopied, setTokenCopied] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                // Fetch user's todos
                const [todoRes, teamPendingReviewRes, leaveRes, profileRes, teamPendingRes, changelogRes] = await Promise.all([
                    todoApi.list({ page_size: 100 }),
                    todoApi.listTeam({ status: 'pending_review', reviewed_by_user_id: user?.id, page_size: 100 }),
                    todoApi.listMyLeaves({ page_size: 5 }),
                    user?.id ? iamApi.getUser(user.id) : Promise.resolve({ data: null }),
                    todoApi.listTeamPendingLeaves(),
                    changelogApi.list({ page_size: 10 }).catch(() => ({ data: { items: [] } }))
                ]);
                const todos = todoRes.data?.items || [];
                const teamPendingReviewCount = teamPendingReviewRes.data?.total || 0;
                setLeaves(leaveRes.data?.items || []);
                setMyProfile(profileRes?.data || null);
                setTeamPendingLeaves(teamPendingRes?.data || []);
                setChangelogs(changelogRes?.data?.items || []);

                // Calculate Stats (done = this week only)
                const now = new Date();
                const dayOfWeek = now.getDay() || 7; // Sunday=7
                const weekStart = new Date(now);
                weekStart.setDate(now.getDate() - dayOfWeek + 1);
                weekStart.setHours(0, 0, 0, 0);
                const doneThisWeek = todos.filter(t =>
                    t.status === 'done' && t.done_at && new Date(t.done_at) >= weekStart
                ).length;
                const newStats = {
                    open: todos.filter(t => t.status === 'open').length,
                    in_progress: todos.filter(t => t.status === 'in_progress').length,
                    pending_review: teamPendingReviewCount,
                    done: doneThisWeek,
                    total: todos.length
                };
                setStats(newStats);

                // Get Recent Activity (Sort by updated_at desc)
                const sorted = [...todos].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
                setRecentActivity(sorted.slice(0, 3));

                // Load Agent Tokens
                try {
                    const tokenRes = await agentTokenApi.list();
                    setAgentTokens(tokenRes.data || []);
                } catch { /* ignore */ }

            } catch (error) {
                console.error("Failed to fetch dashboard data", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [user?.id]);

    const handleCreateTodo = async (formData) => {
        try {
            await todoApi.create(formData);
            // Refresh data
            window.location.reload();
        } catch (error) {
            console.error("Failed to create task", error);
        }
    };

    const handleCreateLeave = async (e) => {
        e.preventDefault();
        if (myProfile?.level === 0) {
            alert('L0 级别员工无需请假');
            return;
        }
        if (!leaveForm.start_date || !leaveForm.end_date) {
            alert('请填写请假开始和结束日期');
            return;
        }
        const startTime = leaveForm.start_half === 'am' ? '10:00:00' : '14:00:00';
        const endTime = leaveForm.end_half === 'am' ? '12:00:00' : '19:00:00';
        const startAt = `${leaveForm.start_date}T${startTime}`;
        const endAt = `${leaveForm.end_date}T${endTime}`;
        if (endAt <= startAt) {
            alert('结束时间必须晚于开始时间');
            return;
        }
        try {
            setLeaveSubmitting(true);
            await todoApi.createLeave({
                leave_type: leaveForm.leave_type,
                start_at: startAt,
                end_at: endAt,
                reason: leaveForm.reason || null
            });
            const [leaveRes, profileRes, teamPendingRes] = await Promise.all([
                todoApi.listMyLeaves({ page_size: 5 }),
                user?.id ? iamApi.getUser(user.id) : Promise.resolve({ data: null }),
                todoApi.listTeamPendingLeaves()
            ]);
            setLeaves(leaveRes.data?.items || []);
            setMyProfile(profileRes?.data || null);
            setTeamPendingLeaves(teamPendingRes?.data || []);
            setLeaveForm({
                leave_type: 'annual',
                start_date: '',
                start_half: 'am',
                end_date: '',
                end_half: 'pm',
                reason: ''
            });
            alert('请假申请已提交');
        } catch (error) {
            alert(error.message || '提交请假失败');
        } finally {
            setLeaveSubmitting(false);
        }
    };

    const refreshLeavePanels = async () => {
        const [leaveRes, profileRes, teamPendingRes] = await Promise.all([
            todoApi.listMyLeaves({ page_size: 5 }),
            user?.id ? iamApi.getUser(user.id) : Promise.resolve({ data: null }),
            todoApi.listTeamPendingLeaves()
        ]);
        setLeaves(leaveRes.data?.items || []);
        setMyProfile(profileRes?.data || null);
        setTeamPendingLeaves(teamPendingRes?.data || []);
    };

    const handleApproveLeave = async (leaveId) => {
        try {
            setLeaveReviewingId(leaveId);
            await todoApi.approveLeave(leaveId);
            await refreshLeavePanels();
        } catch (error) {
            alert(error.message || '审批失败');
        } finally {
            setLeaveReviewingId(null);
        }
    };

    const handleRejectLeave = async (leaveId) => {
        const comment = window.prompt('请输入驳回原因', '请假时间冲突');
        if (comment === null) return;
        try {
            setLeaveReviewingId(leaveId);
            await todoApi.rejectLeave(leaveId, comment || '请假申请未通过');
            await refreshLeavePanels();
        } catch (error) {
            alert(error.message || '驳回失败');
        } finally {
            setLeaveReviewingId(null);
        }
    };

    const isL0 = myProfile?.level === 0;

    const handleSaveChangelog = async () => {
        if (!changelogForm.version || !changelogForm.title || !changelogForm.content) {
            alert('请填写版本号、标题和内容');
            return;
        }
        try {
            setChangelogSaving(true);
            if (changelogEditing === 'new') {
                await changelogApi.create(changelogForm);
            } else {
                await changelogApi.update(changelogEditing, changelogForm);
            }
            const res = await changelogApi.list({ page_size: 10 });
            setChangelogs(res?.data?.items || []);
            setChangelogEditing(null);
            setChangelogForm({ version: '', title: '', content: '' });
        } catch (err) {
            alert('保存失败: ' + (err.response?.data?.message || err.message));
        } finally {
            setChangelogSaving(false);
        }
    };

    const handleDeleteChangelog = async (id) => {
        if (!window.confirm('确认删除此版本日志？')) return;
        try {
            await changelogApi.delete(id);
            setChangelogs(prev => prev.filter(c => c.id !== id));
        } catch (err) {
            alert('删除失败: ' + (err.response?.data?.message || err.message));
        }
    };

    return (
        <div className="dashboard-container">
            <header className="page-header">
                <div>
                    <h1>工作台</h1>
                    <p className="welcome-text">欢迎回来, {user?.name || 'User'} 👋</p>
                </div>
                <button className="create-btn" onClick={() => setCreateModalOpen(true)}>
                    <Plus size={18} /> 快速新建任务
                </button>
            </header>

            <div className="stats-grid">
                <div className="stat-card blue" onClick={() => navigate('/todo?filter=in_progress')}>
                    <div className="stat-icon">
                        <TrendingUp size={24} />
                    </div>
                    <div className="stat-info">
                        <h3>进行中</h3>
                        <div className="stat-value">{stats.in_progress}</div>
                        <span className="stat-label">当前专注任务</span>
                    </div>
                </div>

                <div className="stat-card orange" onClick={() => navigate('/todo?filter=pending_review')}>
                    <div className="stat-icon">
                        <Clock size={24} />
                    </div>
                    <div className="stat-info">
                        <h3>待审批</h3>
                        <div className="stat-value">{stats.pending_review}</div>
                        <span className="stat-label">需要跟进</span>
                    </div>
                </div>

                <div className="stat-card purple" onClick={() => navigate('/todo?filter=open')}>
                    <div className="stat-icon">
                        <CheckSquare size={24} />
                    </div>
                    <div className="stat-info">
                        <h3>待开始</h3>
                        <div className="stat-value">{stats.open}</div>
                        <span className="stat-label">计划任务</span>
                    </div>
                </div>

                <div className="stat-card green" onClick={() => navigate('/todo?filter=done')}>
                    <div className="stat-icon">
                        <Activity size={24} />
                    </div>
                    <div className="stat-info">
                        <h3>已完成</h3>
                        <div className="stat-value">{stats.done}</div>
                        <span className="stat-label">本周完成</span>
                    </div>
                </div>
            </div>

            <div className="dashboard-content">
                <div>
                    <div className="section-card recent-activity">
                        <div className="section-header">
                            <h3>最近活动</h3>
                            <button className="view-all-btn" onClick={() => navigate('/todo')}>
                                查看全部 <ArrowRight size={14} />
                            </button>
                        </div>
                        <div className="activity-list">
                            {loading ? (
                                <div className="loading-dots">加载中...</div>
                            ) : recentActivity.length === 0 ? (
                                <div className="empty-state">暂无活动记录</div>
                            ) : (
                                recentActivity.map(todo => (
                                    <div key={todo.id} className="activity-item" onClick={() => { if (window.getSelection().toString()) return; navigate('/todo'); }}>
                                        <div className={clsx('activity-icon', `status-${todo.status}`)}>
                                            {todo.status === 'done' ? <CheckSquare size={16} /> : <Activity size={16} />}
                                        </div>
                                        <div className="activity-details">
                                            <span className="activity-title">{todo.title}</span>
                                            <span className="activity-meta">
                                                {format(new Date(todo.updated_at), 'MM-dd HH:mm')} · {todo.status === 'done' ? '已完成' : '更新了状态'}
                                            </span>
                                        </div>
                                        <div className={clsx('status-badge', `status-${todo.status}`)}>
                                            {todo.status === 'in_progress' && '进行中'}
                                            {todo.status === 'open' && '未开始'}
                                            {todo.status === 'pending_review' && '待审核'}
                                            {todo.status === 'done' && '已完成'}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="section-card" style={{ marginTop: '1.5rem' }}>
                        <div className="section-header">
                            <h3><FileText size={18} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />版本更新日志</h3>
                            {isL0 && !changelogEditing && (
                                <button className="create-btn" style={{ fontSize: '0.82rem', padding: '0.35rem 0.75rem' }} onClick={() => {
                                    setChangelogEditing('new');
                                    setChangelogForm({ version: '', title: '', content: '' });
                                }}>
                                    <Plus size={14} /> 新增版本
                                </button>
                            )}
                        </div>

                        {changelogEditing && (
                            <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #e2e8f0' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                    <input type="text" placeholder="版本号 (如 v1.2.0)" value={changelogForm.version} onChange={(e) => setChangelogForm(p => ({ ...p, version: e.target.value }))} style={{ padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem' }} />
                                    <input type="text" placeholder="更新标题" value={changelogForm.title} onChange={(e) => setChangelogForm(p => ({ ...p, title: e.target.value }))} style={{ padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem' }} />
                                </div>
                                <textarea placeholder="更新内容（支持多行）" value={changelogForm.content} onChange={(e) => setChangelogForm(p => ({ ...p, content: e.target.value }))} rows={4} style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem', resize: 'vertical' }} />
                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', justifyContent: 'flex-end' }}>
                                    <button style={{ padding: '0.35rem 0.75rem', fontSize: '0.82rem', border: '1px solid #cbd5e1', borderRadius: '6px', background: 'white', cursor: 'pointer' }} onClick={() => setChangelogEditing(null)}><X size={14} /> 取消</button>
                                    <button className="create-btn" style={{ padding: '0.35rem 0.75rem', fontSize: '0.82rem' }} onClick={handleSaveChangelog} disabled={changelogSaving}><Save size={14} /> {changelogSaving ? '保存中...' : '保存'}</button>
                                </div>
                            </div>
                        )}

                        {changelogs.length === 0 ? (
                            <div className="empty-state">暂无版本更新记录</div>
                        ) : (() => {
                            const log = changelogs[selectedChangelogIdx] || changelogs[0];
                            return (
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <select
                                                value={selectedChangelogIdx}
                                                onChange={(e) => setSelectedChangelogIdx(Number(e.target.value))}
                                                style={{ padding: '0.25rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.82rem', color: '#0369a1', fontWeight: '600', background: '#f0f9ff', cursor: 'pointer' }}
                                            >
                                                {changelogs.map((c, i) => (
                                                    <option key={c.id} value={i}>{c.version}{i === 0 ? ' (最新)' : ''}</option>
                                                ))}
                                            </select>
                                            <span style={{ fontWeight: '600', fontSize: '0.9rem', color: '#1e293b' }}>{log.title}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{log.published_by_name} {log.published_at ? format(new Date(log.published_at), 'yyyy-MM-dd') : ''}</span>
                                            {isL0 && (
                                                <>
                                                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '2px' }} onClick={() => { setChangelogEditing(log.id); setChangelogForm({ version: log.version, title: log.title, content: log.content }); }} title="编辑"><Edit3 size={14} /></button>
                                                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '2px' }} onClick={() => handleDeleteChangelog(log.id)} title="删除"><Trash2 size={14} /></button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '0.83rem', color: '#475569', lineHeight: '1.6' }} className="changelog-markdown">
                                        <ReactMarkdown>{log.content}</ReactMarkdown>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>

                <div className="section-card quick-access">
                    <div className="section-header">
                        <h3>请假申请</h3>
                    </div>
                    <form className="leave-form" onSubmit={handleCreateLeave}>
                        <div className="leave-balance-panel">
                            <div className="leave-balance-title">我的剩余额度（天）</div>
                            <div className="leave-balance-grid">
                                <span>年假：{myProfile?.leave_annual_remaining ?? '-'}</span>
                                <span>产假：{myProfile?.leave_maternity_remaining ?? '-'}</span>
                                <span>婚假：{myProfile?.leave_marriage_remaining ?? '-'}</span>
                                <span>事假：{myProfile?.leave_personal_remaining ?? '-'}</span>
                                <span>病假：{myProfile?.leave_sick_remaining ?? '-'}</span>
                            </div>
                            {myProfile?.level === 0 && (
                                <div className="leave-l0-tip">L0 级别无需请假</div>
                            )}
                        </div>
                        <label>
                            请假类型
                            <select
                                value={leaveForm.leave_type}
                                onChange={(e) => setLeaveForm(prev => ({ ...prev, leave_type: e.target.value }))}
                                disabled={myProfile?.level === 0}
                            >
                                <option value="annual">年假</option>
                                <option value="maternity">产假</option>
                                <option value="marriage">婚假</option>
                                <option value="sick">病假</option>
                                <option value="personal">事假</option>
                            </select>
                        </label>
                        <label>
                            开始日期
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <input
                                    type="date"
                                    value={leaveForm.start_date}
                                    onChange={(e) => setLeaveForm(prev => ({ ...prev, start_date: e.target.value }))}
                                    disabled={myProfile?.level === 0}
                                    style={{ flex: 1 }}
                                />
                                <select
                                    value={leaveForm.start_half}
                                    onChange={(e) => setLeaveForm(prev => ({ ...prev, start_half: e.target.value }))}
                                    disabled={myProfile?.level === 0}
                                    style={{ width: '80px' }}
                                >
                                    <option value="am">上午</option>
                                    <option value="pm">下午</option>
                                </select>
                            </div>
                        </label>
                        <label>
                            结束日期
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <input
                                    type="date"
                                    value={leaveForm.end_date}
                                    onChange={(e) => setLeaveForm(prev => ({ ...prev, end_date: e.target.value }))}
                                    disabled={myProfile?.level === 0}
                                    style={{ flex: 1 }}
                                />
                                <select
                                    value={leaveForm.end_half}
                                    onChange={(e) => setLeaveForm(prev => ({ ...prev, end_half: e.target.value }))}
                                    disabled={myProfile?.level === 0}
                                    style={{ width: '80px' }}
                                >
                                    <option value="am">上午</option>
                                    <option value="pm">下午</option>
                                </select>
                            </div>
                        </label>
                        <label>
                            请假原因
                            <textarea
                                value={leaveForm.reason}
                                onChange={(e) => setLeaveForm(prev => ({ ...prev, reason: e.target.value }))}
                                placeholder="请输入请假原因（可选）"
                                rows={3}
                                disabled={myProfile?.level === 0}
                            />
                        </label>
                        <button className="create-btn leave-submit-btn" type="submit" disabled={leaveSubmitting || myProfile?.level === 0}>
                            <CalendarClock size={16} />
                            {leaveSubmitting ? '提交中...' : '提交请假'}
                        </button>
                    </form>

                    <div className="leave-list">
                        <h4>最近请假</h4>
                        {leaves.length === 0 ? (
                            <div className="empty-state">暂无请假记录</div>
                        ) : (
                            leaves.map((leave) => (
                                <div className="leave-item" key={leave.id}>
                                    <div className="leave-item-main">
                                        <span className="leave-type">
                                            {leave.leave_type === 'annual' && '年假'}
                                            {leave.leave_type === 'maternity' && '产假'}
                                            {leave.leave_type === 'marriage' && '婚假'}
                                            {leave.leave_type === 'sick' && '病假'}
                                            {leave.leave_type === 'personal' && '事假'}
                                        </span>
                                        <span className="leave-time">
                                            {format(new Date(leave.start_at), 'MM-dd HH:mm')} - {format(new Date(leave.end_at), 'MM-dd HH:mm')}
                                        </span>
                                    </div>
                                    <span className={clsx('leave-status', `leave-${leave.status}`)}>
                                        {leave.status === 'pending' && '待审批'}
                                        {leave.status === 'approved' && '已通过'}
                                        {leave.status === 'rejected' && '已拒绝'}
                                        {leave.status === 'cancelled' && '已取消'}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="leave-list" style={{ marginTop: '16px' }}>
                        <h4>待我审批</h4>
                        {teamPendingLeaves.length === 0 ? (
                            <div className="empty-state">暂无待审批请假</div>
                        ) : (
                            teamPendingLeaves.map((leave) => (
                                <div className="leave-item leave-review-item" key={leave.id}>
                                    <div className="leave-item-main">
                                        <span className="leave-type">{leave.applicant_name || '员工'} · 请假申请</span>
                                        <span className="leave-time">
                                            {format(new Date(leave.start_at), 'MM-dd HH:mm')} - {format(new Date(leave.end_at), 'MM-dd HH:mm')}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                            className="btn-link"
                                            type="button"
                                            disabled={leaveReviewingId === leave.id}
                                            onClick={() => handleApproveLeave(leave.id)}
                                        >
                                            通过
                                        </button>
                                        <button
                                            className="btn-link text-danger"
                                            type="button"
                                            disabled={leaveReviewingId === leave.id}
                                            onClick={() => handleRejectLeave(leave.id)}
                                        >
                                            驳回
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Agent Token Management */}
            <div className="dashboard-section" style={{ marginTop: '24px' }}>
                <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                        <Key size={18} /> Agent 密钥
                    </h3>
                    <button className="create-btn" onClick={() => { setShowTokenCreate(true); setNewToken(null); setTokenForm({ name: '', expires_in_days: '' }); }}>
                        <Plus size={14} /> 生成密钥
                    </button>
                </div>

                {showTokenCreate && (
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '12px' }}>
                        {newToken ? (
                            <div>
                                <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '8px' }}>密钥已生成，请立即复制保存（关闭后无法再查看）：</div>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <code style={{ flex: 1, padding: '8px 12px', background: '#1e293b', color: '#4ade80', borderRadius: '6px', fontSize: '0.8rem', wordBreak: 'break-all' }}>{newToken}</code>
                                    <button
                                        className="create-btn"
                                        onClick={() => { navigator.clipboard.writeText(newToken); setTokenCopied(true); setTimeout(() => setTokenCopied(false), 2000); }}
                                    >
                                        {tokenCopied ? <><Check size={14} /> 已复制</> : <><Copy size={14} /> 复制</>}
                                    </button>
                                </div>
                                <button className="create-btn" style={{ marginTop: '8px', background: '#64748b' }} onClick={() => { setShowTokenCreate(false); setNewToken(null); }}>
                                    关闭
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                <label style={{ flex: 1, minWidth: '150px' }}>
                                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>名称</span>
                                    <input type="text" value={tokenForm.name} onChange={e => setTokenForm(p => ({ ...p, name: e.target.value }))}
                                        placeholder="如：我的 Claude Agent" style={{ width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', marginTop: '4px' }} />
                                </label>
                                <label style={{ width: '120px' }}>
                                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>有效期</span>
                                    <select value={tokenForm.expires_in_days} onChange={e => setTokenForm(p => ({ ...p, expires_in_days: e.target.value }))}
                                        style={{ width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', marginTop: '4px' }}>
                                        <option value="">永久</option>
                                        <option value="30">30 天</option>
                                        <option value="90">90 天</option>
                                        <option value="180">180 天</option>
                                    </select>
                                </label>
                                <button className="create-btn" onClick={async () => {
                                    try {
                                        const res = await agentTokenApi.create({
                                            name: tokenForm.name || 'Agent Token',
                                            expires_in_days: tokenForm.expires_in_days ? parseInt(tokenForm.expires_in_days) : null,
                                        });
                                        setNewToken(res.data.token);
                                        const listRes = await agentTokenApi.list();
                                        setAgentTokens(listRes.data || []);
                                    } catch (err) { alert(err?.response?.data?.message || '创建失败'); }
                                }}>
                                    生成
                                </button>
                                <button style={{ padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', background: 'white', cursor: 'pointer' }}
                                    onClick={() => setShowTokenCreate(false)}>取消</button>
                            </div>
                        )}
                    </div>
                )}

                {agentTokens.length === 0 && !showTokenCreate ? (
                    <div style={{ color: '#94a3b8', fontSize: '0.9rem', padding: '12px 0' }}>暂无密钥，生成后可供 AI Agent 使用。</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {agentTokens.map(t => (
                            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: t.is_active ? '#f8fafc' : '#fef2f2', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                                <div>
                                    <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{t.name} <code style={{ fontSize: '0.75rem', color: '#94a3b8', marginLeft: '8px' }}>{t.token_preview}</code></div>
                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                                        创建: {t.created_at?.slice(0, 10)}
                                        {t.expires_at && ` · 到期: ${t.expires_at.slice(0, 10)}`}
                                        {t.last_used_at && ` · 最后使用: ${t.last_used_at.slice(0, 16).replace('T', ' ')}`}
                                        {!t.is_active && <span style={{ color: '#ef4444', marginLeft: '8px' }}>已撤销</span>}
                                    </div>
                                </div>
                                {t.is_active && (
                                    <button style={{ padding: '4px 10px', border: '1px solid #fca5a5', borderRadius: '6px', background: 'white', color: '#ef4444', cursor: 'pointer', fontSize: '0.8rem' }}
                                        onClick={async () => {
                                            if (!window.confirm('确认撤销此密钥？撤销后使用该密钥的 Agent 将无法继续访问。')) return;
                                            try {
                                                await agentTokenApi.revoke(t.id);
                                                const res = await agentTokenApi.list();
                                                setAgentTokens(res.data || []);
                                            } catch (err) { alert(err?.response?.data?.message || '撤销失败'); }
                                        }}>
                                        撤销
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <TodoModal
                isOpen={createModalOpen}
                onClose={() => setCreateModalOpen(false)}
                onSubmit={handleCreateTodo}
                mode="create"
                currentUserId={user?.id}
            />
        </div>
    );
}
