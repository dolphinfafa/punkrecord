import { useState, useEffect } from 'react';
import { todoApi } from '@/api/todo';
import { useAuth } from '@/contexts/AuthContext';
import client from '@/api/client';
import {
    Plus, Check, Clock, AlertCircle, Calendar, Users, User, LayoutGrid, List
} from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';
import TodoModal from '@/components/todo/TodoModal';
import TodoDetailModal from '@/components/todo/TodoDetailModal';
import './TodoPage.css';

const STATUS_LABELS = {
    open: '未开始', in_progress: '进行中', blocked: '已阻塞',
    pending_review: '上报完成', done: '已完成', dismissed: '已忽略'
};
const PRIORITY_LABELS = { p0: 'P0', p1: 'P1', p2: 'P2', p3: 'P3' };

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
    const [hasSubordinates, setHasSubordinates] = useState(false);
    const [subordinates, setSubordinates] = useState([]);
    const [draggedTodo, setDraggedTodo] = useState(null);

    // Fetch entity and check if user has subordinates
    useEffect(() => {
        const init = async () => {
            try {
                const res = await client.get('/iam/our-entities');
                const entities = res.data;
                if (entities?.length > 0) setEntityId(entities[0].id);
            } catch { }

            try {
                const res = await todoApi.listTeam({ page_size: 1 });
                const subs = res.data?.subordinates || [];
                setHasSubordinates(subs.length > 0);
                setSubordinates(subs);
            } catch { }
        };
        init();
    }, []);

    const fetchTodos = async () => {
        try {
            setLoading(true);
            let response;
            if (viewMode === 'team') {
                // If filter is 'board', fetch all active tasks (or rely on backend logic for 'open')
                // Backend 'open' usually returns OPEN, IN_PROGRESS, BLOCKED. 
                // We need DONE and PENDING_REVIEW too for the board.
                // Let's use 'all' for board fetching and filter/group in client.
                const statusParam = filter === 'board' ? undefined : (filter === 'all' ? undefined : filter);
                response = await todoApi.listTeam({ status: statusParam });
            } else {
                const statusParam = filter === 'board' ? undefined : (filter === 'all' ? undefined : filter);
                response = await todoApi.list({ status: statusParam });
            }
            // For board view, we might want to filter out dismissed or very old done tasks if not done by backend
            setTodos(response.data?.items || []);
        } catch (error) {
            showNotification('获取任务列表失败', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchTodos(); }, [filter, viewMode]);

    const showNotification = (message, type = 'success') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 3000);
    };

    const handleCreateTodo = async (formData) => {
        try {
            await todoApi.create({ ...formData, our_entity_id: entityId });
            showNotification('任务创建成功');
            fetchTodos();
        } catch (error) {
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
            showNotification(err.response?.data?.detail || '操作失败', 'error');
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
            showNotification(err.response?.data?.detail || '提交失败', 'error');
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
            showNotification(err.response?.data?.detail || '操作失败', 'error');
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
            showNotification(err.response?.data?.detail || '操作失败', 'error');
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

        try {
            // Forward Transitions
            if (todo.status === 'open' && targetStatus === 'in_progress') {
                await todoApi.start(todo.id);
                showNotification('任务已开始');
            } else if (todo.status === 'in_progress' && targetStatus === 'pending_review') {
                await todoApi.submit(todo.id);
                showNotification('已提交完成');
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
                    await todoApi.submit(todo.id);
                    showNotification('已提交');
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
            showNotification(err.response?.data?.detail || '操作失败', 'error');
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
                    onClick={() => { setViewMode('my'); setFilter('board'); }}
                >
                    <User size={15} /> 我的任务
                </button>
                {hasSubordinates && (
                    <button
                        className={clsx('view-tab', { active: viewMode === 'team' })}
                        onClick={() => { setViewMode('team'); setFilter('board'); }}
                    >
                        <Users size={15} /> 团队任务
                    </button>
                )}
            </div>

            {/* View Toggle (Board vs List) */}
            <div className="todo-filters">
                <button
                    className={clsx('filter-btn', { active: filter === 'board' })}
                    onClick={() => setFilter('board')}
                >
                    <LayoutGrid size={13} /> 看板视图
                </button>
                <button
                    className={clsx('filter-btn', { active: filter === 'all' })}
                    onClick={() => setFilter('all')}
                >
                    <List size={13} /> 全部列表
                </button>
            </div>

            {loading ? (
                <div className="loading-state">加载中...</div>
            ) : (
                <>
                    {filter === 'board' ? (
                        <div className="todo-board">
                            {['open', 'in_progress', 'pending_review', 'done'].map(status => {
                                const columnTodos = todos.filter(t => t.status === status);
                                return (
                                    <div
                                        key={status}
                                        className="board-column"
                                        onDragOver={handleDragOver}
                                        onDrop={(e) => handleDrop(e, status)}
                                    >
                                        <div className="column-header">
                                            <span className={clsx('status-dot', `status-${status}`)}></span>
                                            <h3>{STATUS_LABELS[status]}</h3>
                                            <span className="count-badge">{columnTodos.length}</span>
                                        </div>
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
                                                        {viewMode === 'team' && todo.assignee_name && (
                                                            <div className="avatar-circle" title={todo.assignee_name}>
                                                                {todo.assignee_name[0]}
                                                            </div>
                                                        )}
                                                        {/* Actions could go here */}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="todo-list">
                            {todos.length === 0 ? (
                                <div className="empty-state">暂无任务</div>
                            ) : (
                                todos.map(todo => (
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
                                                <span className={clsx('priority-badge', `priority-${todo.priority}`)}>
                                                    {PRIORITY_LABELS[todo.priority] || todo.priority}
                                                </span>
                                                <span className={clsx('status-mini', `status-${todo.status}`)}>
                                                    {STATUS_LABELS[todo.status]}
                                                </span>
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
                onClose={() => { setDetailModalOpen(false); setSelectedTodo(null); }}
                todo={selectedTodo}
                onEdit={handleEditClick}
                onStart={handleStart}
                onSubmit={handleSubmit}
                onApprove={handleApprove}
                onReject={handleReject}
                onBlock={handleBlock}
                onDismiss={handleDismiss}
                currentUserId={user?.id}
                isManager={isManagerOfTodo(selectedTodo)}
            />
        </div>
    );
}
