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
                <h1>Contract Management</h1>
                <nav className="finance-nav">
                    <NavLink
                        to="/contract/list"
                        className={({ isActive }) => isActive ? 'active' : ''}
                    >
                        Contracts
                    </NavLink>
                    <NavLink
                        to="/contract/counterparties"
                        className={({ isActive }) => isActive ? 'active' : ''}
                    >
                        Counterparties
                    </NavLink>
                </nav>
            </div>
            <div className="finance-content">
                <Outlet />
            </div>
        </div>
    );
}
