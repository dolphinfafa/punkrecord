import { useState, useEffect, useCallback, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { wechatNotifyApi } from '@/api/wechatNotify';
import { MessageSquare, Link2, Unlink, Send, RefreshCw, Loader2, CheckCircle, AlertCircle, Smartphone, Bell, Save } from 'lucide-react';
import './WeChatNotifyPage.css';

const POLL_INTERVAL = 2000;

const PREF_OPTIONS = [
    { key: 'todo_assigned', label: '新任务分配给我', desc: '有人给你分配了新的待办事项' },
    { key: 'todo_created_notify_manager', label: '下属收到新任务', desc: '你的下属被分配了新任务' },
    { key: 'todo_submitted', label: '任务提交审核', desc: '下属提交任务等待你审核' },
    { key: 'todo_approved', label: '任务审核通过', desc: '你提交的任务被审核通过' },
    { key: 'todo_rejected', label: '任务被退回', desc: '你提交的任务被退回修改' },
    { key: 'todo_reassigned', label: '任务转派给我', desc: '有任务被转派给你' },
    { key: 'todo_reopened', label: '已完成任务被重开', desc: '你已完成的任务被重新打开' },
    { key: 'todo_blocked', label: '任务被阻塞', desc: '你创建的任务被标记为阻塞' },
    { key: 'todo_done_direct', label: '任务直接完成', desc: '你创建的任务被直接标记完成' },
];

const DEFAULT_PREFS = Object.fromEntries(PREF_OPTIONS.map(o => [o.key, true]));

export default function WeChatNotifyPage() {
    const [binding, setBinding] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Bind flow state
    const [bindLoading, setBindLoading] = useState(false);
    const [qrData, setQrData] = useState(null); // { sessionId, qrUrl, expiresIn }
    const [bindStatus, setBindStatus] = useState(null); // waiting, scanned, confirmed, expired, error
    const [bindMessage, setBindMessage] = useState('');
    const pollRef = useRef(null);

    // Preferences state
    const [preferences, setPreferences] = useState(DEFAULT_PREFS);
    const [prefSaving, setPrefSaving] = useState(false);
    const [prefSaved, setPrefSaved] = useState(false);

    // Action state
    const [testSending, setTestSending] = useState(false);
    const [testResult, setTestResult] = useState(null);
    const [unbinding, setUnbinding] = useState(false);
    const [showUnbindConfirm, setShowUnbindConfirm] = useState(false);

    const loadBinding = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const resp = await wechatNotifyApi.getBinding();
            setBinding(resp.data);
            if (resp.data?.preferences) {
                setPreferences({ ...DEFAULT_PREFS, ...resp.data.preferences });
            } else {
                setPreferences(DEFAULT_PREFS);
            }
        } catch (err) {
            setError(err.response?.data?.message || '加载绑定状态失败');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadBinding();
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, [loadBinding]);

    const stopPolling = useCallback(() => {
        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
    }, []);

    const handleStartBind = async () => {
        try {
            setBindLoading(true);
            setError(null);
            setBindStatus(null);
            setBindMessage('');
            setQrData(null);

            const resp = await wechatNotifyApi.startBind();
            const data = resp.data;
            setQrData(data);
            setBindStatus('waiting');
            setBindMessage('请使用微信扫描二维码');

            // Start polling
            stopPolling();
            pollRef.current = setInterval(async () => {
                try {
                    const statusResp = await wechatNotifyApi.checkBindStatus(data.sessionId);
                    const statusData = statusResp.data;
                    setBindStatus(statusData.status);
                    setBindMessage(statusData.message);

                    if (statusData.status === 'confirmed') {
                        stopPolling();
                        setQrData(null);
                        await loadBinding();
                    } else if (statusData.status === 'expired' || statusData.status === 'error') {
                        stopPolling();
                    }
                } catch {
                    // Polling error, continue
                }
            }, POLL_INTERVAL);
        } catch (err) {
            setError(err.response?.data?.message || '发起绑定失败');
        } finally {
            setBindLoading(false);
        }
    };

    const handleCancelBind = () => {
        stopPolling();
        setQrData(null);
        setBindStatus(null);
        setBindMessage('');
    };

    const handleSendTest = async () => {
        try {
            setTestSending(true);
            setTestResult(null);
            await wechatNotifyApi.sendTest();
            setTestResult({ ok: true, message: '测试消息已发送，请查看微信' });
        } catch (err) {
            setTestResult({ ok: false, message: err.response?.data?.message || '发送失败' });
        } finally {
            setTestSending(false);
        }
    };

    const handleTogglePref = (key) => {
        setPreferences(prev => ({ ...prev, [key]: !prev[key] }));
        setPrefSaved(false);
    };

    const handleSavePreferences = async () => {
        try {
            setPrefSaving(true);
            await wechatNotifyApi.updatePreferences(preferences);
            setPrefSaved(true);
            setTimeout(() => setPrefSaved(false), 2000);
        } catch (err) {
            setError(err.response?.data?.message || '保存通知偏好失败');
        } finally {
            setPrefSaving(false);
        }
    };

    const handleUnbind = async () => {
        try {
            setUnbinding(true);
            await wechatNotifyApi.unbind();
            setShowUnbindConfirm(false);
            setBinding(null);
            setTestResult(null);
        } catch (err) {
            setError(err.response?.data?.message || '解绑失败');
        } finally {
            setUnbinding(false);
        }
    };

    if (loading) {
        return (
            <div className="wechat-notify-container">
                <div className="wechat-loading">
                    <Loader2 className="spin" size={24} />
                    <span>加载中...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="wechat-notify-container">
            <div className="wechat-header">
                <div>
                    <h1><MessageSquare size={28} /> 微信通知</h1>
                    <p className="wechat-subtitle">绑定微信后，待办事项变更时将通过微信推送通知</p>
                </div>
            </div>

            {error && (
                <div className="wechat-alert wechat-alert-error">
                    <AlertCircle size={16} />
                    <span>{error}</span>
                    <button className="alert-dismiss" onClick={() => setError(null)}>x</button>
                </div>
            )}

            {binding ? (
                /* ─── Bound State ─── */
                <div className="wechat-card">
                    <div className="wechat-card-header">
                        <CheckCircle size={20} className="text-success" />
                        <span>已绑定微信通知</span>
                    </div>
                    <div className="wechat-card-body">
                        <div className="binding-info">
                            <div className="info-row">
                                <span className="info-label">账号 ID</span>
                                <span className="info-value">{binding.account_id || '-'}</span>
                            </div>
                            {binding.nickname && (
                                <div className="info-row">
                                    <span className="info-label">昵称</span>
                                    <span className="info-value">{binding.nickname}</span>
                                </div>
                            )}
                            <div className="info-row">
                                <span className="info-label">绑定时间</span>
                                <span className="info-value">
                                    {binding.created_at ? new Date(binding.created_at).toLocaleString('zh-CN') : '-'}
                                </span>
                            </div>
                        </div>

                        {/* ─── Notification Preferences ─── */}
                        <div className="pref-section">
                            <div className="pref-header">
                                <Bell size={18} />
                                <span>通知设置</span>
                                <span className="pref-hint">勾选需要接收微信通知的场景</span>
                            </div>
                            <div className="pref-list">
                                {PREF_OPTIONS.map(opt => (
                                    <label key={opt.key} className="pref-item">
                                        <input
                                            type="checkbox"
                                            checked={preferences[opt.key] ?? true}
                                            onChange={() => handleTogglePref(opt.key)}
                                        />
                                        <div className="pref-text">
                                            <span className="pref-label">{opt.label}</span>
                                            <span className="pref-desc">{opt.desc}</span>
                                        </div>
                                    </label>
                                ))}
                            </div>
                            <div className="pref-actions">
                                <button
                                    className="wechat-btn wechat-btn-primary"
                                    onClick={handleSavePreferences}
                                    disabled={prefSaving}
                                >
                                    {prefSaving ? <Loader2 className="spin" size={16} /> : <Save size={16} />}
                                    <span>{prefSaved ? '已保存' : '保存设置'}</span>
                                </button>
                            </div>
                        </div>

                        <div className="wechat-actions">
                            <button
                                className="wechat-btn wechat-btn-primary"
                                onClick={handleSendTest}
                                disabled={testSending}
                            >
                                {testSending ? <Loader2 className="spin" size={16} /> : <Send size={16} />}
                                <span>发送测试消息</span>
                            </button>
                            <button
                                className="wechat-btn wechat-btn-danger"
                                onClick={() => setShowUnbindConfirm(true)}
                            >
                                <Unlink size={16} />
                                <span>解除绑定</span>
                            </button>
                        </div>

                        {testResult && (
                            <div className={`wechat-alert ${testResult.ok ? 'wechat-alert-success' : 'wechat-alert-error'}`}>
                                {testResult.ok ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                                <span>{testResult.message}</span>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                /* ─── Unbound State ─── */
                <div className="wechat-card">
                    <div className="wechat-card-header">
                        <Smartphone size={20} />
                        <span>绑定微信</span>
                    </div>
                    <div className="wechat-card-body">
                        {!qrData ? (
                            <div className="bind-intro">
                                <p>绑定后，系统会在以下情况通过微信通知你：</p>
                                <ul>
                                    <li>收到新的待办事项</li>
                                    <li>待办提交审核时通知上级</li>
                                    <li>审批结果通知</li>
                                </ul>
                                <button
                                    className="wechat-btn wechat-btn-primary wechat-btn-lg"
                                    onClick={handleStartBind}
                                    disabled={bindLoading}
                                >
                                    {bindLoading ? <Loader2 className="spin" size={18} /> : <Link2 size={18} />}
                                    <span>生成绑定二维码</span>
                                </button>
                            </div>
                        ) : (
                            <div className="qr-section">
                                <div className="qr-image-wrapper">
                                    <QRCodeSVG
                                        value={qrData.qrUrl}
                                        size={220}
                                        level="M"
                                        className="qr-image"
                                    />
                                    {(bindStatus === 'expired' || bindStatus === 'error') && (
                                        <div className="qr-overlay">
                                            <span>已过期</span>
                                        </div>
                                    )}
                                </div>
                                <div className="qr-status">
                                    <div className={`status-indicator status-${bindStatus}`}>
                                        {bindStatus === 'waiting' && <Loader2 className="spin" size={16} />}
                                        {bindStatus === 'scanned' && <Smartphone size={16} />}
                                        {bindStatus === 'confirmed' && <CheckCircle size={16} />}
                                        {(bindStatus === 'expired' || bindStatus === 'error') && <AlertCircle size={16} />}
                                        <span>{bindMessage}</span>
                                    </div>
                                </div>
                                <div className="qr-actions">
                                    {(bindStatus === 'expired' || bindStatus === 'error') && (
                                        <button
                                            className="wechat-btn wechat-btn-primary"
                                            onClick={handleStartBind}
                                            disabled={bindLoading}
                                        >
                                            <RefreshCw size={16} />
                                            <span>重新生成</span>
                                        </button>
                                    )}
                                    <button
                                        className="wechat-btn wechat-btn-secondary"
                                        onClick={handleCancelBind}
                                    >
                                        <span>取消</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Unbind Confirmation Modal */}
            {showUnbindConfirm && (
                <div className="wechat-modal-overlay" onClick={() => setShowUnbindConfirm(false)}>
                    <div className="wechat-modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3>确认解除绑定</h3>
                        <p>解绑后将不再通过微信接收通知，确定要解除绑定吗？</p>
                        <div className="wechat-modal-actions">
                            <button
                                className="wechat-btn wechat-btn-secondary"
                                onClick={() => setShowUnbindConfirm(false)}
                                disabled={unbinding}
                            >
                                取消
                            </button>
                            <button
                                className="wechat-btn wechat-btn-danger"
                                onClick={handleUnbind}
                                disabled={unbinding}
                            >
                                {unbinding ? <Loader2 className="spin" size={16} /> : null}
                                <span>确认解绑</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
