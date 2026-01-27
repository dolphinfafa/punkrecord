import { useState, useEffect } from 'react';
import { todoApi } from '@/api/todo';
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
import './TodoPage.css';

export default function TodoPage() {
    const [todos, setTodos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('open'); // open, done, all

    const fetchTodos = async () => {
        try {
            setLoading(true);
            const status = filter === 'all' ? undefined : (filter === 'done' ? 'done' : 'open');
            const response = await todoApi.list({ status });
            setTodos(response.items);
        } catch (error) {
            console.error('Failed to fetch todos:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTodos();
    }, [filter]);

    const handleMarkDone = async (id, e) => {
        e.stopPropagation();
        try {
            await todoApi.markDone(id);
            fetchTodos();
        } catch (error) {
            console.error('Failed to mark done:', error);
        }
    };

    return (
        <div className="todo-container">
            <div className="todo-header">
                <h1>我的任务</h1>
                <button className="create-todo-btn">
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
                            <div key={todo.id} className={clsx("todo-item", { done: todo.status === 'done' })}>
                                <div
                                    className={clsx("todo-checkbox", { checked: todo.status === 'done' })}
                                    onClick={(e) => todo.status !== 'done' && handleMarkDone(todo.id, e)}
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

                                <div className="todo-actions">
                                    <button className="icon-btn">
                                        <MoreVertical size={16} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
