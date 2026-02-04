import React from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { NavLink } from 'react-router-dom';
import './FinanceLayout.css';

export default function FinanceLayout() {
    const location = useLocation();

    if (location.pathname === '/finance' || location.pathname === '/finance/') {
        return <Navigate to="/finance/accounts" replace />;
    }

    return (
        <div className="finance-layout">
            <div className="finance-header">
                <h1>财务管理</h1>
                <nav className="finance-nav">
                    <NavLink
                        to="/finance/accounts"
                        className={({ isActive }) => isActive ? 'active' : ''}
                    >
                        账户列表
                    </NavLink>
                    <NavLink
                        to="/finance/transactions"
                        className={({ isActive }) => isActive ? 'active' : ''}
                    >
                        交易明细
                    </NavLink>
                </nav>
            </div>
            <div className="finance-content">
                <Outlet />
            </div>
        </div>
    );
}
