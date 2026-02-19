import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { todoApi } from '@/api/todo';
import { useAuth } from '@/contexts/AuthContext';
import {
    LayoutDashboard, CheckSquare, Clock, AlertCircle, Plus,
    TrendingUp, Activity, ArrowRight
} from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';
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

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                // Fetch user's todos
                const res = await todoApi.list({ page_size: 100 }); // Fetch enough to calculate stats
                const todos = res.data?.items || [];

                // Calculate Stats
                const newStats = {
                    open: todos.filter(t => t.status === 'open').length,
                    in_progress: todos.filter(t => t.status === 'in_progress').length,
                    pending_review: todos.filter(t => t.status === 'pending_review').length,
                    done: todos.filter(t => t.status === 'done').length,
                    total: todos.length
                };
                setStats(newStats);

                // Get Recent Activity (Sort by updated_at desc)
                const sorted = [...todos].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
                setRecentActivity(sorted.slice(0, 5));

            } catch (error) {
                console.error("Failed to fetch dashboard data", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const handleCreateTodo = async (formData) => {
        try {
            await todoApi.create(formData);
            // Refresh data
            window.location.reload();
        } catch (error) {
            console.error("Failed to create task", error);
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
                                <div key={todo.id} className="activity-item" onClick={() => navigate('/todo')}>
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

                {/* 
                <div className="section-card quick-access">
                    <div className="section-header">
                        <h3>快捷入口</h3>
                    </div>
                    <div className="quick-links">
                        <button className="quick-link-item">
                            <span className="icon">📄</span>
                            <span>创建合同</span>
                        </button>
                        <button className="quick-link-item">
                            <span className="icon">💰</span>
                            <span>报销申请</span>
                        </button>
                         <button className="quick-link-item">
                            <span className="icon">👥</span>
                            <span>团队成员</span>
                        </button>
                    </div>
                </div>
                */}
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
