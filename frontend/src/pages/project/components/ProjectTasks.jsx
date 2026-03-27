import React, { useState, useEffect } from 'react';
import projectApi from '@/api/project';
import { todoApi } from '@/api/todo';
import TodoModal from '@/components/todo/TodoModal';
import { RefreshCw, Plus } from 'lucide-react';

const STATUS_LABELS = {
    open: '待开始', in_progress: '进行中', blocked: '阻塞',
    pending_review: '待验收', done: '已完成', dismissed: '已忽略'
};
const STATUS_COLORS = {
    open: { bg: '#eff6ff', color: '#3b82f6' },
    in_progress: { bg: '#fffbeb', color: '#d97706' },
    blocked: { bg: '#fef2f2', color: '#dc2626' },
    pending_review: { bg: '#faf5ff', color: '#7c3aed' },
    done: { bg: '#f0fdf4', color: '#16a34a' },
    dismissed: { bg: '#f8fafc', color: '#94a3b8' },
};
const PRIORITY_LABELS = { p0: '🔴 P0', p1: '🟠 P1', p2: '🟡 P2', p3: '🟢 P3' };
const DEV_TYPE_LABELS = { dev_backend: '后端', dev_frontend: '前端', dev_ui: 'UI', dev_product: '产品' };

export default function ProjectTasks({ project }) {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showTaskModal, setShowTaskModal] = useState(false);

    useEffect(() => { loadTasks(); }, [project.id]);

    const loadTasks = async () => {
        try {
            setLoading(true);
            const res = await projectApi.getProjectTodos(project.id);
            setTasks(res.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmitTask = async (data) => {
        await todoApi.create({ ...data, source_type: 'project_task', source_id: project.id });
        loadTasks();
    };

    const getDevType = (task) => {
        const tag = (task.tags || [])[0];
        return DEV_TYPE_LABELS[tag] || null;
    };

    return (
        <div className="card" style={{ marginTop: '1.5rem', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    项目任务
                    {tasks.length > 0 && (
                        <span style={{ fontSize: '0.75rem', padding: '0.1rem 0.5rem', borderRadius: '10px', background: '#e0f2fe', color: '#0369a1', fontWeight: '600' }}>
                            {tasks.length}
                        </span>
                    )}
                </h3>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                        onClick={loadTasks}
                        style={{ border: '1px solid #e2e8f0', background: 'white', borderRadius: '6px', padding: '0.35rem 0.6rem', cursor: 'pointer', color: '#64748b' }}
                    >
                        <RefreshCw size={13} />
                    </button>
                    <button
                        onClick={() => setShowTaskModal(true)}
                        style={{ border: '1px solid #e2e8f0', background: '#0f172a', borderRadius: '6px', padding: '0.35rem 0.75rem', cursor: 'pointer', color: 'white', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                    >
                        <Plus size={13} /> 创建任务
                    </button>
                </div>
            </div>

            <TodoModal
                isOpen={showTaskModal}
                onClose={() => setShowTaskModal(false)}
                onSubmit={handleSubmitTask}
                mode="create"
                fixedProjectId={project.id}
            />

            {loading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.85rem' }}>
                    <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', display: 'block', margin: '0 auto 0.5rem' }} />
                    加载中...
                </div>
            ) : tasks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.85rem' }}>
                    暂无任务，请进入“开发进度”页面自动从功能清单生成
                </div>
            ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                        <tr style={{ background: '#f8fafc' }}>
                            {['任务标题', '类型', '优先级', '状态', '负责人', '截止日期'].map(h => (
                                <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: '#64748b', fontWeight: '600', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {tasks.map(t => {
                            const sc = STATUS_COLORS[t.status] || { bg: '#f8fafc', color: '#64748b' };
                            return (
                                <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '0.55rem 0.75rem', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        <span title={t.title}>{t.title}</span>
                                    </td>
                                    <td style={{ padding: '0.55rem 0.75rem' }}>
                                        {getDevType(t) ? (
                                            <span style={{ fontSize: '0.72rem', padding: '0.1rem 0.45rem', borderRadius: '4px', background: '#ede9fe', color: '#6d28d9', fontWeight: '600' }}>
                                                {getDevType(t)}
                                            </span>
                                        ) : '-'}
                                    </td>
                                    <td style={{ padding: '0.55rem 0.75rem' }}>
                                        <span style={{ fontSize: '0.75rem' }}>{PRIORITY_LABELS[t.priority] || t.priority || '-'}</span>
                                    </td>
                                    <td style={{ padding: '0.55rem 0.75rem' }}>
                                        <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.55rem', borderRadius: '12px', background: sc.bg, color: sc.color, fontWeight: '600' }}>
                                            {STATUS_LABELS[t.status] || t.status}
                                        </span>
                                    </td>
                                    <td style={{ padding: '0.55rem 0.75rem', color: '#334155' }}>
                                        {t.assignee_name || <span style={{ color: '#cbd5e1' }}>未分配</span>}
                                    </td>
                                    <td style={{ padding: '0.55rem 0.75rem', color: '#64748b' }}>
                                        {t.due_at ? new Date(t.due_at).toLocaleDateString('zh-CN') : '-'}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
