import React, { useState, useEffect } from 'react';
import projectApi from '@/api/project';
import { todoApi } from '@/api/todo';
import TodoModal from '@/components/todo/TodoModal';
import { useNavigate } from 'react-router-dom';

export default function ProjectTasks({ project }) {
    const navigate = useNavigate();
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showTaskModal, setShowTaskModal] = useState(false);

    useEffect(() => {
        loadTasks();
    }, [project.id]);

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

    const handleCreateTask = () => {
        setShowTaskModal(true);
    };

    const handleSubmitTask = async (data) => {
        // Override source type and id for project task
        const payload = {
            ...data,
            source_type: 'project_task',
            source_id: project.id
        };
        await todoApi.create(payload);
        loadTasks(); // reload the task list
    };

    return (
        <div className="card" style={{ marginTop: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3>项目任务</h3>
                <button className="btn btn-sm btn-outline-primary" onClick={handleCreateTask}>
                    + 创建任务
                </button>
            </div>

            <TodoModal
                isOpen={showTaskModal}
                onClose={() => setShowTaskModal(false)}
                onSubmit={handleSubmitTask}
                mode="create"
            />

            <div className="tasks-list">
                {loading ? (
                    <div>加载中...</div>
                ) : tasks.length === 0 ? (
                    <p className="text-muted">暂无任务</p>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>标题</th>
                                <th>状态</th>
                                <th>负责人</th>
                                <th>截止日期</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tasks.map(t => (
                                <tr key={t.id}>
                                    <td>{t.title}</td>
                                    <td><span className={`status-badge ${t.status}`}>{t.status}</span></td>
                                    <td>{t.assignee_name || '-'}</td>
                                    <td>{t.due_at ? new Date(t.due_at).toLocaleDateString() : '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
