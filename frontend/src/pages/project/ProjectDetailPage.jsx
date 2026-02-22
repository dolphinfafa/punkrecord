import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import projectApi from '@/api/project';
import ProjectEditModal from './components/ProjectEditModal';
import ProjectTeam from './components/ProjectTeam';
import ProjectTasks from './components/ProjectTasks';
import FeatureListModal from './components/FeatureListModal';
import QuoteModal from './components/QuoteModal';
import {
    Briefcase, FileText, Activity, Layers,
    Calendar, CheckCircle, Clock, Users, ArrowLeft, Trash2, Edit, List
} from 'lucide-react';

export default function ProjectDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [project, setProject] = useState(null);
    const [stages, setStages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [featureListStage, setFeatureListStage] = useState(null);
    const [quoteStage, setQuoteStage] = useState(null);

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

    const handleDelete = async () => {
        if (!window.confirm('确定要删除该项目吗？此操作不可恢复。')) return;
        try {
            await projectApi.deleteProject(id);
            navigate('/project');
        } catch (err) {
            alert(err.message || '删除失败');
        }
    };

    const handleUpdateStage = async (stageId, field, value) => {
        try {
            // Optimistic update
            setStages(prev => prev.map(s => s.id === stageId ? { ...s, [field]: value } : s));
            await projectApi.updateProjectStage(id, stageId, { [field]: value });
        } catch (err) {
            alert(err.message || '更新阶段失败');
            loadData(); // revert on failure
        }
    };

    if (loading) return <div className="page-content"><div className="loading">加载中...</div></div>;
    if (error) return <div className="page-content"><div className="error">错误: {error}</div></div>;
    if (!project) return <div className="page-content"><div className="error">未找到项目</div></div>;

    return (
        <div className="page-content">
            <div className="toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <button className="btn btn-secondary" onClick={() => navigate('/project')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <ArrowLeft size={16} /> 返回列表
                </button>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="btn btn-primary" onClick={() => setShowEditModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Edit size={16} /> 编辑项目
                    </button>
                    <button className="btn btn-danger" onClick={handleDelete} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Trash2 size={16} /> 删除项目
                    </button>
                </div>
            </div>

            {showEditModal && (
                <ProjectEditModal
                    project={project}
                    onClose={() => setShowEditModal(false)}
                    onSuccess={() => {
                        loadData();
                        setShowEditModal(false);
                    }}
                />
            )}

            <div className="detail-container" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
                <div className="main-info">
                    <div className="card" style={{ padding: '2rem', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', border: '1px solid #eee' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid #eee', paddingBottom: '1rem' }}>
                            <div style={{ padding: '12px', backgroundColor: '#f0f7ff', borderRadius: '8px', color: '#0066ff' }}>
                                <Briefcase size={28} />
                            </div>
                            <h2 style={{ margin: 0, fontSize: '1.8rem', color: '#1a1a1a' }}>{project.name}</h2>
                        </div>

                        <div className="info-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                            <div className="info-item">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#666', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                                    <FileText size={14} /> 项目编号
                                </label>
                                <div style={{ fontWeight: '500', color: '#333' }}>{project.project_no}</div>
                            </div>
                            <div className="info-item">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#666', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                                    <Activity size={14} /> 状态
                                </label>
                                <div><span className={`status-badge ${project.status}`}>{project.status}</span></div>
                            </div>
                            <div className="info-item">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#666', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                                    <Layers size={14} /> 类型
                                </label>
                                <div style={{ fontWeight: '500', color: '#333' }}>{project.project_type === 'b2b' ? 'B2B (企业端)' : 'B2C (消费端)'}</div>
                            </div>
                            <div className="info-item">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#666', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                                    <Clock size={14} /> 进度
                                </label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <div style={{ flex: 1, height: '8px', backgroundColor: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                                        <div style={{ width: `${(project.progress || 0) * 100}%`, height: '100%', backgroundColor: '#0066ff', transition: 'width 0.3s ease' }}></div>
                                    </div>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#0066ff' }}>{project.progress ? `${(project.progress * 100).toFixed(0)}%` : '0%'}</span>
                                </div>
                            </div>
                            <div className="info-item">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#666', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                                    <Calendar size={14} /> 开始日期
                                </label>
                                <div style={{ color: '#333' }}>{project.start_at || <span className="text-muted">未设定</span>}</div>
                            </div>
                            <div className="info-item">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#666', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                                    <CheckCircle size={14} /> 截止日期
                                </label>
                                <div style={{ color: '#333' }}>{project.due_at || <span className="text-muted">未设定</span>}</div>
                            </div>
                        </div>

                        {project.description && (
                            <div className="description" style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '8px', borderLeft: '4px solid #0066ff' }}>
                                <label style={{ color: '#666', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>项目描述</label>
                                <p style={{ margin: 0, color: '#333', lineHeight: '1.6' }}>{project.description}</p>
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
                                            <th>备注/交付物</th>
                                            <th>操作</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stages.map((stage, index) => {
                                            const prevStage = index > 0 ? stages[index - 1] : null;
                                            const isEditable = index === 0 || (prevStage && (prevStage.status === 'done' || prevStage.status === 'skipped'));

                                            return (
                                                <tr key={stage.id}>
                                                    <td>{stage.sequence_no}</td>
                                                    <td>{stage.stage_name}</td>
                                                    <td>
                                                        <select
                                                            value={stage.status}
                                                            onChange={(e) => handleUpdateStage(stage.id, 'status', e.target.value)}
                                                            disabled={!isEditable}
                                                            style={{
                                                                padding: '4px 8px',
                                                                borderRadius: '4px',
                                                                border: '1px solid #e2e8f0',
                                                                fontSize: '0.875rem',
                                                                backgroundColor: !isEditable ? '#f1f5f9' : 'white',
                                                                color: !isEditable ? '#94a3b8' : 'inherit'
                                                            }}
                                                        >
                                                            <option value="not_started">未开始</option>
                                                            <option value="in_progress">进行中</option>
                                                            <option value="done">已完成</option>
                                                            <option value="blocked">已阻塞</option>
                                                            <option value="skipped">已跳过</option>
                                                        </select>
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="date"
                                                            value={stage.planned_end_at || ''}
                                                            onChange={(e) => handleUpdateStage(stage.id, 'planned_end_at', e.target.value)}
                                                            style={{
                                                                padding: '4px 8px',
                                                                border: '1px solid #e2e8f0',
                                                                borderRadius: '4px',
                                                                width: '130px'
                                                            }}
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="text"
                                                            value={stage.deliverables || ''}
                                                            placeholder="备注或交付物链接..."
                                                            onChange={(e) => setStages(prev => prev.map(s => s.id === stage.id ? { ...s, deliverables: e.target.value } : s))}
                                                            onBlur={(e) => handleUpdateStage(stage.id, 'deliverables', e.target.value)}
                                                            style={{
                                                                width: '100%',
                                                                padding: '4px 8px',
                                                                border: 'none',
                                                                borderBottom: '1px dashed #cbd5e1',
                                                                backgroundColor: 'transparent',
                                                                outline: 'none'
                                                            }}
                                                        />
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', gap: '10px' }}>
                                                            {project?.project_type?.toLowerCase() === 'b2b' && stage?.stage_code?.toLowerCase() === 'requirement_alignment' && (
                                                                <button
                                                                    className="btn-link text-success"
                                                                    onClick={() => setFeatureListStage({ ...stage, project_name: project.name })}
                                                                    style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                                                                >
                                                                    <List size={14} /> 功能清单
                                                                </button>
                                                            )}
                                                            {project?.project_type?.toLowerCase() === 'b2b' && stage?.stage_code?.toLowerCase() === 'quotation' && (
                                                                <button
                                                                    className="btn-link text-primary"
                                                                    onClick={() => setQuoteStage({ ...stage, project_name: project.name })}
                                                                    style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                                                                >
                                                                    <FileText size={14} /> 报价单
                                                                </button>
                                                            )}
                                                            {project?.project_type?.toLowerCase() !== 'b2b' && '-'}
                                                            {project?.project_type?.toLowerCase() === 'b2b' &&
                                                                stage?.stage_code?.toLowerCase() !== 'requirement_alignment' &&
                                                                stage?.stage_code?.toLowerCase() !== 'quotation' && '-'}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>

                    <ProjectTasks project={project} />
                </div>

                <div className="side-info">
                    <div className="card" style={{ padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', border: '1px solid #eee' }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, paddingBottom: '1rem', borderBottom: '1px solid #eee' }}>
                            <Users size={18} /> 负责人信息
                        </h3>
                        <div className="info-item" style={{ marginTop: '1rem' }}>
                            <label style={{ display: 'block', color: '#666', fontSize: '0.9rem', marginBottom: '0.5rem' }}>项目经理</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '500', color: '#1a1a1a', padding: '0.5rem', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#0066ff', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', fontWeight: 'bold' }}>
                                    {project.pm_name ? project.pm_name.charAt(0).toUpperCase() : '?'}
                                </div>
                                {project.pm_name || '未分配'}
                            </div>
                        </div>
                    </div>

                    <ProjectTeam project={project} />
                </div>
            </div>

            {featureListStage && (
                <FeatureListModal
                    isOpen={!!featureListStage}
                    stage={featureListStage}
                    onClose={() => setFeatureListStage(null)}
                    onSave={async (data) => {
                        await projectApi.updateProjectStage(project.id, featureListStage.id, data);
                        setFeatureListStage(null);
                        loadData();
                    }}
                />
            )}

            {quoteStage && (
                <QuoteModal
                    isOpen={!!quoteStage}
                    stage={quoteStage}
                    projectId={project.id}
                    allStages={stages}
                    onClose={() => setQuoteStage(null)}
                    onSave={async () => {
                        loadData();
                    }}
                />
            )}
        </div >
    );
}
