import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Terminal,
    LayoutDashboard,
    Users,
    CheckSquare,
    FileText,
    Briefcase,
    CreditCard,
    LogOut,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import clsx from 'clsx';
import './Sidebar.css';

const MENU_ITEMS = [
    { path: '/', label: '工作台', icon: LayoutDashboard },
    { path: '/todo', label: '待办事项', icon: CheckSquare },
    { path: '/iam', label: '用户管理', icon: Users },
    { path: '/contract', label: '合同管理', icon: FileText },
    { path: '/project', label: '项目管理', icon: Briefcase },
    { path: '/finance', label: '财务管理', icon: CreditCard },
];

export default function Sidebar() {
    const { logout, user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [collapsed, setCollapsed] = useState(false);

    const handleNavigation = (path) => {
        navigate(path);
    };

    return (
        <div className={clsx("sidebar", { collapsed })}>
            <div className="sidebar-header">
                <div className="logo-container">
                    <Terminal className="logo-icon" />
                    {!collapsed && <span className="logo-text">Atlas</span>}
                </div>
            </div>

            <nav className="sidebar-nav">
                {MENU_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path ||
                        (item.path !== '/' && location.pathname.startsWith(item.path));

                    return (
                        <button
                            key={item.path}
                            onClick={() => handleNavigation(item.path)}
                            className={clsx("nav-item", { active: isActive })}
                            title={collapsed ? item.label : ''}
                        >
                            <Icon className="nav-icon" />
                            {!collapsed && <span className="nav-label">{item.label}</span>}
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
