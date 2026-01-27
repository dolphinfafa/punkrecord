import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import projectApi from '@/api/project';

export default function ProjectListPage() {
    const navigate = useNavigate();
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadProjects();
    }, []);

    const loadProjects = async () => {
        try {
            setLoading(true);
            const response = await projectApi.listProjects();
            // Should adjust based on actual API response format (items usually inside data)
            setProjects(response.data?.items || []);
            setError(null);
        } catch (err) {
            setError(err.message || '加载项目失败');
            console.error('Error loading projects:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleProjectClick = (projectId) => {
        navigate(`/project/${projectId}`);
    };

    if (loading) return <div className="page-content"><div className="loading">加载中...</div></div>;
    if (error) return <div className="page-content"><div className="error">错误: {error}</div></div>;

    return (
        <div className="page-content">
            <div className="toolbar">
                <button className="btn btn-primary">创建项目</button>
            </div>

            <div className="data-table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>项目编号</th>
                            <th>名称</th>
                            <th>类型</th>
                            <th>项目经理</th>
                            <th>开始日期</th>
                            <th>状态</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {projects.length === 0 ? (
                            <tr>
                                <td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>
                                    暂无项目。点击“创建项目”来创建一个。
                                </td>
                            </tr>
                        ) : (
                            projects.map(project => (
                                <tr key={project.id} onClick={() => handleProjectClick(project.id)} style={{ cursor: 'pointer' }}>
                                    <td>{project.project_no}</td>
                                    <td>{project.name}</td>
                                    <td><span className="badge">{project.project_type}</span></td>
                                    <td>{project.pm_name || project.pm_user_id}</td>
                                    <td>{project.start_at || '-'}</td>
                                    <td><span className={`status-badge ${project.status}`}>{project.status}</span></td>
                                    <td>
                                        <button
                                            className="btn-link"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleProjectClick(project.id);
                                            }}
                                        >
                                            查看
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
