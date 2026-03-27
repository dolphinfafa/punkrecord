import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BarChart3, ChevronDown, ChevronRight, Loader2, Pencil, Plus, RefreshCw, Trash2, Users, X } from 'lucide-react';
import projectApi from '@/api/project';
import { todoApi } from '@/api/todo';
import { useAuth } from '@/contexts/AuthContext';
import './DevelopmentProgressPage.css';

const STATUS_ORDER = ['open', 'in_progress', 'pending_review', 'done', 'blocked', 'dismissed'];
const STATUS_LABELS = {
    open: '未开始',
    in_progress: '进行中',
    pending_review: '上报完成',
    done: '已完成',
    blocked: '阻塞',
    dismissed: '已忽略',
};

const DEV_TYPE_LABELS = {
    dev_backend: '后端',
    dev_frontend: '前端',
    dev_ui: 'UI',
    dev_product: '产品',
    other: '其他',
};

const TYPE_ORDER = ['dev_frontend', 'dev_backend', 'dev_ui', 'dev_product', 'other'];
const PRIORITY_OPTIONS = ['p0', 'p1', 'p2', 'p3'];
const DEV_TYPE_OPTIONS = ['dev_frontend', 'dev_backend', 'dev_ui', 'dev_product', 'other'];
const STATUS_PROGRESS = {
    open: 10,
    in_progress: 55,
    pending_review: 90,
    done: 100,
    blocked: 40,
    dismissed: 100,
};

function getTaskTypeKey(task) {
    const tag = task?.tags?.[0];
    return DEV_TYPE_LABELS[tag] ? tag : 'other';
}

function defaultTaskForm(project, members) {
    return {
        title: '',
        description: '',
        assignee_user_id: project?.pm_user_id || members?.[0]?.id || '',
        priority: 'p2',
        due_at: project?.due_at || '',
        dev_type: 'dev_backend',
    };
}

function normalizeId(id) {
    return String(id || '').replace(/-/g, '').toLowerCase();
}

