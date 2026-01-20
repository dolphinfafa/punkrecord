import React from 'react';
import './DashboardPage.css';

export default function DashboardPage() {
    return (
        <div className="dashboard-container">
            <header className="page-header">
                <h1>Workbench</h1>
                <p>Welcome back to Atlas Enterprise System</p>
            </header>

            <div className="dashboard-grid">
                <div className="card stat-card">
                    <h3>My Todos</h3>
                    <div className="stat-value">12</div>
                    <div className="stat-label">Pending Tasks</div>
                </div>

                <div className="card stat-card">
                    <h3>Pending Approvals</h3>
                    <div className="stat-value">3</div>
                    <div className="stat-label">Requires Action</div>
                </div>

                <div className="card stat-card">
                    <h3>Active Projects</h3>
                    <div className="stat-value">5</div>
                    <div className="stat-label">In Progress</div>
                </div>

                <div className="card recent-activity">
                    <h3>Recent Activity</h3>
                    <div className="activity-list">
                        <div className="activity-item">
                            <span className="time">10:30 AM</span>
                            <span className="desc">Logged in to system</span>
                        </div>
                        <div className="activity-item">
                            <span className="time">Yesterday</span>
                            <span className="desc">Created new contract CON-2026-001</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
