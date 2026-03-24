import { useState, useEffect, useMemo, useRef } from 'react';
import { todoApi } from '@/api/todo';
import { useAuth } from '@/contexts/AuthContext';
import client from '@/api/client';
import {
    Plus, Check, Clock, AlertCircle, Calendar, Users, User, LayoutGrid, List,
    ChevronLeft, ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';
import TodoModal from '@/components/todo/TodoModal';
import TodoDetailModal from '@/components/todo/TodoDetailModal';
import BugImagePreview from '@/components/common/BugImagePreview';
import './TodoPage.css';

const STATUS_LABELS = {
    open: '未开始', in_progress: '进行中', blocked: '已阻塞',
    pending_review: '上报完成', done: '已完成', dismissed: '已忽略'
};
const PRIORITY_LABELS = { p0: 'P0', p1: 'P1', p2: 'P2', p3: 'P3' };
const TASK_TYPE_LABELS = {
    dev_frontend: '前端开发',
    dev_backend: '后端开发',
    dev_ui: 'UI设计',
    dev_product: '产品',
    bug: 'Bug',
    bug_fix: 'Bug修复',
    testing: '测试',
    project_task: '项目任务',
    custom: '自定义任务',
    other: '其他',
};

const getProjectLabel = (todo) => {
    const projectName = todo?.link?.project_name;
    if (projectName) return projectName;
    if (todo?.source_type === 'project_task') return '项目任务';
    return null;
};

const getTodoTypeKey = (todo) => {
    const tags = todo?.tags || [];
    if (tags.includes('bug')) return 'bug';
    if (tags.includes('bug_fix')) return 'bug_fix';
    if (tags.includes('testing')) return 'testing';
    if (tags.includes('dev_frontend')) return 'dev_frontend';
    if (tags.includes('dev_backend')) return 'dev_backend';
    if (tags.includes('dev_ui')) return 'dev_ui';
    if (tags.includes('dev_product')) return 'dev_product';
    if (todo?.source_type === 'project_task') return 'project_task';
    if (todo?.source_type === 'custom') return 'custom';
    return 'other';
};

const hasBugImage = (todo) => {
    const linkType = todo?.link?.type;
    return Boolean(
        (
            (Array.isArray(todo?.link?.bug_images) && todo.link.bug_images.length > 0)
            || todo?.link?.bug_image?.attachment_id
        )
        && todo?.link?.project_id
        && (linkType === 'bug' || linkType === 'bug_fix_todo' || (todo?.tags || []).includes('bug'))
    );
};

const getFirstBugImage = (todo) => {
    if (Array.isArray(todo?.link?.bug_images) && todo.link.bug_images.length > 0) return todo.link.bug_images[0];
    return todo?.link?.bug_image || null;
};

export default function TodoPage() {
    const { user } = useAuth();
    const [todos, setTodos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState('my');   // 'my' | 'team'
    const [filter, setFilter] = useState('board'); // 'board' (kanban) or 'all' (list)
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [selectedTodo, setSelectedTodo] = useState(null);
    const [notification, setNotification] = useState(null);
    const [entityId, setEntityId] = useState(null);
    const [subordinates, setSubordinates] = useState([]);
    const [draggedTodo, setDraggedTodo] = useState(null);
    const [taskTypeFilter, setTaskTypeFilter] = useState('all');
    const [assigneeFilter, setAssigneeFilter] = useState('all');
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const pageSize = 20;
    const [doneExpanded, setDoneExpanded] = useState(false);
    const [doneTodos, setDoneTodos] = useState([]);
    const [doneLoading, setDoneLoading] = useState(false);
    const actioningTodoIdsRef = useRef(new Set());

    // Fetch entity and check if user has subordinates
    useEffect(() => {
        const init = async () => {
            try {
                const res = await client.get('/iam/our-entities');
                const entities = res.data;
                if (entities?.length > 0) setEntityId(entities[0].id);
            } catch {
                setEntityId(null);
            }

            try {
                const res = await todoApi.listTeam({ page_size: 1 });
                const subs = res.data?.subordinates || [];
                setSubordinates(subs);
            } catch {
                setSubordinates([]);
            }
        };
        init();
    }, []);

    const fetchDoneTodos = async () => {
        try {
            setDoneLoading(true);
            const api = viewMode === 'team' ? todoApi.listTeam : todoApi.list;
            const response = await api({ status: 'done', page_size: 100 });
            setDoneTodos(response.data?.items || []);
        } catch {
            // silent
        } finally {
            setDoneLoading(false);
        }
    };

    const fetchTodos = async () => {
        try {
            setLoading(true);
            let response;
            const statusParam = filter === 'board' ? undefined : (filter === 'all' ? undefined : filter);
            if (filter === 'board') {
                // Board view: fetch active tasks only (exclude done), done loaded on expand
                const statuses = ['open', 'in_progress', 'pending_review', 'blocked'];
                const results = await Promise.all(
                    statuses.map(s => {
                        const api = viewMode === 'team' ? todoApi.listTeam : todoApi.list;
                        return api({ status: s, page_size: 100 });
                    })
                );
                const allItems = results.flatMap(r => r.data?.items || []);
                setTodos(allItems);
                setTotalCount(0);
                // Refresh done todos if expanded, don't collapse
                if (doneExpanded) {
                    fetchDoneTodos();
                }
                setLoading(false);
                return;
            } else {
                // List view: use pagination
                if (viewMode === 'team') {
                    response = await todoApi.listTeam({ status: statusParam, page: page, page_size: pageSize });
                } else {
                    response = await todoApi.list({ status: statusParam, page: page, page_size: pageSize });
                }
                setTotalCount(response.data?.total || 0);
            }
            setTodos(response.data?.items || []);
        } catch {
            showNotification('获取任务列表失败', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchTodos(); }, [filter, viewMode, page]);

    const assigneeOptions = useMemo(() => {
        const map = new Map();
        todos.forEach((todo) => {
            if (todo.assignee_user_id && todo.assignee_name) {
                map.set(todo.assignee_user_id, todo.assignee_name);
            }
        });
        return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
    }, [todos]);

    const taskTypeOptions = useMemo(() => {
        const set = new Set();
        todos.forEach((todo) => set.add(getTodoTypeKey(todo)));
        return Array.from(set);
    }, [todos]);

    const filteredTodos = useMemo(() => {
        return todos.filter((todo) => {
            if (taskTypeFilter !== 'all' && getTodoTypeKey(todo) !== taskTypeFilter) return false;
            if (assigneeFilter !== 'all' && todo.assignee_user_id !== assigneeFilter) return false;
            return true;
        });
    }, [todos, taskTypeFilter, assigneeFilter]);

    const showNotification = (message, type = 'success') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 3000);
    };

    const getErrorMessage = (err, fallback = '操作失败') =>
        err?.response?.data?.message || err?.response?.data?.detail || err?.message || fallback;

    const handleCreateTodo = async (formData) => {
        try {
            const createRes = await todoApi.create({ ...formData, our_entity_id: entityId });
            const todoId = createRes?.data?.id;
            const images = Array.isArray(formData.images) ? formData.images : [];
            if (todoId && images.length > 0) {
                for (const file of images) {
                    await todoApi.uploadImage(todoId, file);
                }
            }
            showNotification('任务创建成功');
            fetchTodos();
        } catch {
            throw new Error('创建任务失败，请重试');
        }
    };

    const handleEditTodo = async (formData) => {
        try {
            await todoApi.update(selectedTodo.id, formData);
            showNotification('任务更新成功');
            setEditModalOpen(false);
            setSelectedTodo(null);
            fetchTodos();
        } catch {
            throw new Error('更新任务失败，请重试');
        }
    };

    const handleStart = async (id) => {
        try {
            await todoApi.start(id);
            showNotification('任务已开始');
            setDetailModalOpen(false);
            setSelectedTodo(null);
            fetchTodos();
        } catch (err) {
            showNotification(getErrorMessage(err, '操作失败'), 'error');
        }
    };

    const handleSubmit = async (id) => {
        try {
            await todoApi.submit(id);
            showNotification('已提交完成');
            setDetailModalOpen(false);
            setSelectedTodo(null);
            fetchTodos();
        } catch (err) {
            showNotification(getErrorMessage(err, '提交失败'), 'error');
        }
    };

    const handleApprove = async (id) => {
        try {
            await todoApi.approve(id);
            showNotification('已审核通过');
            setDetailModalOpen(false);
            setSelectedTodo(null);
            fetchTodos();
        } catch (err) {
            showNotification(getErrorMessage(err, '操作失败'), 'error');
        }
    };

    const handleReject = async (id, comment) => {
        try {
            await todoApi.reject(id, comment);
            showNotification('已退回，修改意见已发送');
            setDetailModalOpen(false);
            setSelectedTodo(null);
            fetchTodos();
        } catch (err) {
            showNotification(getErrorMessage(err, '操作失败'), 'error');
        }
    };

    const handleBlock = async (id, reason) => {
        try {
            await todoApi.block(id, reason);
            showNotification('任务已阻塞');
            setDetailModalOpen(false);
            setSelectedTodo(null);
            fetchTodos();
        } catch {
            showNotification('操作失败，请重试', 'error');
        }
    };

    const handleDismiss = async (id, reason) => {
        try {
            await todoApi.dismiss(id, reason);
            showNotification('任务已忽略');
            setDetailModalOpen(false);
            setSelectedTodo(null);
            fetchTodos();
        } catch {
            showNotification('操作失败，请重试', 'error');
        }
    };

    const handleTodoClick = (todo) => {
        setSelectedTodo(todo);
        setDetailModalOpen(true);
    };

    const handleEditClick = (todo) => {
        setSelectedTodo(todo);
        setDetailModalOpen(false);
        setEditModalOpen(true);
    };

    const handleUploadTodoImages = async (todoId, files) => {
        try {
            for (const file of files) {
                await todoApi.uploadImage(todoId, file);
            }
            showNotification(`已上传 ${files.length} 张图片`);
            await fetchTodos();
            const detailRes = await todoApi.get(todoId);
            setSelectedTodo(detailRes?.data || null);
        } catch (err) {
            showNotification(getErrorMessage(err, '上传图片失败'), 'error');
        }
    };

    const handleDeleteTodoImage = async (todoId, imageId) => {
        try {
            await todoApi.deleteImage(todoId, imageId);
            showNotification('图片已删除');
            await fetchTodos();
            const detailRes = await todoApi.get(todoId);
            setSelectedTodo(detailRes?.data || null);
        } catch (err) {
            showNotification(getErrorMessage(err, '删除图片失败'), 'error');
        }
    };

    const canEditTodo = (todo) => {
        if (!todo) return false;
        if (todo.assignee_user_id === user?.id || todo.creator_user_id === user?.id) return true;
        return isManagerOfTodo(todo);
    };

    // Determine if current user is manager of the selected todo's assignee
    const isManagerOfTodo = (todo) => {
        if (!todo) return false;
        return subordinates.some(s => s.id === todo.assignee_user_id);
    };

    const getStatusIcon = (status) => {
        if (status === 'done') return <Check size={14} />;
        if (status === 'pending_review') return <Clock size={14} />;
        if (status === 'blocked') return <AlertCircle size={14} />;
        return null;
    };

    // Drag and Drop Handlers
    const handleDragStart = (e, todo) => {
        setDraggedTodo(todo);
        e.dataTransfer.effectAllowed = 'move';
        // Add a slight transparency to the drag image ghost if possible, primarily handled by CSS on the source
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = async (e, targetStatus) => {
        e.preventDefault();
        if (!draggedTodo) return;
        if (draggedTodo.status === targetStatus) {
            setDraggedTodo(null);
            return;
        }

        const todo = draggedTodo;
        setDraggedTodo(null); // Reset immediately
        if (actioningTodoIdsRef.current.has(todo.id)) return;
        actioningTodoIdsRef.current.add(todo.id);

        try {
            // Forward Transitions
            if (todo.status === 'open' && targetStatus === 'in_progress') {
                await todoApi.start(todo.id);
                showNotification('任务已开始');
            } else if ((todo.status === 'open' || todo.status === 'in_progress') && targetStatus === 'pending_review') {
                const res = await todoApi.submit(todo.id);
                const nextStatus = res?.data?.status;
                showNotification(nextStatus === 'done' ? '任务已完成（无需审核）' : '已上报完成');
            } else if (targetStatus === 'done') {
                if (todo.status === 'pending_review') {
                    // Manager Approve
                    if (isManagerOfTodo(todo) || todo.assignee_user_id === user?.id || todo.creator_user_id === user?.id) {
                        await todoApi.approve(todo.id);
                        showNotification('已审核通过');
                    } else {
                        showNotification('您没有权限审核此任务', 'error');
                        return;
                    }
                } else if (todo.status === 'in_progress' && todo.assignee_user_id === user?.id) {
                    // Self-assigned direct completion handled by submit
                    const res = await todoApi.submit(todo.id);
                    const nextStatus = res?.data?.status;
                    showNotification(nextStatus === 'done' ? '任务已完成（无需审核）' : '已上报完成');
                } else {
                    showNotification('无法直接完成任务', 'error');
                    return;
                }
            }
            // Backward Transitions / Special Cases
            else if (todo.status === 'in_progress' && targetStatus === 'open') {
                await todoApi.updateStatus(todo.id, 'open');
                showNotification('任务已重置为未开始');
            } else if (todo.status === 'pending_review' && targetStatus === 'in_progress') {
                await todoApi.updateStatus(todo.id, 'in_progress', 'Recall via Drag');
                showNotification('任务已撤回至进行中');
            } else if (todo.status === 'done' && targetStatus === 'in_progress') {
                await todoApi.updateStatus(todo.id, 'in_progress', 'Reopen via Drag');
                showNotification('任务已重新打开');
            } else if (todo.status === 'done' && targetStatus === 'open') {
                await todoApi.updateStatus(todo.id, 'open', 'Reset via Drag');
                showNotification('任务已重置为未开始');
            } else if (todo.status === 'pending_review' && targetStatus === 'open') {
                // Reject
                await todoApi.updateStatus(todo.id, 'open', 'Rejected via Board');
                showNotification('任务已退回');
            }
            else {
                showNotification(`不支持从 ${STATUS_LABELS[todo.status]} 拖拽到 ${STATUS_LABELS[targetStatus]}`, 'error');
                return;
            }
            fetchTodos();
        } catch (err) {
            showNotification(getErrorMessage(err, '操作失败'), 'error');
        } finally {
            actioningTodoIdsRef.current.delete(todo.id);
        }
    };

    return (
        <div className="todo-container" style={{ animation: 'fadeIn 0.5s ease-out' }}>
            {notification && (
                <div className={clsx('notification', `notification-${notification.type}`)}>
                    {notification.message}
                </div>
            )}

            <div className="todo-header">
                <h1>{viewMode === 'team' ? '团队任务' : '我的任务'}</h1>
                <button className="create-todo-btn" onClick={() => setCreateModalOpen(true)}>
                    <Plus size={18} /> 新建任务
                </button>
            </div>

            {/* View mode tabs */}
            <div className="todo-view-tabs">
                <button
                    className={clsx('view-tab', { active: viewMode === 'my' })}
                    onClick={() => { setViewMode('my'); setFilter('board'); setAssigneeFilter('all'); setPage(1); }}
                >
                    <User size={15} /> 我的任务
                </button>
                <button
                    className={clsx('view-tab', { active: viewMode === 'team' })}
                    onClick={() => { setViewMode('team'); setFilter('board'); setAssigneeFilter('all'); setPage(1); }}
                >
                    <Users size={15} /> 团队任务
                </button>
            </div>

            {/* View Toggle (Board vs List) */}
            <div className="todo-filters">
                <button
                    className={clsx('filter-btn', { active: filter === 'board' })}
                    onClick={() => { setFilter('board'); setPage(1); }}
                >
                    <LayoutGrid size={13} /> 看板视图
                </button>
                <button
                    className={clsx('filter-btn', { active: filter === 'all' })}
                    onClick={() => { setFilter('all'); setPage(1); }}
                >
                    <List size={13} /> 全部列表
                </button>
                <div className="filter-select-group">
                    <label className="filter-select-item">
                        <span>类型</span>
                        <select
                            className="filter-select"
                            value={taskTypeFilter}
                            onChange={(e) => setTaskTypeFilter(e.target.value)}
                        >
                            <option value="all">全部类型</option>
                            {taskTypeOptions.map((type) => (
                                <option key={type} value={type}>{TASK_TYPE_LABELS[type] || type}</option>
                            ))}
                        </select>
                    </label>
                    <label className="filter-select-item">
                        <span>负责人</span>
                        <select
                            className="filter-select"
                            value={assigneeFilter}
                            onChange={(e) => setAssigneeFilter(e.target.value)}
                        >
                            <option value="all">全部负责人</option>
                            {assigneeOptions.map((item) => (
                                <option key={item.id} value={item.id}>{item.name}</option>
                            ))}
                        </select>
                    </label>
                </div>
            </div>

            {loading ? (
                <div className="loading-state">加载中...</div>
            ) : (
                <>
                    {filter === 'board' ? (
                        <div className="todo-board">
                            {['open', 'in_progress', 'pending_review', 'done'].map(status => {
                                const isDoneCol = status === 'done';
                                const columnTodos = isDoneCol
                                    ? doneTodos
                                    : filteredTodos.filter(t => t.status === status);
                                return (
                                    <div
                                        key={status}
                                        className={clsx('board-column', { 'board-column-collapsed': isDoneCol && !doneExpanded })}
                                        onDragOver={handleDragOver}
                                        onDrop={(e) => handleDrop(e, status)}
                                    >
                                        <div
                                            className="column-header"
                                            style={isDoneCol ? { cursor: 'pointer' } : undefined}
                                            onClick={isDoneCol ? () => {
                                                const next = !doneExpanded;
                                                setDoneExpanded(next);
                                                if (next && doneTodos.length === 0) fetchDoneTodos();
                                            } : undefined}
                                        >
                                            <span className={clsx('status-dot', `status-${status}`)}></span>
                                            <h3>{STATUS_LABELS[status]}</h3>
                                            {isDoneCol && !doneExpanded
                                                ? <span className="count-badge" style={{ fontSize: '11px' }}>点击展开</span>
                                                : <span className="count-badge">{columnTodos.length}</span>
                                            }
                                        </div>
                                        {isDoneCol && !doneExpanded ? (
                                            <div className="column-body" style={{ opacity: 0.5, textAlign: 'center', padding: '2rem 0', fontSize: '13px', color: '#94a3b8' }}>
                                                已折叠
                                            </div>
                                        ) : isDoneCol && doneLoading ? (
                                            <div className="column-body" style={{ textAlign: 'center', padding: '2rem 0', fontSize: '13px', color: '#94a3b8' }}>
                                                加载中...
                                            </div>
                                        ) : (
                                        <div className="column-body">
                                            {columnTodos.map(todo => (
                                                <div
                                                    key={todo.id}
                                                    className={clsx('todo-card', {
                                                        done: todo.status === 'done',
                                                        dragging: draggedTodo?.id === todo.id
                                                    })}
                                                    draggable={todo.status !== 'blocked'} // Allow dragging except blocked
                                                    onDragStart={(e) => handleDragStart(e, todo)}
                                                    onClick={() => handleTodoClick(todo)}
                                                >
                                                    <div className="card-header">
                                                        <span className={clsx('priority-badge', `priority-${todo.priority}`)}>
                                                            {PRIORITY_LABELS[todo.priority]}
                                                        </span>
                                                        {todo.due_at && (
                                                            <span className="due-date">
                                                                {format(new Date(todo.due_at), 'MM/dd')}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="card-title">{todo.title}</div>
                                                    <div className="card-footer">
                                                        {getProjectLabel(todo) && (
                                                            <span className="meta-tag" style={{ marginRight: '6px' }}>
                                                                项目: {getProjectLabel(todo)}
                                                            </span>
                                                        )}
                                                        {todo.assignee_name && (
                                                            <span className="meta-tag">
                                                                <User size={11} /> {todo.assignee_name}
                                                            </span>
                                                        )}
                                                        {/* Actions could go here */}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <>
                        <div className="todo-list">
                            {filteredTodos.length === 0 ? (
                                <div className="empty-state">暂无任务</div>
                            ) : (
                                filteredTodos.map(todo => (
                                    <div
                                        key={todo.id}
                                        className={clsx('todo-item', {
                                            done: todo.status === 'done',
                                            'pending-review': todo.status === 'pending_review'
                                        })}
                                        onClick={() => handleTodoClick(todo)}
                                    >
                                        <div className={clsx('todo-checkbox', { checked: todo.status === 'done' || todo.status === 'pending_review' })}>
                                            {getStatusIcon(todo.status)}
                                        </div>

                                        <div className="todo-content">
                                            <div className="todo-title">{todo.title}</div>
                                            <div className="todo-meta">
                                                {hasBugImage(todo) && (
                                                    <BugImagePreview
                                                        projectId={todo.link.project_id}
                                                        bugImage={getFirstBugImage(todo)}
                                                        compact
                                                    />
                                                )}
                                                <span className={clsx('priority-badge', `priority-${todo.priority}`)}>
                                                    {PRIORITY_LABELS[todo.priority] || todo.priority}
                                                </span>
                                                <span className={clsx('status-mini', `status-${todo.status}`)}>
                                                    {STATUS_LABELS[todo.status]}
                                                </span>
                                                {getProjectLabel(todo) && (
                                                    <span className="meta-tag">
                                                        项目: {getProjectLabel(todo)}
                                                    </span>
                                                )}
                                                {viewMode === 'team' && todo.assignee_name && (
                                                    <span className="meta-tag">
                                                        <User size={11} /> {todo.assignee_name}
                                                    </span>
                                                )}
                                                {viewMode === 'my' && todo.creator_name && todo.creator_user_id !== user?.id && (
                                                    <span className="meta-tag">由 {todo.creator_name} 分配</span>
                                                )}
                                                {todo.due_at && (
                                                    <span className="meta-tag">
                                                        <Calendar size={11} />
                                                        {format(new Date(todo.due_at), 'MM-dd HH:mm')}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        {totalCount > pageSize && (
                            <div className="todo-pagination" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', marginTop: '8px' }}>
                                <span style={{ fontSize: '13px', color: '#64748b' }}>共 {totalCount} 条记录</span>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <button
                                        className="filter-btn"
                                        disabled={page <= 1}
                                        onClick={() => setPage((p) => p - 1)}
                                        style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                                    >
                                        <ChevronLeft size={16} /> 上一页
                                    </button>
                                    <span style={{ fontSize: '13px', color: '#475569' }}>
                                        {page} / {Math.ceil(totalCount / pageSize)}
                                    </span>
                                    <button
                                        className="filter-btn"
                                        disabled={page >= Math.ceil(totalCount / pageSize)}
                                        onClick={() => setPage((p) => p + 1)}
                                        style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                                    >
                                        下一页 <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                        )}
                        </>
                    )}
                </>
            )}

            <TodoModal
                isOpen={createModalOpen}
                onClose={() => setCreateModalOpen(false)}
                onSubmit={handleCreateTodo}
                mode="create"
                currentUserId={user?.id}
            />

            <TodoModal
                isOpen={editModalOpen}
                onClose={() => { setEditModalOpen(false); setSelectedTodo(null); }}
                onSubmit={handleEditTodo}
                initialData={selectedTodo}
                mode="edit"
                currentUserId={user?.id}
            />

            <TodoDetailModal
                isOpen={detailModalOpen}
                onClose={() => { setDetailModalOpen(false); setSelectedTodo(null); fetchTodos(); }}
                todo={selectedTodo}
                onEdit={handleEditClick}
                onStart={handleStart}
                onSubmit={handleSubmit}
                onApprove={handleApprove}
                onReject={handleReject}
                onBlock={handleBlock}
                onDismiss={handleDismiss}
                currentUserId={user?.id}
                canEdit={canEditTodo(selectedTodo)}
                onUploadImages={handleUploadTodoImages}
                onDeleteImage={handleDeleteTodoImage}
            />
        </div>
    );
}
