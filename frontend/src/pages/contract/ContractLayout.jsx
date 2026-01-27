import React from 'react';
import { Outlet, Navigate, useLocation, NavLink } from 'react-router-dom';
import '@/pages/finance/FinanceLayout.css'; // Reuse styles

export default function ContractLayout() {
    const location = useLocation();

    if (location.pathname === '/contract' || location.pathname === '/contract/') {
        return <Navigate to="/contract/list" replace />;
    }

    return (
        <div className="finance-layout">
            <div className="finance-header">
                <h1>合同管理</h1>
                <nav className="finance-nav">
                    <NavLink
                        to="/contract/list"
                        className={({ isActive }) => isActive ? 'active' : ''}
                    >
                        合同列表
                    </NavLink>
                    <NavLink
                        to="/contract/counterparties"
                        className={({ isActive }) => isActive ? 'active' : ''}
                    >
                        交易方管理
                    </NavLink>
                </nav>
            </div>
            <div className="finance-content">
                <Outlet />
            </div>
        </div>
    );
}
