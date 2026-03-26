import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Plus, RefreshCw, Bug, ExternalLink, Play, Send, RotateCcw, Trash2, FileText, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import projectApi from '@/api/project';
import { todoApi } from '@/api/todo';
import BugDetailModal from '@/components/common/BugDetailModal';

const STATUS_LABELS = {
    open: '待处理',
    in_progress: '处理中',
    pending_review: '待验收',
    done: '已修复',
    blocked: '阻塞',
    dismissed: '已忽略',
    ai_fixing: 'AI 修复中',
    ai_fixed: 'AI 已修复',
};

const PRIORITY_LABELS = {
    p0: 'P0',
    p1: 'P1',
    p2: 'P2',
    p3: 'P3',
};

const STATUS_COLORS = {
    open: { bg: '#eff6ff', color: '#1d4ed8' },
    in_progress: { bg: '#fffbeb', color: '#d97706' },
    pending_review: { bg: '#faf5ff', color: '#7c3aed' },
    done: { bg: '#f0fdf4', color: '#15803d' },
    blocked: { bg: '#fef2f2', color: '#dc2626' },
    dismissed: { bg: '#f8fafc', color: '#64748b' },
    ai_fixing: { bg: '#fdf4ff', color: '#a855f7' },
    ai_fixed: { bg: '#ecfdf5', color: '#059669' },
};

function normalizeMembers(project, members) {
    const list = members ? [...members] : [];
    if (project?.pm_user_id && !list.find((m) => m.user_id === project.pm_user_id)) {
        list.unshift({
            user_id: project.pm_user_id,
            user_name: project.pm_name || '项目经理',
            role_in_project: '项目经理',
        });
    }
    return list;
}

function roleText(member) {
    return String(member?.role_in_project || '').toLowerCase();
}

function isTesterMember(member) {
    const role = roleText(member);
    return role.includes('qa') || role.includes('test') || role.includes('测试');
}

function isDeveloperMember(member) {
    const role = roleText(member);
    return (
        role.includes('dev')
        || role.includes('developer')
        || role.includes('开发')
        || role.includes('前端')
        || role.includes('后端')
        || role.includes('ui')
    );
}

function isBugTodo(todo) {
    const tags = todo?.tags || [];
    const link = todo?.link || {};
    return tags.includes('bug') || link.type === 'bug';
}

function defaultBugForm(project, currentUserId, testerMembers, developerMembers) {
    const tester = currentUserId || testerMembers?.[0]?.user_id || '';
    const developer = developerMembers?.[0]?.user_id || project?.pm_user_id || '';
    return {
        title: '',
        description: '',
        tester_user_id: tester,
        developer_user_id: developer,
        priority: 'p1',
        due_at: project?.due_at || '',
        actual_result: '',
        expected_result: '',
        reproduce_steps: '',
        screenshot_files: [],
    };
}

function generateAgentDoc(project, members, user) {
    const baseUrl = window.location.origin;
    const memberList = members.map(m => `  - ${m.user_name} (user_id: ${m.user_id}, 角色: ${m.role_in_project || '成员'})`).join('\n');

    return `# Bug 修复 Agent 工作手册

## 项目信息
- 项目名称: ${project.name}
- 项目 ID: ${project.id}
- 当前操作人: ${user?.display_name || user?.username || '未知'} (user_id: ${user?.id || '未知'})

## 项目成员
${memberList}

## 认证方式
所有 API 请求需在 Header 中携带 Bearer Token:
\`\`\`
Authorization: Bearer <你的登录Token>
\`\`\`
获取 Token: POST ${baseUrl}/api/v1/auth/login
请求体: { "username": "<用户名>", "password": "<密码>" }
返回的 data.token 即为 Bearer Token。

## API 接口

### 1. 获取本项目的 Bug 列表
\`\`\`
GET ${baseUrl}/api/v1/project/projects/${project.id}/todos
\`\`\`
返回所有项目任务。筛选 Bug: 检查 tags 包含 "bug" 或 link.type === "bug"。
每条 Bug 的关键字段:
- id: Bug ID (用于后续操作)
- title: 标题
- status: 状态 (open/in_progress/ai_fixing/ai_fixed/pending_review/done)
- priority: 优先级 (p0/p1/p2/p3)
- assignee_user_id: 负责开发人员的 user_id
- assignee_name: 负责开发人员姓名
- description: 备注
- link.actual_result: 实际结果
- link.expected_result: 期望结果
- link.reproduce_steps: 复现步骤

### 2. 开始 AI 修复 (将 Bug 标记为 "AI 修复中")
\`\`\`
POST ${baseUrl}/api/v1/todo/{bug_id}/status
Content-Type: application/json

{ "status": "ai_fixing" }
\`\`\`
适用于状态为 open / in_progress / blocked 的 Bug。

### 3. 完成 AI 修复 (将 Bug 标记为 "AI 已修复")
\`\`\`
POST ${baseUrl}/api/v1/todo/{bug_id}/status
Content-Type: application/json

{ "status": "ai_fixed" }
\`\`\`
仅适用于状态为 ai_fixing 的 Bug。

### 4. 获取单个 Bug 详情
\`\`\`
GET ${baseUrl}/api/v1/todo/{bug_id}
\`\`\`

## 工作流程
1. 调用接口 1 获取 Bug 列表
2. 根据 assignee_user_id 筛选出当前操作人负责的 Bug
3. 操作人指定需要修复的 Bug 后，对每个 Bug 调用接口 2 标记为 "AI 修复中"
4. 完成代码修复后，调用接口 3 标记为 "AI 已修复"
5. 之后由测试人员人工验收

## 状态流转图
\`\`\`
open/in_progress/blocked --> ai_fixing --> ai_fixed --> (人工验收) --> done
\`\`\`
`;
}

