import { useState, useEffect } from 'react';
import { todoApi } from '@/api/todo';
import { useAuth } from '@/contexts/AuthContext';
import {
    Plus,
    Check,
    Clock,
    AlertCircle,
    Filter,
    MoreVertical,
    Calendar
} from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';
import TodoModal from '@/components/todo/TodoModal';
import TodoDetailModal from '@/components/todo/TodoDetailModal';
import './TodoPage.css';

// Hardcoded entity ID for now - in production this should come from user context or API
const DEFAULT_ENTITY_ID = '00000000-0000-0000-0000-000000000001';

export default function TodoPage() {
    const { user } = useAuth();
    const [todos, setTodos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('open');
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [selectedTodo, setSelectedTodo] = useState(null);
    const [notification, setNotification] = useState(null);

    const fetchTodos = async () => {
        try {
            setLoading(true);
            const status = filter === 'all' ? undefined : (filter === 'done' ? 'done' : 'open');
            const response = await todoApi.list({ status });
            setTodos(response.items);
        } catch (error) {
            console.error('Failed to fetch todos:', error);
            showNotification('获取任务列表失败', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTodos();
    }, [filter]);

    const showNotification = (message, type = 'success') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 3000);
    };

    const handleCreateTodo = async (formData) => {
        try {
            // Add required fields
            const todoData = {
                ...formData,
                our_entity_id: DEFAULT_ENTITY_ID,
                assignee_user_id: user.id,
            };
            await todoApi.create(todoData);
            showNotification('任务创建成功');
            fetchTodos();
        } catch (error) {
            console.error('Failed to create todo:', error);
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
        } catch (error) {
            console.error('Failed to update todo:', error);
            throw new Error('更新任务失败，请重试');
        }
    };

    const handleMarkDone = async (id) => {
        try {
            await todoApi.markDone(id);
            showNotification('任务已完成');
            if (detailModalOpen) {
                setDetailModalOpen(false);
                setSelectedTodo(null);
            }
            fetchTodos();
        } catch (error) {
            console.error('Failed to mark done:', error);
            showNotification('操作失败，请重试', 'error');
        }
    };

    const handleBlock = async (id, reason) => {
        try {
            await todoApi.block(id, reason);
            showNotification('任务已阻塞');
            if (detailModalOpen) {
                setDetailModalOpen(false);
                setSelectedTodo(null);
            }
            fetchTodos();
        } catch (error) {
            console.error('Failed to block todo:', error);
            showNotification('操作失败，请重试', 'error');
        }
    };

    const handleDismiss = async (id, reason) => {
        try {
            await todoApi.dismiss(id, reason);
            showNotification('任务已忽略');
            if (detailModalOpen) {
                setDetailModalOpen(false);
                setSelectedTodo(null);
            }
            fetchTodos();
        } catch (error) {
            console.error('Failed to dismiss todo:', error);
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

    return (
        <div className="todo-container">
            {notification && (
                <div className={clsx('notification', `notification-${notification.type}`)}>
                    {notification.message}
                </div>
            )}

            <div className="todo-header">
                <h1>我的任务</h1>
                <button className="create-todo-btn" onClick={() => setCreateModalOpen(true)}>
                    <Plus size={18} /> 新建任务
                </button>
            </div>

            <div className="todo-filters">
                <button
                    className={clsx("filter-btn", { active: filter === 'open' })}
                    onClick={() => setFilter('open')}
                >
                    未完成
                </button>
                <button
                    className={clsx("filter-btn", { active: filter === 'done' })}
                    onClick={() => setFilter('done')}
                >
                    已完成
                </button>
                <button
                    className={clsx("filter-btn", { active: filter === 'all' })}
                    onClick={() => setFilter('all')}
                >
                    全部
                </button>
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
                                className={clsx("todo-item", { done: todo.status === 'done' })}
                                onClick={() => handleTodoClick(todo)}
                            >
                                <div
                                    className={clsx("todo-checkbox", { checked: todo.status === 'done' })}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (todo.status !== 'done') {
                                            handleMarkDone(todo.id);
                                        }
                                    }}
                                >
                                    {todo.status === 'done' && <Check size={16} />}
                                </div>

                                <div className="todo-content">
                                    <div className="todo-title">{todo.title}</div>
                                    <div className="todo-meta">
                                        <span className={clsx("priority-badge", `priority-${todo.priority}`)}>
                                            {todo.priority}
                                        </span>
                                        {todo.due_at && (
                                            <span className="meta-tag">
                                                <Calendar size={12} />
                                                {format(new Date(todo.due_at), 'MMM d, HH:mm')}
                                            </span>
                                        )}
                                        <span className="meta-tag">
                                            #{todo.source_type}
                                        </span>
                                    </div>
                                </div>

                                <div className="todo-actions" onClick={(e) => e.stopPropagation()}>
                                    <button
                                        className="icon-btn"
                                        onClick={() => handleTodoClick(todo)}
                                    >
                                        <MoreVertical size={16} />
                                    </button>
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
            />

            <TodoModal
                isOpen={editModalOpen}
                onClose={() => {
                    setEditModalOpen(false);
                    setSelectedTodo(null);
                }}
                onSubmit={handleEditTodo}
                initialData={selectedTodo}
                mode="edit"
            />

            <TodoDetailModal
                isOpen={detailModalOpen}
                onClose={() => {
                    setDetailModalOpen(false);
                    setSelectedTodo(null);
                }}
                todo={selectedTodo}
                onEdit={handleEditClick}
                onMarkDone={handleMarkDone}
                onBlock={handleBlock}
                onDismiss={handleDismiss}
            />
        </div>
    );
}

