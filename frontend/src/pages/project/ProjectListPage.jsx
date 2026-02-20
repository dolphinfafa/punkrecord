import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import projectApi from '@/api/project';
import ProjectCreateModal from './components/ProjectCreateModal';

export default function ProjectListPage() {
    const navigate = useNavigate();
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);

    useEffect(() => {
        loadProjects();
    }, []);

    const loadProjects = async () => {
        try {
            setLoading(true);
            const response = await projectApi.listProjects();
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

    const handleDelete = async (e, projectId) => {
        e.stopPropagation();
        if (!window.confirm('确定要删除该项目吗？此操作不可恢复。')) return;

        try {
            await projectApi.deleteProject(projectId);
            loadProjects(); // Refresh list
        } catch (err) {
            alert(err.message || '删除失败');
        }
    };

    if (loading) return <div className="page-content"><div className="loading">加载中...</div></div>;
    if (error) return <div className="page-content"><div className="error">错误: {error}</div></div>;

    return (
        <div className="page-content">
            <div className="toolbar">
                <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>创建项目</button>
            </div>

            {showCreateModal && (
                <ProjectCreateModal
                    onClose={() => setShowCreateModal(false)}
                    onSuccess={() => {
                        loadProjects();
                        setShowCreateModal(false);
                    }}
                />
            )}

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
                                        <button
                                            className="btn-link text-danger"
                                            onClick={(e) => handleDelete(e, project.id)}
                                            style={{ marginLeft: '0.5rem' }}
                                        >
                                            删除
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