export default function DevelopmentProgressPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [project, setProject] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [syncingTasks, setSyncingTasks] = useState(false);
    const [assigningTaskId, setAssigningTaskId] = useState(null);
    const [error, setError] = useState(null);
    const [opMessage, setOpMessage] = useState(null);
    const [viewMode, setViewMode] = useState('table');
    const [collapsedTypeMap, setCollapsedTypeMap] = useState({});

    const [taskModalOpen, setTaskModalOpen] = useState(false);
    const [taskModalMode, setTaskModalMode] = useState('create');
    const [taskModalSubmitting, setTaskModalSubmitting] = useState(false);
    const [editingTaskId, setEditingTaskId] = useState(null);
    const [taskForm, setTaskForm] = useState(defaultTaskForm(null, []));

    const [selectedTaskIds, setSelectedTaskIds] = useState([]);
    const [batchAssigneeUserId, setBatchAssigneeUserId] = useState('');
    const [batchAssigning, setBatchAssigning] = useState(false);
    const [clearingAll, setClearingAll] = useState(false);

    const refreshTasks = useCallback(async () => {
        const todoRes = await projectApi.getProjectTodos(id);
        const loaded = todoRes.data || [];
        setTasks(loaded);
        setSelectedTaskIds((prev) => prev.filter((taskId) => loaded.some((task) => task.id === taskId)));
    }, [id]);

    const syncFeatureTasks = useCallback(async () => {
        if (!window.confirm('注意：如果同步了功能清单，现有的任务全部都会被清空。是否执行？')) return;
        setGenerating(true);
        setSyncingTasks(true);
        setOpMessage(null);
        try {
            const syncRes = await projectApi.syncDevTasks(id);
            await refreshTasks();
            const summary = syncRes?.data || {};
            setOpMessage(`已同步功能清单任务：重建 ${summary.created || 0}，清理 ${summary.deleted || 0}`);
        } catch (err) {
            setOpMessage(err?.response?.data?.message || err?.message || '同步功能清单任务失败');
        } finally {
            setGenerating(false);
            setSyncingTasks(false);
        }
    }, [id, refreshTasks]);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [projectRes, todoRes, featureRes] = await Promise.all([
                projectApi.getProject(id),
                projectApi.getProjectTodos(id),
                projectApi.getProjectFeatureList(id),
            ]);

            const proj = projectRes.data;
            const todoItems = todoRes.data || [];
            const featureData = featureRes.data || {};
            const featureMembers = featureData.members || [];
            const pm = proj?.pm_user_id
                ? { id: proj.pm_user_id, display_name: proj.pm_name || '项目经理', is_pm: true }
                : null;
            const mergedMembers = pm
                ? [pm, ...featureMembers.filter((m) => m.id !== pm.id)]
                : featureMembers;

            setProject(proj);
            setTasks(todoItems);
            setSelectedTaskIds([]);
            setMembers(mergedMembers);
        } catch (err) {
            setError(err?.response?.data?.message || err?.message || '加载开发进度失败');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        if (id) load();
    }, [id, load]);

    const stats = useMemo(() => {
        const total = tasks.length;
        const done = tasks.filter((t) => t.status === 'done').length;
        const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
        const pendingReview = tasks.filter((t) => t.status === 'pending_review').length;
        const progress = total ? Math.round((done / total) * 100) : 0;
        return { total, done, inProgress, pendingReview, progress };
    }, [tasks]);

    const groupedByType = useMemo(() => {
        const statusRank = STATUS_ORDER.reduce((acc, cur, idx) => ({ ...acc, [cur]: idx }), {});
        const groupMap = TYPE_ORDER.reduce((acc, key) => ({ ...acc, [key]: [] }), {});
        tasks.forEach((task) => {
            const typeKey = getTaskTypeKey(task);
            groupMap[typeKey].push(task);
        });
        return TYPE_ORDER.map((typeKey) => ({
            typeKey,
            label: DEV_TYPE_LABELS[typeKey] || '其他',
            items: groupMap[typeKey].sort((a, b) => {
                const sa = statusRank[a.status] ?? 999;
                const sb = statusRank[b.status] ?? 999;
                if (sa !== sb) return sa - sb;
                if (!a.due_at && !b.due_at) return 0;
                if (!a.due_at) return 1;
                if (!b.due_at) return -1;
                return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
            }),
        })).filter((g) => g.items.length > 0);
    }, [tasks]);

    const orderedTasks = useMemo(() => groupedByType.flatMap((g) => g.items), [groupedByType]);

    const timeline = useMemo(() => {
        const DAY = 24 * 60 * 60 * 1000;
        const dueDates = orderedTasks
            .map((t) => (t.due_at ? new Date(t.due_at) : null))
            .filter(Boolean);
        let start = project?.start_at ? new Date(project.start_at) : null;
        if (!start && dueDates.length > 0) {
            start = new Date(Math.min(...dueDates.map((d) => d.getTime())));
        }
        if (!start) start = new Date();
        let end = dueDates.length > 0 ? new Date(Math.max(...dueDates.map((d) => d.getTime()))) : new Date(start);
        if (end.getTime() <= start.getTime()) {
            end = new Date(start.getTime() + 14 * DAY);
        }
        const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / DAY));
        return { start, end, totalDays, DAY };
    }, [orderedTasks, project?.start_at]);

    const reviewerName = project?.pm_name || '项目经理';
    const isL0 = (user?.job_title_name || '').toUpperCase().includes('L0');
    const canManage = normalizeId(user?.id) === normalizeId(project?.pm_user_id)
        || normalizeId(user?.id) === normalizeId(project?.owner_user_id)
        || isL0;
    const allTaskIds = useMemo(() => tasks.map((task) => task.id), [tasks]);
    const allChecked = allTaskIds.length > 0 && selectedTaskIds.length === allTaskIds.length;

    const handleAssign = async (todoId, assigneeUserId) => {
        if (!assigneeUserId) return;
        try {
            setOpMessage(null);
            setAssigningTaskId(todoId);
            await projectApi.updateProjectTodoPlan(id, todoId, { assignee_user_id: assigneeUserId });
            await refreshTasks();
        } catch (err) {
            setOpMessage(err?.response?.data?.message || err?.message || '分配任务失败');
        } finally {
            setAssigningTaskId(null);
        }
    };

    const handleDueDate = async (todoId, dateValue) => {
        try {
            setOpMessage(null);
            setAssigningTaskId(todoId);
            const dueAt = dateValue ? `${dateValue}T18:00:00` : null;
            await projectApi.updateProjectTodoPlan(id, todoId, { due_at: dueAt });
            await refreshTasks();
        } catch (err) {
            setOpMessage(err?.response?.data?.message || err?.message || '修改截止日期失败');
        } finally {
            setAssigningTaskId(null);
        }
    };

    const handlePriority = async (todoId, priority) => {
        try {
            setOpMessage(null);
            setAssigningTaskId(todoId);
            await projectApi.updateProjectTodoPlan(id, todoId, { priority });
            await refreshTasks();
        } catch (err) {
            setOpMessage(err?.response?.data?.message || err?.message || '修改优先级失败');
        } finally {
            setAssigningTaskId(null);
        }
    };

    const openCreateTaskModal = () => {
        setTaskModalMode('create');
        setEditingTaskId(null);
        setTaskForm(defaultTaskForm(project, members));
        setTaskModalOpen(true);
    };

    const openEditTaskModal = (task) => {
        setTaskModalMode('edit');
        setEditingTaskId(task.id);
        setTaskForm({
            title: task.title || '',
            description: task.description || '',
            assignee_user_id: task.assignee_user_id || project?.pm_user_id || '',
            priority: (task.priority || 'p2').toLowerCase(),
            due_at: task.due_at ? new Date(task.due_at).toISOString().slice(0, 10) : '',
            dev_type: task?.tags?.[0] || 'dev_backend',
        });
        setTaskModalOpen(true);
    };

    const closeTaskModal = () => {
        if (taskModalSubmitting) return;
        setTaskModalOpen(false);
    };

    const submitTaskModal = async () => {
        if (!taskForm.title.trim()) {
            setOpMessage('任务标题不能为空');
            return;
        }
        if (!taskForm.assignee_user_id) {
            setOpMessage('请选择负责人');
            return;
        }

        try {
            setTaskModalSubmitting(true);
            setOpMessage(null);
            const dueAt = taskForm.due_at ? `${taskForm.due_at}T18:00:00` : null;

            if (taskModalMode === 'create') {
                await todoApi.create({
                    our_entity_id: project.our_entity_id,
                    assignee_user_id: taskForm.assignee_user_id,
                    title: taskForm.title.trim(),
                    description: taskForm.description,
                    source_type: 'project_task',
                    source_id: id,
                    action_type: 'do',
                    priority: taskForm.priority,
                    due_at: dueAt,
                    tags: [taskForm.dev_type],
                    link: {
                        project_id: id,
                        project_name: project.name,
                        dev_type: taskForm.dev_type,
                        generated_from_feature_list: false,
                    },
                });
                setOpMessage('任务已创建');
            } else if (editingTaskId) {
                await projectApi.updateProjectTodoPlan(id, editingTaskId, {
                    title: taskForm.title.trim(),
                    description: taskForm.description,
                    assignee_user_id: taskForm.assignee_user_id,
                    priority: taskForm.priority,
                    due_at: dueAt,
                    dev_type: taskForm.dev_type,
                });
                setOpMessage('任务已更新');
            }

            await refreshTasks();
            setTaskModalOpen(false);
        } catch (err) {
            setOpMessage(err?.response?.data?.message || err?.message || '保存任务失败');
        } finally {
            setTaskModalSubmitting(false);
        }
    };

    const toggleTypeGroup = (typeKey) => {
        setCollapsedTypeMap((prev) => ({ ...prev, [typeKey]: !prev[typeKey] }));
    };

    const toggleTaskSelect = (taskId) => {
        setSelectedTaskIds((prev) => (prev.includes(taskId)
            ? prev.filter((idValue) => idValue !== taskId)
            : [...prev, taskId]));
    };

    const toggleSelectAll = () => {
        setSelectedTaskIds((prev) => (prev.length === allTaskIds.length ? [] : allTaskIds));
    };

    const handleBatchAssign = async () => {
        if (!batchAssigneeUserId) {
            setOpMessage('请先选择负责人');
            return;
        }
        if (selectedTaskIds.length === 0) {
            setOpMessage('请先勾选任务');
            return;
        }
        try {
            setBatchAssigning(true);
            setOpMessage(null);
            const res = await projectApi.batchAssignProjectTodos(id, selectedTaskIds, batchAssigneeUserId);
            await refreshTasks();
            setSelectedTaskIds([]);
            setOpMessage(`已批量更新负责人，共 ${res?.data?.updated || selectedTaskIds.length} 条`);
        } catch (err) {
            setOpMessage(err?.response?.data?.message || err?.message || '批量分配失败');
        } finally {
            setBatchAssigning(false);
        }
    };

    const handleDeleteTask = async (task) => {
        const ok = window.confirm(`确认删除任务？\n\n${task?.title || ''}\n\n关联待办会一并删除。`);
        if (!ok) return;
        try {
            setAssigningTaskId(task.id);
            setOpMessage(null);
            await projectApi.deleteProjectTodo(id, task.id);
            await refreshTasks();
            setSelectedTaskIds((prev) => prev.filter((itemId) => itemId !== task.id));
            setOpMessage('任务已删除（关联待办已联动删除）');
        } catch (err) {
            setOpMessage(err?.response?.data?.message || err?.message || '删除任务失败');
        } finally {
            setAssigningTaskId(null);
        }
    };

    const handleClearAllTasks = async () => {
        if (!tasks.length) {
            setOpMessage('当前没有可清空的任务');
            return;
        }
        const ok = window.confirm(`确认一键清空当前项目全部开发任务吗？\n\n共 ${tasks.length} 条，关联待办会一并删除。`);
        if (!ok) return;
        try {
            setClearingAll(true);
            setOpMessage(null);
            const res = await projectApi.clearProjectTodos(id);
            await refreshTasks();
            setSelectedTaskIds([]);
            setOpMessage(`任务已清空，已删除 ${res?.data?.deleted || 0} 条（含关联待办）`);
        } catch (err) {
            setOpMessage(err?.response?.data?.message || err?.message || '清空任务失败');
        } finally {
            setClearingAll(false);
        }
    };

    if (loading) {
        return (
            <div className="page-content">
                <div className="dev-progress-loading"><Loader2 size={20} className="spin" /> 加载中...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="page-content">
                <div className="dev-progress-error">{error}</div>
            </div>
        );
    }

    return (
        <div className="page-content dev-progress-page">
            <div className="dev-progress-toolbar">
                <button className="dev-progress-back" onClick={() => navigate(`/project/${id}`)}>
                    <ArrowLeft size={15} /> 返回项目
                </button>
                <div className="dev-progress-actions">
                    <button
                        className="dev-progress-refresh"
                        onClick={syncFeatureTasks}
                        disabled={syncingTasks || !canManage}
                        title={!canManage ? '仅项目经理或项目负责人可操作' : ''}
                    >
                        {syncingTasks ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />} 同步功能清单任务
                    </button>
                    <button
                        className="dev-progress-primary"
                        onClick={openCreateTaskModal}
                        disabled={!canManage}
                        title={!canManage ? '仅项目经理或项目负责人可操作' : ''}
                    >
                        <Plus size={14} /> 新建任务
                    </button>
                    <button
                        className="dev-progress-refresh"
                        onClick={handleClearAllTasks}
                        disabled={!canManage || clearingAll || tasks.length === 0}
                        title={!canManage ? '仅项目经理或项目负责人可操作' : ''}
                    >
                        {clearingAll ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />} 清空任务
                    </button>
                </div>
            </div>

            <div className="dev-progress-hero">
                <div>
                    <p className="dev-progress-kicker">Development Progress</p>
                    <h1>{project?.name}</h1>
                    <p className="dev-progress-subtitle">
                        审核人统一为：<strong>{reviewerName}</strong>
                    </p>
                </div>
                <div className="dev-progress-meter">
                    <div className="dev-progress-percent">{stats.progress}%</div>
                    <div className="dev-progress-track">
                        <div className="dev-progress-fill" style={{ width: `${stats.progress}%` }} />
                    </div>
                    <div className="dev-progress-caption">{stats.done}/{stats.total} 已完成</div>
                </div>
            </div>

            {generating && (
                <div className="dev-progress-banner">
                    <Loader2 size={16} className="spin" /> 正在根据功能清单同步开发任务...
                </div>
            )}
            {opMessage && (
                <div className="dev-progress-banner" style={{ borderColor: '#fecaca', background: '#fef2f2', color: '#991b1b' }}>
                    {opMessage}
                </div>
            )}

            <div className="dev-progress-stats">
                <div className="dev-stat-card">
                    <BarChart3 size={16} />
                    <div>
                        <span>总任务</span>
                        <strong>{stats.total}</strong>
                    </div>
                </div>
                <div className="dev-stat-card">
                    <Users size={16} />
                    <div>
                        <span>进行中</span>
                        <strong>{stats.inProgress}</strong>
                    </div>
                </div>
                <div className="dev-stat-card">
                    <BarChart3 size={16} />
                    <div>
                        <span>上报完成</span>
                        <strong>{stats.pendingReview}</strong>
                    </div>
                </div>
                <div className="dev-stat-card">
                    <BarChart3 size={16} />
                    <div>
                        <span>已完成</span>
                        <strong>{stats.done}</strong>
                    </div>
                </div>
            </div>

            <div className="dev-view-toggle">
                <button
                    className={viewMode === 'table' ? 'active' : ''}
                    onClick={() => setViewMode('table')}
                >
                    表格视图
                </button>
                <button
                    className={viewMode === 'gantt' ? 'active' : ''}
                    onClick={() => setViewMode('gantt')}
                >
                    甘特视图
                </button>
            </div>

            <div className="dev-batch-panel">
                <div className="dev-batch-title">
                    <Users size={15} />
                    <span>批量指定负责人</span>
                    <em>已勾选 {selectedTaskIds.length} 项</em>
                </div>
                <div className="dev-batch-controls">
                    <select
                        className="dev-batch-select"
                        value={batchAssigneeUserId}
                        onChange={(e) => setBatchAssigneeUserId(e.target.value)}
                        disabled={!canManage || batchAssigning}
                    >
                        <option value="">请选择负责人</option>
                        {members.map((m) => (
                            <option key={m.id} value={m.id}>
                                {m.display_name}{m.is_pm ? ' (PM)' : ''}
                            </option>
                        ))}
                    </select>
                    <button
                        className="dev-progress-primary"
                        onClick={handleBatchAssign}
                        disabled={!canManage || batchAssigning || !batchAssigneeUserId || selectedTaskIds.length === 0}
                        title={!canManage ? '仅项目经理或项目负责人可操作' : ''}
                    >
                        {batchAssigning ? <Loader2 size={14} className="spin" /> : <Users size={14} />}
                        批量分配
                    </button>
                </div>
            </div>

            {viewMode === 'table' ? (
                <div className="dev-table-wrap">
                    <table className="dev-table">
                        <thead>
                            <tr>
                                <th style={{ width: '42px' }}>
                                    <input
                                        type="checkbox"
                                        checked={allChecked}
                                        onChange={toggleSelectAll}
                                        disabled={!canManage || tasks.length === 0}
                                    />
                                </th>
                                <th>任务</th>
                                <th>状态</th>
                                <th>优先级</th>
                                <th>负责人</th>
                                <th>审核人</th>
                                <th>截止日期</th>
                                <th>进度</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {groupedByType.map((group) => (
                                <React.Fragment key={group.typeKey}>
                                    <tr className="group-row" onClick={() => toggleTypeGroup(group.typeKey)}>
                                        <td colSpan={9}>
                                            <span className="group-toggle">
                                                {collapsedTypeMap[group.typeKey] ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                                                {group.label}
                                            </span>
                                            <span className="group-count">{group.items.length}</span>
                                        </td>
                                    </tr>
                                    {!collapsedTypeMap[group.typeKey] && group.items.map((task) => {
                                        const p = STATUS_PROGRESS[task.status] ?? 0;
                                        return (
                                            <tr key={task.id}>
                                                <td>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedTaskIds.includes(task.id)}
                                                        onChange={() => toggleTaskSelect(task.id)}
                                                        disabled={!canManage}
                                                    />
                                                </td>
                                                <td className="task-title" title={task.title}>{task.title}</td>
                                                <td><span className={`status-tag status-${task.status}`}>{STATUS_LABELS[task.status] || task.status}</span></td>
                                                <td>
                                                    <select
                                                        value={task.priority || 'p2'}
                                                        disabled={assigningTaskId === task.id}
                                                        onChange={(e) => handlePriority(task.id, e.target.value)}
                                                    >
                                                        {PRIORITY_OPTIONS.map((pValue) => (
                                                            <option key={pValue} value={pValue}>{pValue.toUpperCase()}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td>
                                                    <select
                                                        value={task.assignee_user_id || ''}
                                                        disabled={assigningTaskId === task.id}
                                                        onChange={(e) => handleAssign(task.id, e.target.value)}
                                                    >
                                                        <option value="">未分配</option>
                                                        {members.map((m) => (
                                                            <option key={m.id} value={m.id}>
                                                                {m.display_name}{m.is_pm ? ' (PM)' : ''}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td>{reviewerName}</td>
                                                <td>
                                                    <input
                                                        type="date"
                                                        value={task.due_at ? new Date(task.due_at).toISOString().slice(0, 10) : ''}
                                                        disabled={assigningTaskId === task.id}
                                                        onChange={(e) => handleDueDate(task.id, e.target.value)}
                                                    />
                                                </td>
                                                <td>
                                                    <div className="row-progress">
                                                        <div style={{ width: `${p}%` }} />
                                                    </div>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                        <button
                                                            className="dev-edit-btn"
                                                            disabled={!canManage}
                                                            onClick={() => openEditTaskModal(task)}
                                                        >
                                                            <Pencil size={13} /> 编辑
                                                        </button>
                                                        <button
                                                            className="dev-edit-btn"
                                                            disabled={!canManage || assigningTaskId === task.id}
                                                            onClick={() => handleDeleteTask(task)}
                                                            style={{ borderColor: '#fecaca', color: '#b91c1c', background: '#fff5f5' }}
                                                        >
                                                            <Trash2 size={13} /> 删除
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="gantt-wrap">
                    <div className="gantt-head">
                        <span>{timeline.start.toLocaleDateString('zh-CN')}</span>
                        <span>{timeline.end.toLocaleDateString('zh-CN')}</span>
                    </div>
                    <div className="gantt-list">
                        {groupedByType.map((group) => (
                            <div key={group.typeKey} className="gantt-group">
                                <div className="gantt-group-head" onClick={() => toggleTypeGroup(group.typeKey)}>
                                    {collapsedTypeMap[group.typeKey] ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                                    <strong>{group.label}</strong>
                                    <span>{group.items.length}</span>
                                </div>
                                {!collapsedTypeMap[group.typeKey] && group.items.map((task) => {
                                    const progress = STATUS_PROGRESS[task.status] ?? 0;
                                    const due = task.due_at ? new Date(task.due_at) : null;
                                    let widthPct = 8;
                                    if (due) {
                                        const raw = ((due.getTime() - timeline.start.getTime()) / timeline.DAY) / timeline.totalDays;
                                        widthPct = Math.max(8, Math.min(100, Math.round(raw * 100)));
                                    }
                                    return (
                                        <div key={task.id} className="gantt-row">
                                            <div className="gantt-meta">
                                                <strong title={task.title}>{task.title}</strong>
                                                <span>{task.assignee_name || '未分配'} · {STATUS_LABELS[task.status] || task.status}</span>
                                            </div>
                                            <div className="gantt-track">
                                                <div className={`gantt-bar status-${task.status}`} style={{ width: `${widthPct}%` }}>
                                                    <i style={{ width: `${progress}%` }} />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {taskModalOpen && (
                <div className="modal-overlay" onClick={closeTaskModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{taskModalMode === 'create' ? '新建任务' : '编辑任务'}</h2>
                            <button className="modal-close-btn" onClick={closeTaskModal}><X size={18} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>任务标题</label>
                                <input
                                    value={taskForm.title}
                                    onChange={(e) => setTaskForm((prev) => ({ ...prev, title: e.target.value }))}
                                    placeholder="输入任务标题"
                                />
                            </div>
                            <div className="form-group">
                                <label>任务描述</label>
                                <textarea
                                    rows={4}
                                    value={taskForm.description}
                                    onChange={(e) => setTaskForm((prev) => ({ ...prev, description: e.target.value }))}
                                    placeholder="输入任务描述"
                                />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>负责人</label>
                                    <select
                                        value={taskForm.assignee_user_id}
                                        onChange={(e) => setTaskForm((prev) => ({ ...prev, assignee_user_id: e.target.value }))}
                                    >
                                        <option value="">请选择负责人</option>
                                        {members.map((m) => (
                                            <option key={m.id} value={m.id}>{m.display_name}{m.is_pm ? ' (PM)' : ''}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>优先级</label>
                                    <select
                                        value={taskForm.priority}
                                        onChange={(e) => setTaskForm((prev) => ({ ...prev, priority: e.target.value }))}
                                    >
                                        {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p.toUpperCase()}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>开发类型</label>
                                    <select
                                        value={taskForm.dev_type}
                                        onChange={(e) => setTaskForm((prev) => ({ ...prev, dev_type: e.target.value }))}
                                    >
                                        {DEV_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{DEV_TYPE_LABELS[t]}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>截止日期</label>
                                    <input
                                        type="date"
                                        value={taskForm.due_at}
                                        onChange={(e) => setTaskForm((prev) => ({ ...prev, due_at: e.target.value }))}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn-secondary" onClick={closeTaskModal} disabled={taskModalSubmitting}>取消</button>
                            <button type="button" className="btn-primary" onClick={submitTaskModal} disabled={taskModalSubmitting}>
                                {taskModalSubmitting ? '保存中...' : '保存'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
