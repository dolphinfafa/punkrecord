import { useMemo } from 'react';
import { X } from 'lucide-react';
import BugImagePreview from './BugImagePreview';
import './BugDetailModal.css';

const KNOWN_LINK_KEYS = new Set([
    'type',
    'stage_code',
    'tester_user_id',
    'developer_user_id',
    'reviewer_user_id',
    'actual_result',
    'expected_result',
    'reproduce_steps',
    'bug_image',
    'bug_images',
    'project_id',
    'project_name',
    'tracking_todo_id',
]);

function formatDateTime(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('zh-CN', { hour12: false });
}

function getBugImages(bug) {
    const list = bug?.link?.bug_images;
    if (Array.isArray(list) && list.length > 0) return list;
    if (bug?.link?.bug_image) return [bug.link.bug_image];
    return [];
}

function normalizeValue(value) {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'object') {
        try {
            return JSON.stringify(value, null, 2);
        } catch {
            return String(value);
        }
    }
    return String(value);
}

export default function BugDetailModal({
    isOpen,
    onClose,
    bug,
    project,
    members = [],
    statusLabels = {},
    priorityLabels = {},
}) {
    const memberName = (userId) => {
        if (!userId) return '—';
        const hit = members.find((m) => String(m.user_id) === String(userId));
        return hit?.user_name || String(userId);
    };

    const images = useMemo(() => getBugImages(bug), [bug]);
    const extraLinkFields = useMemo(() => {
        const link = bug?.link || {};
        return Object.entries(link)
            .filter(([key, value]) => !KNOWN_LINK_KEYS.has(key) && value !== null && value !== undefined && value !== '')
            .sort((a, b) => a[0].localeCompare(b[0], 'zh-CN'));
    }, [bug]);

    if (!isOpen || !bug) return null;

    return (
        <div className="bug-detail-overlay" onClick={onClose}>
            <div className="bug-detail-modal" onClick={(e) => e.stopPropagation()}>
                <div className="bug-detail-header">
                    <div>
                        <p>Bug 详情</p>
                        <h3>{bug.title}</h3>
                    </div>
                    <div className="bug-detail-header-right">
                        <span>{statusLabels[bug.status] || bug.status}</span>
                        <span>{priorityLabels[(bug.priority || 'p2').toLowerCase()] || String(bug.priority || 'p2').toUpperCase()}</span>
                        <button type="button" onClick={onClose}><X size={16} /></button>
                    </div>
                </div>

                <div className="bug-detail-body">
                    <section className="bug-detail-grid">
                        {[
                            ['开发人员', bug.assignee_name || memberName(bug?.link?.developer_user_id)],
                            ['测试员', memberName(bug?.link?.tester_user_id)],
                            ['审核人', memberName(bug?.link?.reviewer_user_id)],
                            ['创建人', bug.creator_name || '—'],
                            ['状态', statusLabels[bug.status] || bug.status],
                            ['优先级', priorityLabels[(bug.priority || 'p2').toLowerCase()] || String(bug.priority || 'p2').toUpperCase()],
                            ['开始时间', formatDateTime(bug.start_at)],
                            ['截止时间', formatDateTime(bug.due_at)],
                            ['完成时间', formatDateTime(bug.done_at)],
                            ['创建时间', formatDateTime(bug.created_at)],
                            ['更新时间', formatDateTime(bug.updated_at)],
                            ['项目', bug?.link?.project_name || project?.name || '—'],
                            ['阶段', bug?.link?.stage_code || 'testing'],
                            ['任务ID', bug.id],
                        ].map(([label, value]) => (
                            <div key={label} className="bug-detail-card">
                                <div>{label}</div>
                                <strong>{value || '—'}</strong>
                            </div>
                        ))}
                    </section>

                    <section className="bug-detail-two-col">
                        <div className="bug-detail-block">
                            <h4>问题备注</h4>
                            <pre>{normalizeValue(bug.description)}</pre>
                        </div>
                        <div className="bug-detail-block">
                            <h4>实际结果</h4>
                            <pre>{normalizeValue(bug?.link?.actual_result)}</pre>
                        </div>
                        <div className="bug-detail-block">
                            <h4>期望结果</h4>
                            <pre>{normalizeValue(bug?.link?.expected_result)}</pre>
                        </div>
                        <div className="bug-detail-block">
                            <h4>复现步骤</h4>
                            <pre>{normalizeValue(bug?.link?.reproduce_steps)}</pre>
                        </div>
                    </section>

                    {(bug.blocked_reason || bug.review_comment || bug.dismiss_reason) && (
                        <section className="bug-detail-two-col">
                            {bug.blocked_reason && (
                                <div className="bug-detail-block">
                                    <h4>阻塞原因</h4>
                                    <pre>{bug.blocked_reason}</pre>
                                </div>
                            )}
                            {bug.review_comment && (
                                <div className="bug-detail-block">
                                    <h4>审核备注</h4>
                                    <pre>{bug.review_comment}</pre>
                                </div>
                            )}
                            {bug.dismiss_reason && (
                                <div className="bug-detail-block">
                                    <h4>忽略原因</h4>
                                    <pre>{bug.dismiss_reason}</pre>
                                </div>
                            )}
                        </section>
                    )}

                    <section className="bug-detail-block">
                        <h4>标签</h4>
                        <pre>{Array.isArray(bug.tags) && bug.tags.length > 0 ? bug.tags.join(', ') : '—'}</pre>
                    </section>

                    {extraLinkFields.length > 0 && (
                        <section className="bug-detail-block">
                            <h4>扩展字段</h4>
                            <div className="bug-detail-extra-grid">
                                {extraLinkFields.map(([key, value]) => (
                                    <div key={key} className="bug-detail-extra-item">
                                        <div>{key}</div>
                                        <pre>{normalizeValue(value)}</pre>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    <section className="bug-detail-block">
                        <h4>Bug 图片（{images.length}）</h4>
                        {images.length > 0 ? (
                            <div className="bug-detail-images">
                                {images.map((img, idx) => (
                                    <BugImagePreview key={`${img.attachment_id || idx}`} projectId={project?.id} bugImage={img} />
                                ))}
                            </div>
                        ) : (
                            <pre>—</pre>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
}
