import React from 'react';
import './DashboardPage.css';

export default function DashboardPage() {
    return (
        <div className="dashboard-container">
            <header className="page-header">
                <h1>工作台</h1>
                <p>欢迎回到 Atlas 企业管理系统</p>
            </header>

            <div className="dashboard-grid">
                <div className="card stat-card">
                    <h3>我的待办</h3>
                    <div className="stat-value">12</div>
                    <div className="stat-label">待处理任务</div>
                </div>

                <div className="card stat-card">
                    <h3>待审批</h3>
                    <div className="stat-value">3</div>
                    <div className="stat-label">需要处理</div>
                </div>

                <div className="card stat-card">
                    <h3>进行中项目</h3>
                    <div className="stat-value">5</div>
                    <div className="stat-label">进行中</div>
                </div>

                <div className="card recent-activity">
                    <h3>最近活动</h3>
                    <div className="activity-list">
                        <div className="activity-item">
                            <span className="time">10:30 AM</span>
                            <span className="desc">登录系统</span>
                        </div>
                        <div className="activity-item">
                            <span className="time">昨天</span>
                            <span className="desc">创建新合同 CON-2026-001</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
