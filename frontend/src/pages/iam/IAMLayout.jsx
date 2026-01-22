import React from 'react';
import { Outlet, Navigate, useLocation, NavLink } from 'react-router-dom';
import '@/pages/finance/FinanceLayout.css'; // Reuse styles

export default function IAMLayout() {
    const location = useLocation();

    if (location.pathname === '/iam' || location.pathname === '/iam/') {
        return <Navigate to="/iam/users" replace />;
    }

    return (
        <div className="finance-layout">
            <div className="finance-header">
                <h1>IAM & Users</h1>
                <nav className="finance-nav">
                    <NavLink
                        to="/iam/users"
                        className={({ isActive }) => isActive ? 'active' : ''}
                    >
                        Users
                    </NavLink>
                    <NavLink
                        to="/iam/entities"
                        className={({ isActive }) => isActive ? 'active' : ''}
                    >
                        Our Entities
                    </NavLink>
                </nav>
            </div>
            <div className="finance-content">
                <Outlet />
            </div>
        </div>
    );
}
