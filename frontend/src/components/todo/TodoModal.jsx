import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';
import client from '@/api/client';
import './TodoModal.css';

export default function TodoModal({ isOpen, onClose, onSubmit, initialData = null, mode = 'create', currentUserId, fixedProjectId = null }) {
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        priority: 'p2',
        due_at: '',
        start_at: '',
        assignee_user_id: currentUserId || '',
        project_id: fixedProjectId || '',
        images: [],
    });
    const [allUsers, setAllUsers] = useState([]);
    const [projectMembers, setProjectMembers] = useState([]);
    const [projects, setProjects] = useState([]);
    const [fixedProjectName, setFixedProjectName] = useState('');
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    // Load user list and project list
    useEffect(() => {
        if (isOpen && mode === 'create') {
            client.get('/iam/users', { params: { page_size: 100 } })
                .then(res => setAllUsers(res.data?.items || []))
                .catch(() => { });
            if (fixedProjectId) {
                client.get(`/project/projects/${fixedProjectId}`)
                    .then(res => setFixedProjectName(res.data?.name || '当前项目'))
                    .catch(() => setFixedProjectName('当前项目'));
            } else {
                client.get('/project/projects', { params: { page_size: 200 } })
                    .then(res => setProjects(res.data?.items || []))
                    .catch(() => { });
            }
        }
    }, [isOpen, mode, fixedProjectId]);

    // Load project members when project changes
    useEffect(() => {
        const pid = formData.project_id;
        if (pid && isOpen) {
            client.get(`/project/projects/${pid}/members`)
                .then(res => setProjectMembers(res.data || []))
                .catch(() => setProjectMembers([]));
        } else {
            setProjectMembers([]);
        }
    }, [formData.project_id, isOpen]);

    // Compute which users to show in assignee dropdown
    const users = formData.project_id && projectMembers.length > 0
        ? allUsers.filter(u => projectMembers.some(m => m.user_id === u.id))
        : allUsers;

    useEffect(() => {
        if (initialData) {
            setFormData({
                title: initialData.title || '',
                description: initialData.description || '',
                priority: initialData.priority || 'p2',
                due_at: initialData.due_at ? new Date(initialData.due_at).toISOString().slice(0, 16) : '',
                start_at: initialData.start_at ? new Date(initialData.start_at).toISOString().slice(0, 16) : '',
                assignee_user_id: initialData.assignee_user_id || currentUserId || '',
                project_id: fixedProjectId || initialData?.link?.project_id || '',
                images: [],
            });
        } else {
            setFormData({
                title: '',
                description: '',
                priority: 'p2',
                due_at: '',
                start_at: '',
                assignee_user_id: currentUserId || '',
                project_id: fixedProjectId || '',
                images: [],
            });
        }
        setErrors({});
    }, [initialData, isOpen, currentUserId, fixedProjectId]);

    const validate = () => {
        const newErrors = {};
        if (!formData.title.trim()) newErrors.title = '标题不能为空';
        if (!formData.assignee_user_id) newErrors.assignee_user_id = '请选择被分配人';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;
        setLoading(true);
        try {
            const selectedProject = projects.find((item) => item.id === formData.project_id);
            const submitData = {
                title: formData.title,
                description: formData.description || null,
                assignee_user_id: formData.assignee_user_id,
                priority: formData.priority,
                due_at: formData.due_at ? new Date(formData.due_at).toISOString() : null,
                start_at: formData.start_at ? new Date(formData.start_at).toISOString() : null,
                source_type: formData.project_id ? 'project_task' : 'custom',
                source_id: formData.project_id || '',
                action_type: 'do',
                link: formData.project_id ? {
                    project_id: formData.project_id,
                    project_name: selectedProject?.name || '',
                } : undefined,
            };
            await onSubmit(submitData);
            onClose();
        } catch (error) {
            setErrors({ submit: error.message || '提交失败，请重试' });
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{mode === 'create' ? '新建任务' : '编辑任务'}</h2>
                    <button className="modal-close-btn" onClick={onClose}><X size={20} /></button>
                </div>

                <form onSubmit={handleSubmit} className="modal-body">
                    <div className="form-group">
                        <label htmlFor="title">标题 *</label>
                        <input
                            id="title"
                            type="text"
                            value={formData.title}
                            onChange={(e) => handleChange('title', e.target.value)}
                            className={clsx({ error: errors.title })}
                            placeholder="输入任务标题"
                        />
                        {errors.title && <span className="error-message">{errors.title}</span>}
                    </div>

                    <div className="form-group">
                        <label htmlFor="description">描述</label>
                        <textarea
                            id="description"
                            value={formData.description}
                            onChange={(e) => handleChange('description', e.target.value)}
                            placeholder="输入任务描述"
                            rows={3}
                        />
                    </div>

                    {mode === 'create' && (
                        <>
                            <div className="form-group">
                                <label htmlFor="assignee">分配给 *{formData.project_id && projectMembers.length > 0 ? '（仅项目成员）' : ''}</label>
                                <select
                                    id="assignee"
                                    value={formData.assignee_user_id}
                                    onChange={(e) => handleChange('assignee_user_id', e.target.value)}
                                    className={clsx({ error: errors.assignee_user_id })}
                                >
                                    <option value="">请选择被分配人</option>
                                    {users.map(u => (
                                        <option key={u.id} value={u.id}>
                                            {u.display_name}{u.id === currentUserId ? '（我）' : ''}
                                        </option>
                                    ))}
                                </select>
                                {errors.assignee_user_id && <span className="error-message">{errors.assignee_user_id}</span>}
                            </div>
                            <div className="form-group">
                                <label htmlFor="project_id">所属项目{fixedProjectId ? '' : '（可选）'}</label>
                                {fixedProjectId ? (
                                    <input type="text" value={fixedProjectName || '当前项目'} disabled />
                                ) : (
                                    <select
                                        id="project_id"
                                        value={formData.project_id}
                                        onChange={(e) => {
                                            handleChange('project_id', e.target.value);
                                            handleChange('assignee_user_id', currentUserId || '');
                                        }}
                                    >
                                        <option value="">不关联项目</option>
                                        {projects.map((project) => (
                                            <option key={project.id} value={project.id}>{project.name}</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                            <div className="form-group">
                                <label htmlFor="images">任务图片（可多选）</label>
                                <input
                                    id="images"
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={(e) => handleChange('images', Array.from(e.target.files || []))}
                                />
                                {formData.images?.length > 0 && (
                                    <span className="form-helper">已选择 {formData.images.length} 张图片</span>
                                )}
                            </div>
                        </>
                    )}

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="priority">优先级</label>
                            <select
                                id="priority"
                                value={formData.priority}
                                onChange={(e) => handleChange('priority', e.target.value)}
                            >
                                <option value="p0">P0 - 紧急</option>
                                <option value="p1">P1 - 高</option>
                                <option value="p2">P2 - 中</option>
                                <option value="p3">P3 - 低</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label htmlFor="due_at">截止时间</label>
                            <input
                                id="due_at"
                                type="datetime-local"
                                value={formData.due_at}
                                onChange={(e) => handleChange('due_at', e.target.value)}
                            />
                        </div>
                    </div>

                    {errors.submit && (
                        <div className="error-message submit-error">{errors.submit}</div>
                    )}

                    <div className="modal-footer">
                        <button type="button" onClick={onClose} className="btn-secondary" disabled={loading}>取消</button>
                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? '提交中...' : mode === 'create' ? '创建' : '保存'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
