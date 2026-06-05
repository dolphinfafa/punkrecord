import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { todoApi } from '@/api/todo';
import {
    Terminal,
    LayoutDashboard,
    Users,
    CheckSquare,
    FileText,
    Briefcase,
    CreditCard,
    Brain,
    Mic,
    MessageSquare,
    LogOut,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import clsx from 'clsx';
import './Sidebar.css';

const MENU_ITEMS = [
    { path: '/', label: '工作台', icon: LayoutDashboard, permission: null },
    { path: '/todo', label: '待办事项', icon: CheckSquare, permission: 'todo.read' },
    { path: '/iam', label: '用户管理', icon: Users, permission: 'iam.read' },
    { path: '/contract', label: '合同管理', icon: FileText, permission: 'contract.read' },
    { path: '/project', label: '项目管理', icon: Briefcase, permission: 'project.read' },
    { path: '/finance', label: '财务管理', icon: CreditCard, permission: 'finance.read' },
    { path: '/kb', label: '企业大脑', icon: Brain, permission: 'kb.read' },
    { path: '/meeting', label: '会议记录', icon: Mic, permission: 'meeting.read' },
    { path: '/wechat-notify', label: '微信通知', icon: MessageSquare, permission: null },
];

export default function Sidebar() {
    const { logout, user, hasPermission } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [collapsed, setCollapsed] = useState(false);
    const [todoCounts, setTodoCounts] = useState({ my_active: 0, team_pending_review: 0 });

    const canReadTodo = hasPermission('todo.read');

    const fetchTodoCounts = useCallback(async () => {
        if (!canReadTodo) return;
        try {
            const res = await todoApi.badgeCounts();
            const data = res?.data || {};
            setTodoCounts({
                my_active: data.my_active || 0,
                team_pending_review: data.team_pending_review || 0,
            });
        } catch {
            // Badge counts are non-critical; ignore errors silently
        }
    }, [canReadTodo]);

    // Fetch on mount + on route change, and poll periodically so the badges
    // reflect task activity without a full page reload.
    useEffect(() => {
        fetchTodoCounts();
    }, [fetchTodoCounts, location.pathname]);

    useEffect(() => {
        if (!canReadTodo) return;
        const timer = setInterval(fetchTodoCounts, 45000);
        return () => clearInterval(timer);
    }, [fetchTodoCounts, canReadTodo]);

    const handleNavigation = (path) => {
        navigate(path);
    };

    const visibleItems = MENU_ITEMS.filter(
        (item) => !item.permission || hasPermission(item.permission)
    );

    return (
        <div className={clsx("sidebar", { collapsed })}>
            <div className="sidebar-header">
                <div className="logo-container">
                    <Terminal className="logo-icon" />
                    {!collapsed && <span className="logo-text">PunkRecord</span>}
                </div>
            </div>

            <nav className="sidebar-nav">
                {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path ||
                        (item.path !== '/' && location.pathname.startsWith(item.path));

                    const isTodo = item.path === '/todo';
                    const myCount = todoCounts.my_active;
                    const reviewCount = todoCounts.team_pending_review;
                    const totalCount = myCount + reviewCount;

                    return (
                        <button
                            key={item.path}
                            onClick={() => handleNavigation(item.path)}
                            className={clsx("nav-item", { active: isActive })}
                            title={collapsed ? item.label : ''}
                        >
                            <Icon className="nav-icon" />
                            {!collapsed && <span className="nav-label">{item.label}</span>}
                            {isTodo && !collapsed && totalCount > 0 && (
                                <span className="nav-badges">
                                    {myCount > 0 && (
                                        <span
                                            className="nav-badge nav-badge-my"
                                            title={`我的任务：未开始/进行中 ${myCount}`}
                                        >
                                            {myCount}
                                        </span>
                                    )}
                                    {reviewCount > 0 && (
                                        <span
                                            className="nav-badge nav-badge-review"
                                            title={`团队任务：待我审核 ${reviewCount}`}
                                        >
                                            {reviewCount}
                                        </span>
                                    )}
                                </span>
                            )}
                            {isTodo && collapsed && totalCount > 0 && (
                                <span className="nav-badge-dot" title={`待办 ${totalCount}`} />
                            )}
                        </button>
                    );
                })}
            </nav>

            <div className="sidebar-footer">
                <button className="collapse-btn" onClick={() => setCollapsed(!collapsed)}>
                    {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                </button>

                <div className="user-section">
                    <div className="user-info">
                        <div className="avatar">{user?.name?.[0]?.toUpperCase()}</div>
                        {!collapsed && (
                            <div className="user-details">
                                <span className="user-name">{user?.name}</span>
                                <button onClick={logout} className="logout-btn">
                                    <LogOut size={14} /> <span>退出登录</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
