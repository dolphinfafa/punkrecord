import React from 'react';
import { Outlet, Navigate, useLocation, NavLink } from 'react-router-dom';
import '@/pages/finance/FinanceLayout.css';

export default function IAMLayout() {
    const location = useLocation();

    if (location.pathname === '/iam' || location.pathname === '/iam/') {
        return <Navigate to="/iam/users" replace />;
    }

    return (
        <div className="finance-layout">
            <div className="finance-header">
                <h1>人员管理</h1>
                <nav className="finance-nav">
                    <NavLink to="/iam/users" className={({ isActive }) => isActive ? 'active' : ''}>
                        员工管理
                    </NavLink>
                    <NavLink to="/iam/departments" className={({ isActive }) => isActive ? 'active' : ''}>
                        部门管理
                    </NavLink>
                    <NavLink to="/iam/job-titles" className={({ isActive }) => isActive ? 'active' : ''}>
                        职位管理
                    </NavLink>
                    <NavLink to="/iam/org-chart" className={({ isActive }) => isActive ? 'active' : ''}>
                        组织架构图
                    </NavLink>
                </nav>
            </div>
            <div className="finance-content">
                <Outlet />
            </div>
        </div>
    );
}
