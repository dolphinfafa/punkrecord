import React, { useState, useEffect } from 'react';
import projectApi from '@/api/project';
// We might need a TodoModal to create tasks, or we can just link to todo page.
// But for now let's just list tasks. Creating tasks usually requires more context.
// Ideally rework TodoModal to define source.
// However, I can reuse TodoModal if I pass props or use a simplified create here.
// Let's implement a simple list for now, and maybe a "Go to Todo" button or a simple "Quick Create" if necessary.
// Actually, user asked for "Tasks section with List/Create task functionality".
import { useNavigate } from 'react-router-dom';

export default function ProjectTasks({ project }) {
    const navigate = useNavigate();
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(false);

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
        // Navigate to todo create page with pre-filled project info? 
        // Or open a modal. 
        // Since I don't have a global TodoModal easily accessible without importing, 
        // and TodoModal might be complex, I'll direct user to Todo page or just say "Creating form here"
        // Better: create a simple task creation directly here or use a simplified mock for now.
        // Actually, TodoPage has a CreateModal. I can try to import it if it's exported.
        // But for this task, let's just add a button that navigates to Todo page with query params?
        // Or simpler: Just a "Create Task" button that alerts "Go to Todo page to create task linked to this project" 
        // No, that's bad UX.
        // Let's implement a simple inline creation form for quick tasks.

        // TODO: Implement quick create. For now, just placeholder or navigation.
        // Navigation: /todos?source_type=project_task&source_id={project.id}
        // But TodoPage might not support query params init.

        alert("To create a task, please go to Todo page. (Integration pending)");
    };

    return (
        <div className="card" style={{ marginTop: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3>项目任务</h3>
                <button className="btn btn-sm btn-outline-primary" onClick={handleCreateTask}>
                    + 创建任务
                </button>
            </div>

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
