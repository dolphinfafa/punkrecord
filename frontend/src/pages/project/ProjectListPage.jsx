import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import projectApi from '@/api/project';
import ProjectCreateModal from './components/ProjectCreateModal';
import { Briefcase, User, Calendar, Trash2, FolderPlus } from 'lucide-react';
import './ProjectListPage.css';

export default function ProjectListPage() {
    const navigate = useNavigate();
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [activeTab, setActiveTab] = useState('b2b');

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

    const b2bProjects = projects.filter(p => p.project_type === 'b2b');
    const b2cProjects = projects.filter(p => p.project_type === 'b2c');

    const displayedProjects = activeTab === 'b2b' ? b2bProjects : b2cProjects;

    const getStatusText = (status) => {
        const map = {
            draft: '草稿',
            active: '进行中',
            paused: '已暂停',
            closed: '已关闭',
            cancelled: '已取消'
        };
        return map[status] || status;
    };

    return (
        <div className="project-list-container">
            <div className="project-header">
                <div>
                    <h1>项目管理</h1>
                    <p style={{ color: '#718096', marginTop: '0.5rem', fontSize: '0.95rem' }}>
                        管理您的所有业务项目，追踪进度与团队情况
                    </p>
                </div>
                <div className="create-btn-wrapper">
                    <button className="btn btn-primary" onClick={() => setShowCreateModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.6rem 1.25rem', borderRadius: '8px', fontWeight: '600' }}>
                        <FolderPlus size={18} /> 创建项目
                    </button>
                </div>
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

            <div className="project-tabs">
                <button
                    className={`tab-btn ${activeTab === 'b2b' ? 'active' : ''}`}
                    onClick={() => setActiveTab('b2b')}
                >
                    ToB 项目 <span className="tab-count">{b2bProjects.length}</span>
                </button>
                <button
                    className={`tab-btn ${activeTab === 'b2c' ? 'active' : ''}`}
                    onClick={() => setActiveTab('b2c')}
                >
                    ToC 项目 <span className="tab-count">{b2cProjects.length}</span>
                </button>
            </div>

            {displayedProjects.length === 0 ? (
                <div className="empty-state">
                    <Briefcase size={48} color="#cbd5e0" style={{ margin: '0 auto' }} />
                    <h3>当前分类下没有项目</h3>
                    <p>点击右上角的“创建项目”按钮来添加一个新的 {activeTab === 'b2b' ? 'ToB' : 'ToC'} 项目。</p>
                </div>
            ) : (
                <div className="project-grid">
                    {displayedProjects.map(project => {
                        // Backend progress field is usually 0.0 to 1.0, map to 0-100%
                        // If it's missing, default to 0
                        const progressPercent = Math.round((project.progress || 0) * 100);
                        const isComplete = project.status === 'closed' || project.status === 'done';

                        return (
                            <div
                                key={project.id}
                                className="project-card"
                                onClick={() => handleProjectClick(project.id)}
                            >
                                <div>
                                    <div className="card-header">
                                        <span className="project-no">{project.project_no}</span>
                                        <span className={`project-status status-${project.status}`}>
                                            {getStatusText(project.status)}
                                        </span>
                                    </div>

                                    <h3 className="project-title" title={project.name}>{project.name}</h3>

                                    <div className="project-meta">
                                        <div className="meta-item" title="项目经理">
                                            <User size={14} className="meta-icon" />
                                            <span>{project.pm_name || project.pm_user_id || '未分配'}</span>
                                        </div>
                                        {project.start_at && (
                                            <div className="meta-item" title="开始日期">
                                                <Calendar size={14} className="meta-icon" />
                                                <span>{project.start_at}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="project-progress-container">
                                    <div className="progress-header">
                                        <span>项目进度</span>
                                        <span style={{ color: isComplete ? '#38a169' : '#3182ce' }}>
                                            {progressPercent}%
                                        </span>
                                    </div>
                                    <div className="progress-bar-bg">
                                        <div
                                            className={`progress-bar-fill ${isComplete ? 'complete' : ''}`}
                                            style={{ width: `${progressPercent}%` }}
                                        />
                                    </div>
                                </div>

                                <div className="card-actions">
                                    <button
                                        className="btn-delete-icon"
                                        onClick={(e) => handleDelete(e, project.id)}
                                        title="删除项目"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
