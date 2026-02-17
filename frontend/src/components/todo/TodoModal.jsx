import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';
import './TodoModal.css';

export default function TodoModal({ isOpen, onClose, onSubmit, initialData = null, mode = 'create' }) {
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        priority: 'p2',
        due_at: '',
        start_at: '',
        source_type: 'custom',
        source_id: '',
        action_type: 'do',
        our_entity_id: '',
        assignee_user_id: ''
    });
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (initialData) {
            setFormData({
                title: initialData.title || '',
                description: initialData.description || '',
                priority: initialData.priority || 'p2',
                due_at: initialData.due_at ? new Date(initialData.due_at).toISOString().slice(0, 16) : '',
                start_at: initialData.start_at ? new Date(initialData.start_at).toISOString().slice(0, 16) : '',
                source_type: initialData.source_type || 'custom',
                source_id: initialData.source_id || '',
                action_type: initialData.action_type || 'do',
                our_entity_id: initialData.our_entity_id || '',
                assignee_user_id: initialData.assignee_user_id || ''
            });
        } else {
            // Reset form for create mode
            setFormData({
                title: '',
                description: '',
                priority: 'p2',
                due_at: '',
                start_at: '',
                source_type: 'custom',
                source_id: Date.now().toString(),
                action_type: 'do',
                our_entity_id: '',
                assignee_user_id: ''
            });
        }
        setErrors({});
    }, [initialData, isOpen]);

    const validate = () => {
        const newErrors = {};
        if (!formData.title.trim()) {
            newErrors.title = '标题不能为空';
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;

        setLoading(true);
        try {
            const submitData = {
                ...formData,
                due_at: formData.due_at ? new Date(formData.due_at).toISOString() : null,
                start_at: formData.start_at ? new Date(formData.start_at).toISOString() : null
            };
            await onSubmit(submitData);
            onClose();
        } catch (error) {
            console.error('Failed to submit todo:', error);
            setErrors({ submit: error.message || '提交失败，请重试' });
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: null }));
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{mode === 'create' ? '新建任务' : '编辑任务'}</h2>
                    <button className="modal-close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
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
                            rows={4}
                        />
                    </div>

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
                            <label htmlFor="action_type">操作类型</label>
                            <select
                                id="action_type"
                                value={formData.action_type}
                                onChange={(e) => handleChange('action_type', e.target.value)}
                                disabled={mode === 'edit'}
                            >
                                <option value="do">执行</option>
                                <option value="approve">审批</option>
                                <option value="review">审阅</option>
                                <option value="ack">确认</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="start_at">开始时间</label>
                            <input
                                id="start_at"
                                type="datetime-local"
                                value={formData.start_at}
                                onChange={(e) => handleChange('start_at', e.target.value)}
                            />
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
                        <button type="button" onClick={onClose} className="btn-secondary" disabled={loading}>
                            取消
                        </button>
                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? '提交中...' : mode === 'create' ? '创建' : '保存'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
