import React from 'react';
import { Outlet } from 'react-router-dom';
import '@/pages/finance/FinanceLayout.css';

export default function ProjectLayout() {
    return (
        <div className="finance-layout">
            <div className="finance-header">
                <h1>Project Management</h1>
            </div>
            <div className="finance-content">
                <Outlet />
            </div>
        </div>
    );
}
