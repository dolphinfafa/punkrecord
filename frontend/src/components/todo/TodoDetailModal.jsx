import { X, Calendar, User, Clock, Tag } from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';
import './TodoDetailModal.css';

export default function TodoDetailModal({ isOpen, onClose, todo, onEdit, onMarkDone, onBlock, onDismiss }) {
    if (!isOpen || !todo) return null;

    const getPriorityLabel = (priority) => {
        const labels = {
            p0: 'P0 - 紧急',
            p1: 'P1 - 高',
            p2: 'P2 - 中',
            p3: 'P3 - 低'
        };
        return labels[priority] || priority;
    };

    const getStatusLabel = (status) => {
        const labels = {
            open: '未开始',
            in_progress: '进行中',
            blocked: '已阻塞',
            done: '已完成',
            dismissed: '已忽略'
        };
        return labels[status] || status;
    };

    const getActionTypeLabel = (actionType) => {
        const labels = {
            do: '执行',
            approve: '审批',
            review: '审阅',
            ack: '确认'
        };
        return labels[actionType] || actionType;
    };

    const handleBlock = () => {
        const reason = prompt('请输入阻塞原因:');
        if (reason) {
            onBlock(todo.id, reason);
        }
    };

    const handleDismiss = () => {
        const reason = prompt('请输入忽略原因:');
        if (reason) {
            onDismiss(todo.id, reason);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="detail-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>任务详情</h2>
                    <button className="modal-close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="detail-modal-body">
                    <div className="detail-section">
                        <h3 className="detail-title">{todo.title}</h3>
                        <div className="detail-badges">
                            <span className={clsx('status-badge', `status-${todo.status}`)}>
                                {getStatusLabel(todo.status)}
                            </span>
                            <span className={clsx('priority-badge', `priority-${todo.priority}`)}>
                                {getPriorityLabel(todo.priority)}
                            </span>
                            <span className="action-badge">
                                {getActionTypeLabel(todo.action_type)}
                            </span>
                        </div>
                    </div>

                    {todo.description && (
                        <div className="detail-section">
                            <h4>描述</h4>
                            <p className="detail-description">{todo.description}</p>
                        </div>
                    )}

                    <div className="detail-section">
                        <h4>时间信息</h4>
                        <div className="detail-info-grid">
                            {todo.start_at && (
                                <div className="info-item">
                                    <Clock size={16} />
                                    <div>
                                        <div className="info-label">开始时间</div>
                                        <div className="info-value">{format(new Date(todo.start_at), 'yyyy-MM-dd HH:mm')}</div>
                                    </div>
                                </div>
                            )}
                            {todo.due_at && (
                                <div className="info-item">
                                    <Calendar size={16} />
                                    <div>
                                        <div className="info-label">截止时间</div>
                                        <div className="info-value">{format(new Date(todo.due_at), 'yyyy-MM-dd HH:mm')}</div>
                                    </div>
                                </div>
                            )}
                            {todo.done_at && (
                                <div className="info-item">
                                    <Clock size={16} />
                                    <div>
                                        <div className="info-label">完成时间</div>
                                        <div className="info-value">{format(new Date(todo.done_at), 'yyyy-MM-dd HH:mm')}</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="detail-section">
                        <h4>其他信息</h4>
                        <div className="detail-info-grid">
                            <div className="info-item">
                                <Tag size={16} />
                                <div>
                                    <div className="info-label">来源类型</div>
                                    <div className="info-value">#{todo.source_type}</div>
                                </div>
                            </div>
                            <div className="info-item">
                                <Clock size={16} />
                                <div>
                                    <div className="info-label">创建时间</div>
                                    <div className="info-value">{format(new Date(todo.created_at), 'yyyy-MM-dd HH:mm')}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {todo.blocked_reason && (
                        <div className="detail-section">
                            <h4>阻塞原因</h4>
                            <p className="detail-reason">{todo.blocked_reason}</p>
                        </div>
                    )}

                    {todo.dismiss_reason && (
                        <div className="detail-section">
                            <h4>忽略原因</h4>
                            <p className="detail-reason">{todo.dismiss_reason}</p>
                        </div>
                    )}
                </div>

                <div className="detail-modal-footer">
                    {todo.status !== 'done' && todo.status !== 'dismissed' && (
                        <>
                            <button onClick={() => onEdit(todo)} className="btn-secondary">
                                编辑
                            </button>
                            {todo.status !== 'done' && (
                                <button onClick={() => onMarkDone(todo.id)} className="btn-success">
                                    标记完成
                                </button>
                            )}
                            {todo.status !== 'blocked' && (
                                <button onClick={handleBlock} className="btn-warning">
                                    阻塞
                                </button>
                            )}
                            <button onClick={handleDismiss} className="btn-danger">
                                忽略
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
