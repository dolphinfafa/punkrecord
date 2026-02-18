import { useState, useEffect } from 'react';
import { todoApi } from '@/api/todo';
import { useAuth } from '@/contexts/AuthContext';
import client from '@/api/client';
import {
    Plus, Check, Clock, AlertCircle, Calendar, Users, User
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
    const [filter, setFilter] = useState('open');
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [selectedTodo, setSelectedTodo] = useState(null);
    const [notification, setNotification] = useState(null);
    const [entityId, setEntityId] = useState(null);
    const [hasSubordinates, setHasSubordinates] = useState(false);
    const [subordinates, setSubordinates] = useState([]);

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
                const statusParam = filter === 'all' ? undefined : filter;
                response = await todoApi.listTeam({ status: statusParam });
            } else {
                const statusParam = filter === 'all' ? undefined : filter;
                response = await todoApi.list({ status: statusParam });
            }
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

    const handleSubmit = async (id) => {
        try {
            await todoApi.submit(id);
            showNotification('已提交完成，等待上级审核');
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

    return (
        <div className="todo-container">
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
                    onClick={() => { setViewMode('my'); setFilter('open'); }}
                >
                    <User size={15} /> 我的任务
                </button>
                {hasSubordinates && (
                    <button
                        className={clsx('view-tab', { active: viewMode === 'team' })}
                        onClick={() => { setViewMode('team'); setFilter('all'); }}
                    >
                        <Users size={15} /> 团队任务
                    </button>
                )}
            </div>

            {/* Status filters */}
            <div className="todo-filters">
                {viewMode === 'my' ? (
                    <>
                        <button className={clsx('filter-btn', { active: filter === 'open' })} onClick={() => setFilter('open')}>未完成</button>
                        <button className={clsx('filter-btn', { active: filter === 'pending_review' })} onClick={() => setFilter('pending_review')}>上报完成</button>
                        <button className={clsx('filter-btn', { active: filter === 'done' })} onClick={() => setFilter('done')}>已完成</button>
                        <button className={clsx('filter-btn', { active: filter === 'all' })} onClick={() => setFilter('all')}>全部</button>
                    </>
                ) : (
                    <>
                        <button className={clsx('filter-btn', { active: filter === 'all' })} onClick={() => setFilter('all')}>全部</button>
                        <button className={clsx('filter-btn', { active: filter === 'pending_review' })} onClick={() => setFilter('pending_review')}>待审核</button>
                        <button className={clsx('filter-btn', { active: filter === 'open' })} onClick={() => setFilter('open')}>进行中</button>
                        <button className={clsx('filter-btn', { active: filter === 'done' })} onClick={() => setFilter('done')}>已完成</button>
                    </>
                )}
            </div>

            {loading ? (
                <div className="loading-state">加载中...</div>
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
