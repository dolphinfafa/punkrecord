import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import projectApi from '@/api/project';

export default function ProjectDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [project, setProject] = useState(null);
    const [stages, setStages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (id) {
            loadData();
        }
    }, [id]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [projRes, stagesRes] = await Promise.all([
                projectApi.getProject(id),
                projectApi.getProjectStages(id)
            ]);

            setProject(projRes.data);
            setStages(stagesRes.data?.items || stagesRes.data || []);
            setError(null);
        } catch (err) {
            setError(err.message || '加载项目详情失败');
            console.error('Error loading project details:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="page-content"><div className="loading">加载中...</div></div>;
    if (error) return <div className="page-content"><div className="error">错误: {error}</div></div>;
    if (!project) return <div className="page-content"><div className="error">未找到项目</div></div>;

    return (
        <div className="page-content">
            <div className="toolbar">
                <button className="btn btn-secondary" onClick={() => navigate('/project')}>返回列表</button>
                <button className="btn btn-primary">编辑项目</button>
            </div>

            <div className="detail-container" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
                <div className="main-info">
                    <div className="card">
                        <h2>{project.name}</h2>
                        <div className="info-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginTop: '1rem' }}>
                            <div className="info-item">
                                <label>项目编号</label>
                                <div>{project.project_no}</div>
                            </div>
                            <div className="info-item">
                                <label>状态</label>
                                <div><span className={`status-badge ${project.status}`}>{project.status}</span></div>
                            </div>
                            <div className="info-item">
                                <label>类型</label>
                                <div>{project.project_type}</div>
                            </div>
                            <div className="info-item">
                                <label>进度</label>
                                <div>{project.progress ? `${(project.progress * 100).toFixed(0)}%` : '0%'}</div>
                            </div>
                            <div className="info-item">
                                <label>开始日期</label>
                                <div>{project.start_at || '-'}</div>
                            </div>
                            <div className="info-item">
                                <label>截止日期</label>
                                <div>{project.due_at || '-'}</div>
                            </div>
                        </div>

                        {project.description && (
                            <div className="description" style={{ marginTop: '2rem' }}>
                                <label>描述</label>
                                <p>{project.description}</p>
                            </div>
                        )}
                    </div>

                    <div className="card" style={{ marginTop: '2rem' }}>
                        <h3>阶段</h3>
                        <div className="stages-list" style={{ marginTop: '1rem' }}>
                            {stages.length === 0 ? (
                                <p>暂无阶段。</p>
                            ) : (
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>阶段</th>
                                            <th>状态</th>
                                            <th>计划结束日期</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stages.map(stage => (
                                            <tr key={stage.id}>
                                                <td>{stage.sequence_no}</td>
                                                <td>{stage.stage_name}</td>
                                                <td><span className={`status-badge ${stage.status}`}>{stage.status}</span></td>
                                                <td>{stage.planned_end_at || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>

                <div className="side-info">
                    {/* Placeholder for future sidebar info like Team Members or recent activity */}
                    <div className="card">
                        <h3>团队</h3>
                        <div className="info-item" style={{ marginTop: '1rem' }}>
                            <label>项目经理</label>
                            <div>{project.pm_name || '未分配'}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