export default function BugManagementModal({ isOpen, onClose, project }) {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [updatingId, setUpdatingId] = useState(null);
    const [todos, setTodos] = useState([]);
    const [members, setMembers] = useState([]);
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState(defaultBugForm(project, '', [], []));
    const [message, setMessage] = useState('');
    const [selectedBug, setSelectedBug] = useState(null);
    const [docExpanded, setDocExpanded] = useState(false);
    const [docCopied, setDocCopied] = useState(false);

    const bugList = useMemo(() => todos.filter(isBugTodo), [todos]);
    const testerMembers = useMemo(() => {
        const filtered = members.filter(isTesterMember);
        return filtered.length > 0 ? filtered : members;
    }, [members]);
    const developerMembers = useMemo(() => {
        const filtered = members.filter(isDeveloperMember);
        return filtered.length > 0 ? filtered : members;
    }, [members]);

    const agentDoc = useMemo(() => {
        if (!project) return '';
        return generateAgentDoc(project, members, user);
    }, [project, members, user]);

    const copyDoc = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(agentDoc);
            setDocCopied(true);
            setTimeout(() => setDocCopied(false), 2000);
        } catch {
            const ta = document.createElement('textarea');
            ta.value = agentDoc;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            setDocCopied(true);
            setTimeout(() => setDocCopied(false), 2000);
        }
    }, [agentDoc]);

    const loadData = async () => {
        if (!project?.id) return;
        try {
            setLoading(true);
            setMessage('');
            const [todoRes, memberRes] = await Promise.all([
                projectApi.getProjectTodos(project.id),
                projectApi.getProjectMembers(project.id),
            ]);
            const loadedTodos = todoRes.data || [];
            const loadedMembers = normalizeMembers(project, memberRes.data || []);
            setTodos(loadedTodos);
            setMembers(loadedMembers);
        } catch (err) {
            setMessage(err?.response?.data?.message || err?.message || '加载 Bug 列表失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!isOpen) return;
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, project?.id]);

    useEffect(() => {
        if (!isOpen) return;
        const currentUserId = user?.id || '';
        setShowCreate(false);
        setForm(defaultBugForm(project, currentUserId, testerMembers, developerMembers));
    }, [isOpen, project, user?.id, testerMembers, developerMembers]);

    if (!isOpen || !project) return null;

    const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

    const createBug = async () => {
        if (!form.title.trim()) {
            setMessage('Bug 标题不能为空');
            return;
        }
        if (!form.tester_user_id) {
            setMessage('请选择测试员');
            return;
        }
        if (!form.developer_user_id) {
            setMessage('请选择开发人员');
            return;
        }

        const currentUserId = String(user?.id || '');

        try {
            setSubmitting(true);
            setMessage('');
            const dueAt = form.due_at ? `${form.due_at}T18:00:00` : null;
            const bugImages = [];
            for (const file of (form.screenshot_files || [])) {
                const uploadRes = await projectApi.uploadProjectAttachment(project.id, file);
                const uploaded = uploadRes?.data;
                if (uploaded?.id) {
                    bugImages.push({
                        attachment_id: uploaded.id,
                        file_name: uploaded.file_name,
                        content_type: uploaded.content_type,
                        size: uploaded.size,
                    });
                }
            }
            const bugImage = bugImages[0] || null;
            await todoApi.create({
                our_entity_id: project.our_entity_id,
                assignee_user_id: form.developer_user_id,
                title: `[BUG] ${form.title.trim()}`,
                description: form.description?.trim() || null,
                source_type: 'project_task',
                source_id: project.id,
                action_type: 'do',
                priority: form.priority,
                due_at: dueAt,
                tags: ['bug', 'testing'],
                link: {
                    type: 'bug',
                    stage_code: 'testing',
                    tester_user_id: form.tester_user_id,
                    developer_user_id: form.developer_user_id,
                    reviewer_user_id: form.tester_user_id || currentUserId,
                    actual_result: form.actual_result?.trim() || '',
                    expected_result: form.expected_result?.trim() || '',
                    reproduce_steps: form.reproduce_steps?.trim() || '',
                    bug_image: bugImage,
                    bug_images: bugImages,
                    project_id: project.id,
                    project_name: project.name,
                },
            });

            setShowCreate(false);
            setForm(defaultBugForm(project, currentUserId, testerMembers, developerMembers));
            setMessage(`Bug 已创建${bugImages.length > 0 ? `（含 ${bugImages.length} 张配图）` : ''}`);
            await loadData();
        } catch (err) {
            setMessage(err?.response?.data?.message || err?.message || '创建 Bug 失败');
        } finally {
            setSubmitting(false);
        }
    };

    const patchBugPlan = async (todoId, payload, okText) => {
        try {
            setUpdatingId(todoId);
            setMessage('');
            await projectApi.updateProjectTodoPlan(project.id, todoId, payload);
            if (okText) setMessage(okText);
            await loadData();
        } catch (err) {
            setMessage(err?.response?.data?.message || err?.message || '更新失败');
        } finally {
            setUpdatingId(null);
        }
    };

    const flowAction = async (todoId, action) => {
        try {
            setUpdatingId(todoId);
            setMessage('');
            if (action === 'start') await todoApi.start(todoId);
            if (action === 'submit') await todoApi.submit(todoId);
            if (action === 'approve') await todoApi.approve(todoId);
            if (action === 'reopen') await todoApi.updateStatus(todoId, 'open', 'Bug reopened');
            await loadData();
        } catch (err) {
            setMessage(err?.response?.data?.message || err?.message || '状态更新失败');
        } finally {
            setUpdatingId(null);
        }
    };

    const deleteBug = async (todo) => {
        const ok = window.confirm(`确认删除该 Bug？\n\n${todo?.title || ''}`);
        if (!ok) return;
        try {
            setUpdatingId(todo.id);
            setMessage('');
            await projectApi.deleteProjectTodo(project.id, todo.id);
            setMessage('Bug 已删除');
            await loadData();
        } catch (err) {
            setMessage(err?.response?.data?.message || err?.message || '删除失败');
        } finally {
            setUpdatingId(null);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(2, 6, 23, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
        }}>
            <div style={{
                width: 'min(1200px, 100%)',
                maxHeight: '92vh',
                background: '#fff',
                borderRadius: '14px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
            }}>
                <div style={{
                    background: 'linear-gradient(130deg, #1e3a8a 0%, #2563eb 45%, #0ea5e9 100%)',
                    color: '#fff',
                    padding: '14px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '8px',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Bug size={18} />
                        <div>
                            <div style={{ fontWeight: 700 }}>测试阶段 Bug 管理</div>
                            <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>{project.name}</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            onClick={() => setDocExpanded((prev) => !prev)}
                            style={{ border: '1px solid rgba(255,255,255,0.35)', background: docExpanded ? 'rgba(255,255,255,0.15)' : 'transparent', color: '#fff', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', display: 'inline-flex', gap: '6px', alignItems: 'center' }}
                        >
                            <FileText size={14} /> Agent 文档 {docExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                        <button
                            onClick={loadData}
                            style={{ border: '1px solid rgba(255,255,255,0.35)', background: 'transparent', color: '#fff', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', display: 'inline-flex', gap: '6px', alignItems: 'center' }}
                        >
                            <RefreshCw size={14} /> 刷新
                        </button>
                        <button
                            onClick={() => navigate('/todo')}
                            style={{ border: 'none', background: '#111827', color: '#fff', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', display: 'inline-flex', gap: '6px', alignItems: 'center' }}
                        >
                            <ExternalLink size={14} /> 打开待办
                        </button>
                        <button
                            onClick={onClose}
                            style={{ border: '1px solid rgba(255,255,255,0.35)', background: 'transparent', color: '#fff', borderRadius: '8px', padding: '6px', cursor: 'pointer' }}
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {docExpanded && (
                    <div style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                        <div style={{ padding: '12px 16px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: '0.83rem', color: '#334155', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <FileText size={14} style={{ color: '#6366f1' }} />
                                Agent 工作手册
                                <span style={{ fontWeight: 400, color: '#64748b', fontSize: '0.78rem' }}>— 复制以下内容给你的 AI Agent</span>
                            </div>
                            <button
                                onClick={copyDoc}
                                style={{
                                    border: docCopied ? '1px solid #86efac' : '1px solid #c7d2fe',
                                    background: docCopied ? '#f0fdf4' : '#eef2ff',
                                    color: docCopied ? '#15803d' : '#4338ca',
                                    borderRadius: '8px',
                                    padding: '6px 12px',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    gap: '6px',
                                    alignItems: 'center',
                                    fontSize: '0.82rem',
                                    fontWeight: 600,
                                    transition: 'all 0.2s',
                                }}
                            >
                                {docCopied ? <><Check size={14} /> 已复制</> : <><Copy size={14} /> 一键复制</>}
                            </button>
                        </div>
                        <div style={{ padding: '0 16px 12px' }}>
                            <pre style={{
                                background: '#1e293b',
                                color: '#e2e8f0',
                                borderRadius: '10px',
                                padding: '14px 16px',
                                fontSize: '0.78rem',
                                lineHeight: '1.6',
                                maxHeight: '320px',
                                overflow: 'auto',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-all',
                                margin: 0,
                                fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
                            }}>
                                {agentDoc}
                            </pre>
                        </div>
                    </div>
                )}

                <div style={{ padding: '14px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '0.86rem', color: '#334155' }}>Bug 总数：<strong>{bugList.length}</strong></span>
                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>说明：这里的 Bug 与待办事项是同一条数据</span>
                    </div>
                    <button
                        onClick={() => setShowCreate((prev) => !prev)}
                        style={{ border: 'none', background: '#2563eb', color: '#fff', borderRadius: '8px', padding: '7px 12px', cursor: 'pointer', display: 'inline-flex', gap: '6px', alignItems: 'center' }}
                    >
                        <Plus size={14} /> {showCreate ? '收起新建' : '新建 Bug'}
                    </button>
                </div>

                {showCreate && (
                    <div style={{ padding: '14px 16px', borderBottom: '1px solid #e2e8f0', background: '#f8fbff' }}>
                        <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))' }}>
                            <label style={{ fontSize: '0.83rem', color: '#334155' }}>
                                Bug 标题
                                <input value={form.title} onChange={(e) => setField('title', e.target.value)} placeholder="例如：登录后白屏" style={{ width: '100%', marginTop: '5px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '8px' }} />
                            </label>
                            <label style={{ fontSize: '0.83rem', color: '#334155' }}>
                                测试员（创建人/审核人）
                                <select value={form.tester_user_id} onChange={(e) => setField('tester_user_id', e.target.value)} style={{ width: '100%', marginTop: '5px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '8px' }}>
                                    <option value="">请选择</option>
                                    {testerMembers.map((m) => (
                                        <option key={m.user_id} value={m.user_id}>{m.user_name}</option>
                                    ))}
                                </select>
                            </label>
                            <label style={{ fontSize: '0.83rem', color: '#334155' }}>
                                开发人员（待办接收人）
                                <select value={form.developer_user_id} onChange={(e) => setField('developer_user_id', e.target.value)} style={{ width: '100%', marginTop: '5px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '8px' }}>
                                    <option value="">请选择</option>
                                    {developerMembers.map((m) => (
                                        <option key={m.user_id} value={m.user_id}>{m.user_name}</option>
                                    ))}
                                </select>
                            </label>
                            <label style={{ fontSize: '0.83rem', color: '#334155' }}>
                                优先级
                                <select value={form.priority} onChange={(e) => setField('priority', e.target.value)} style={{ width: '100%', marginTop: '5px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '8px' }}>
                                    <option value="p0">P0</option>
                                    <option value="p1">P1</option>
                                    <option value="p2">P2</option>
                                    <option value="p3">P3</option>
                                </select>
                            </label>
                            <label style={{ fontSize: '0.83rem', color: '#334155' }}>
                                截止日期
                                <input type="date" value={form.due_at} onChange={(e) => setField('due_at', e.target.value)} style={{ width: '100%', marginTop: '5px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '8px' }} />
                            </label>
                        </div>
                        <div style={{ marginTop: '10px', display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
                            <label style={{ fontSize: '0.83rem', color: '#334155' }}>
                                实际结果
                                <textarea value={form.actual_result} onChange={(e) => setField('actual_result', e.target.value)} rows={2} style={{ width: '100%', marginTop: '5px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '8px' }} />
                            </label>
                            <label style={{ fontSize: '0.83rem', color: '#334155' }}>
                                期望结果
                                <textarea value={form.expected_result} onChange={(e) => setField('expected_result', e.target.value)} rows={2} style={{ width: '100%', marginTop: '5px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '8px' }} />
                            </label>
                        </div>
                        <label style={{ marginTop: '10px', display: 'block', fontSize: '0.83rem', color: '#334155' }}>
                            复现步骤 / 补充描述
                            <textarea value={form.reproduce_steps} onChange={(e) => setField('reproduce_steps', e.target.value)} rows={3} style={{ width: '100%', marginTop: '5px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '8px' }} />
                        </label>
                        <label style={{ marginTop: '10px', display: 'block', fontSize: '0.83rem', color: '#334155' }}>
                            配图（可选）
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={(e) => setField('screenshot_files', Array.from(e.target.files || []))}
                                style={{ width: '100%', marginTop: '5px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '8px', background: '#fff' }}
                            />
                            {(form.screenshot_files || []).length > 0 && (
                                <div style={{ marginTop: '4px', color: '#64748b', fontSize: '0.75rem' }}>
                                    已选择 {(form.screenshot_files || []).length} 张：
                                    {' '}
                                    {(form.screenshot_files || []).map((file) => file.name).join('、')}
                                </div>
                            )}
                        </label>
                        <label style={{ marginTop: '10px', display: 'block', fontSize: '0.83rem', color: '#334155' }}>
                            备注
                            <textarea value={form.description} onChange={(e) => setField('description', e.target.value)} rows={2} style={{ width: '100%', marginTop: '5px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '8px' }} />
                        </label>
                        <div style={{ marginTop: '10px' }}>
                            <button
                                onClick={createBug}
                                disabled={submitting}
                                style={{ border: 'none', background: '#111827', color: '#fff', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer' }}
                            >
                                {submitting ? '创建中...' : '确认创建并同步待办'}
                            </button>
                        </div>
                    </div>
                )}

                {message && (
                    <div style={{ margin: '10px 16px 0', border: '1px solid #bfdbfe', borderRadius: '8px', background: '#eff6ff', color: '#1e3a8a', padding: '8px 10px', fontSize: '0.82rem' }}>
                        {message}
                    </div>
                )}

                <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px 16px' }}>
                    {loading ? (
                        <div style={{ color: '#64748b', fontSize: '0.9rem', padding: '28px 0', textAlign: 'center' }}>加载中...</div>
                    ) : bugList.length === 0 ? (
                        <div style={{ color: '#64748b', fontSize: '0.9rem', padding: '28px 0', textAlign: 'center' }}>暂无 Bug，点击上方"新建 Bug"开始记录</div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
                            <thead>
                                <tr style={{ background: '#f8fafc' }}>
                                    {['标题', '状态', '优先级', '开发人员', '审核人', '截止日期', '待办联动'].map((h) => (
                                        <th key={h} style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '1px solid #e2e8f0', fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {bugList.map((todo) => {
                                    const statusStyle = STATUS_COLORS[todo.status] || STATUS_COLORS.open;
                                    return (
                                        <tr key={todo.id} style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }} onClick={() => setSelectedBug(todo)}>
                                            <td style={{ padding: '10px 8px', fontSize: '0.88rem', color: '#0f172a', maxWidth: '360px' }}>
                                                <div style={{ fontWeight: 600 }}>{todo.title}</div>
                                                {todo.description && <div style={{ marginTop: '4px', color: '#64748b', fontSize: '0.8rem' }}>{todo.description}</div>}
                                            </td>
                                            <td style={{ padding: '10px 8px' }} onClick={(e) => e.stopPropagation()}>
                                                <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '0.75rem', background: statusStyle.bg, color: statusStyle.color, fontWeight: 600 }}>
                                                    {STATUS_LABELS[todo.status] || todo.status}
                                                </span>
                                            </td>
                                            <td style={{ padding: '10px 8px' }} onClick={(e) => e.stopPropagation()}>
                                                <select
                                                    value={(todo.priority || 'p2').toLowerCase()}
                                                    disabled={updatingId === todo.id}
                                                    onChange={(e) => patchBugPlan(todo.id, { priority: e.target.value }, '优先级已更新')}
                                                    style={{ border: '1px solid #cbd5e1', borderRadius: '7px', padding: '5px 6px', fontSize: '0.8rem' }}
                                                >
                                                    {Object.keys(PRIORITY_LABELS).map((p) => (
                                                        <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td style={{ padding: '10px 8px' }} onClick={(e) => e.stopPropagation()}>
                                                <select
                                                    value={todo.assignee_user_id || ''}
                                                    disabled={updatingId === todo.id}
                                                    onChange={(e) => patchBugPlan(todo.id, { assignee_user_id: e.target.value }, '开发人员已更新')}
                                                    style={{ border: '1px solid #cbd5e1', borderRadius: '7px', padding: '5px 6px', fontSize: '0.8rem', minWidth: '120px' }}
                                                >
                                                    <option value="">未分配</option>
                                                    {developerMembers.map((m) => (
                                                        <option key={m.user_id} value={m.user_id}>{m.user_name}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td style={{ padding: '10px 8px', fontSize: '0.85rem', color: '#334155' }}>
                                                {todo.reviewer_name || '-'}
                                            </td>
                                            <td style={{ padding: '10px 8px' }} onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    type="date"
                                                    value={todo.due_at ? new Date(todo.due_at).toISOString().slice(0, 10) : ''}
                                                    disabled={updatingId === todo.id}
                                                    onChange={(e) => patchBugPlan(todo.id, { due_at: e.target.value ? `${e.target.value}T18:00:00` : null }, '截止日期已更新')}
                                                    style={{ border: '1px solid #cbd5e1', borderRadius: '7px', padding: '5px 6px', fontSize: '0.8rem' }}
                                                />
                                            </td>
                                            <td style={{ padding: '10px 8px' }}>
                                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                    <button
                                                        onClick={() => flowAction(todo.id, 'start')}
                                                        onMouseDown={(e) => e.stopPropagation()}
                                                        disabled={updatingId === todo.id}
                                                        style={{ border: '1px solid #bfdbfe', color: '#1d4ed8', background: '#eff6ff', borderRadius: '7px', padding: '4px 7px', fontSize: '0.75rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                                    >
                                                        <Play size={12} /> 开始
                                                    </button>
                                                    <button
                                                        onClick={() => flowAction(todo.id, 'submit')}
                                                        onMouseDown={(e) => e.stopPropagation()}
                                                        disabled={updatingId === todo.id}
                                                        style={{ border: '1px solid #fde68a', color: '#a16207', background: '#fffbeb', borderRadius: '7px', padding: '4px 7px', fontSize: '0.75rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                                    >
                                                        <Send size={12} /> 提交验收
                                                    </button>
                                                    {todo.status === 'pending_review' && (
                                                        <button
                                                            onClick={() => flowAction(todo.id, 'approve')}
                                                            onMouseDown={(e) => e.stopPropagation()}
                                                            disabled={updatingId === todo.id}
                                                            style={{ border: '1px solid #bbf7d0', color: '#15803d', background: '#f0fdf4', borderRadius: '7px', padding: '4px 7px', fontSize: '0.75rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                                        >
                                                            <Send size={12} /> 审核通过
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => flowAction(todo.id, 'reopen')}
                                                        onMouseDown={(e) => e.stopPropagation()}
                                                        disabled={updatingId === todo.id}
                                                        style={{ border: '1px solid #fecaca', color: '#b91c1c', background: '#fef2f2', borderRadius: '7px', padding: '4px 7px', fontSize: '0.75rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                                    >
                                                        <RotateCcw size={12} /> 重新打开
                                                    </button>
                                                    <button
                                                        onClick={() => deleteBug(todo)}
                                                        onMouseDown={(e) => e.stopPropagation()}
                                                        disabled={updatingId === todo.id}
                                                        style={{ border: '1px solid #e2e8f0', color: '#334155', background: '#f8fafc', borderRadius: '7px', padding: '4px 7px', fontSize: '0.75rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                                    >
                                                        <Trash2 size={12} /> 删除
                                                    </button>
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

            <BugDetailModal
                isOpen={Boolean(selectedBug)}
                onClose={() => setSelectedBug(null)}
                bug={selectedBug}
                project={project}
                members={members}
                statusLabels={STATUS_LABELS}
                priorityLabels={PRIORITY_LABELS}
            />
        </div>
    );
}
