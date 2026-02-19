import { useState } from 'react';
import { X, Calendar, Clock, Tag, User, CheckCircle, RotateCcw, AlertTriangle, Play } from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';
import './TodoDetailModal.css';

const PRIORITY_LABELS = { p0: 'P0 紧急', p1: 'P1 高', p2: 'P2 中', p3: 'P3 低' };
const STATUS_LABELS = {
    open: '未开始',
    in_progress: '进行中',
    blocked: '已阻塞',
    pending_review: '上报完成',
    done: '已完成',
    dismissed: '已忽略'
};
const ACTION_LABELS = { do: '执行', approve: '审批', review: '审阅', ack: '确认' };

export default function TodoDetailModal({
    isOpen, onClose, todo, onEdit, onStart, onSubmit, onApprove, onReject, onBlock, onDismiss,
    currentUserId, isManager
}) {
    const [rejectComment, setRejectComment] = useState('');
    const [showRejectInput, setShowRejectInput] = useState(false);

    if (!isOpen || !todo) return null;

    const isAssignee = todo.assignee_user_id === currentUserId;
    const canStart = isAssignee && todo.status === 'open';
    const canSubmit = isAssignee && ['open', 'in_progress', 'blocked'].includes(todo.status);
    const canApproveReject = isManager && todo.status === 'pending_review';
    const isFinished = ['done', 'dismissed'].includes(todo.status);

    const handleBlock = () => {
        const reason = prompt('请输入阻塞原因:');
        if (reason) onBlock(todo.id, reason);
    };

    const handleDismiss = () => {
        const reason = prompt('请输入忽略原因:');
        if (reason) onDismiss(todo.id, reason);
    };

    const handleReject = () => {
        if (!showRejectInput) {
            setShowRejectInput(true);
            return;
        }
        onReject(todo.id, rejectComment);
        setShowRejectInput(false);
        setRejectComment('');
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="detail-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>任务详情</h2>
                    <button className="modal-close-btn" onClick={onClose}><X size={20} /></button>
                </div>

                <div className="detail-modal-body">
                    {/* Title & badges */}
                    <div className="detail-section">
                        <h3 className="detail-title">{todo.title}</h3>
                        <div className="detail-badges">
                            <span className={clsx('status-badge', `status-${todo.status}`)}>
                                {STATUS_LABELS[todo.status] || todo.status}
                            </span>
                            <span className={clsx('priority-badge', `priority-${todo.priority}`)}>
                                {PRIORITY_LABELS[todo.priority] || todo.priority}
                            </span>
                            <span className="action-badge">{ACTION_LABELS[todo.action_type] || todo.action_type}</span>
                        </div>
                    </div>

                    {/* Description */}
                    {todo.description && (
                        <div className="detail-section">
                            <h4>描述</h4>
                            <p className="detail-description">{todo.description}</p>
                        </div>
                    )}

                    {/* People */}
                    <div className="detail-section">
                        <h4>人员</h4>
                        <div className="detail-info-grid">
                            <div className="info-item">
                                <User size={16} />
                                <div>
                                    <div className="info-label">负责人</div>
                                    <div className="info-value">{todo.assignee_name || '—'}</div>
                                </div>
                            </div>
                            <div className="info-item">
                                <User size={16} />
                                <div>
                                    <div className="info-label">创建人</div>
                                    <div className="info-value">{todo.creator_name || '—'}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Dates */}
                    <div className="detail-section">
                        <h4>时间</h4>
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
                                    <CheckCircle size={16} />
                                    <div>
                                        <div className="info-label">完成时间</div>
                                        <div className="info-value">{format(new Date(todo.done_at), 'yyyy-MM-dd HH:mm')}</div>
                                    </div>
                                </div>
                            )}
                            <div className="info-item">
                                <Tag size={16} />
                                <div>
                                    <div className="info-label">创建时间</div>
                                    <div className="info-value">{format(new Date(todo.created_at), 'yyyy-MM-dd HH:mm')}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Review comment (rejection feedback) */}
                    {todo.review_comment && (
                        <div className="detail-section review-comment-section">
                            <h4><AlertTriangle size={14} style={{ display: 'inline', marginRight: 4 }} />修改意见</h4>
                            <p className="detail-reason review-comment">{todo.review_comment}</p>
                        </div>
                    )}

                    {/* Blocked reason */}
                    {todo.blocked_reason && (
                        <div className="detail-section">
                            <h4>阻塞原因</h4>
                            <p className="detail-reason">{todo.blocked_reason}</p>
                        </div>
                    )}

                    {/* Pending review notice for assignee */}
                    {todo.status === 'pending_review' && isAssignee && (
                        <div className="detail-section pending-notice">
                            <Clock size={16} />
                            <span>已上报完成，等待上级审核</span>
                        </div>
                    )}

                    {/* Reject input */}
                    {showRejectInput && (
                        <div className="detail-section">
                            <h4>退回意见（必填）</h4>
                            <textarea
                                value={rejectComment}
                                onChange={e => setRejectComment(e.target.value)}
                                placeholder="请说明需要修改的内容..."
                                rows={3}
                                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-primary)', resize: 'vertical' }}
                            />
                        </div>
                    )}
                </div>

                <div className="detail-modal-footer">
                    {/* Employee actions */}
                    {canSubmit && (
                        <>
                            <button onClick={() => onEdit(todo)} className="btn-secondary">编辑</button>
                            {canStart && (
                                <button onClick={() => onStart(todo.id)} className="btn-primary">
                                    <Play size={14} /> 开始任务
                                </button>
                            )}
                            <button onClick={() => onSubmit(todo.id)} className="btn-success">
                                <CheckCircle size={14} /> 提交完成
                            </button>
                            {todo.status !== 'blocked' && (
                                <button onClick={handleBlock} className="btn-warning">阻塞</button>
                            )}
                            <button onClick={handleDismiss} className="btn-danger">忽略</button>
                        </>
                    )}

                    {/* Manager review actions */}
                    {canApproveReject && (
                        <>
                            <button onClick={() => onApprove(todo.id)} className="btn-success">
                                <CheckCircle size={14} /> 审核通过
                            </button>
                            <button
                                onClick={handleReject}
                                className="btn-warning"
                                disabled={showRejectInput && !rejectComment.trim()}
                            >
                                <RotateCcw size={14} /> {showRejectInput ? '确认退回' : '退回'}
                            </button>
                            {showRejectInput && (
                                <button onClick={() => { setShowRejectInput(false); setRejectComment(''); }} className="btn-secondary">
                                    取消
                                </button>
                            )}
                        </>
                    )}

                    {/* Finished state */}
                    {isFinished && (
                        <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                            {todo.status === 'done' ? '✅ 任务已完成' : '任务已忽略'}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
