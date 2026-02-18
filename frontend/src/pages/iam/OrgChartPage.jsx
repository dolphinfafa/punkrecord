import React, { useState, useEffect } from 'react';
import { Crown, User, ChevronDown, ChevronRight } from 'lucide-react';
import iamApi from '@/api/iam';
import './IAMPage.css';

function OrgNode({ node, level = 0 }) {
    const [expanded, setExpanded] = useState(true);
    const hasChildren = node.children && node.children.length > 0;

    const initials = node.display_name.slice(0, 2);

    return (
        <div className="org-node-wrapper">
            <div className="org-node" style={{ marginLeft: `${level * 32}px` }}>
                {/* Connector line */}
                {level > 0 && <div className="org-connector" />}

                <div className={`org-card ${node.is_shareholder ? 'shareholder' : ''}`}>
                    <div className="org-avatar">
                        {node.is_shareholder && <Crown size={10} className="org-crown" />}
                        {initials}
                    </div>
                    <div className="org-info">
                        <div className="org-name">{node.display_name}</div>
                        {node.job_title_name && <div className="org-title">{node.job_title_name}</div>}
                        {node.department_name && <div className="org-dept">{node.department_name}</div>}
                    </div>
                    <span className="org-level-badge">L{node.level ?? 0}</span>
                    {hasChildren && (
                        <button className="org-expand-btn" onClick={() => setExpanded(!expanded)}>
                            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            <span>{node.children.length}</span>
                        </button>
                    )}
                </div>
            </div>

            {expanded && hasChildren && (
                <div className="org-children">
                    {node.children.map(child => (
                        <OrgNode key={child.id} node={child} level={level + 1} />
                    ))}
                </div>
            )}
        </div>
    );
}

export default function OrgChartPage() {
    const [chart, setChart] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const load = async () => {
            try {
                const res = await iamApi.getOrgChart();
                setChart(res.data || []);
            } catch {
                setError('加载组织架构失败');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    return (
        <div className="iam-page">
            <div className="iam-page-header">
                <h2>组织架构图</h2>
                <div className="org-legend">
                    <span className="legend-item shareholder">
                        <Crown size={12} /> 股东（最高级别）
                    </span>
                    <span className="legend-item">
                        <User size={12} /> 普通员工
                    </span>
                </div>
            </div>

            {loading ? (
                <div className="iam-loading">加载中...</div>
            ) : error ? (
                <div className="iam-empty" style={{ color: 'var(--error-color)' }}>{error}</div>
            ) : chart.length === 0 ? (
                <div className="iam-empty">暂无组织架构数据，请先在"员工管理"中设置上级关系</div>
            ) : (
                <div className="org-chart">
                    {chart.map(node => (
                        <OrgNode key={node.id} node={node} />
                    ))}
                </div>
            )}
        </div>
    );
}
