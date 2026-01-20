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
    { path: '/', label: 'Workbench', icon: LayoutDashboard },
    { path: '/todo', label: 'Todo', icon: CheckSquare },
    { path: '/iam', label: 'IAM / Users', icon: Users },
    { path: '/contract', label: 'Contracts', icon: FileText },
    { path: '/project', label: 'Projects', icon: Briefcase },
    { path: '/finance', label: 'Finance', icon: CreditCard },
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
                                    <LogOut size={14} /> <span>Sign out</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
