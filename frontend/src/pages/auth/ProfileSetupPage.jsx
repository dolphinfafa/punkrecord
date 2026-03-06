import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Loader2, Upload } from 'lucide-react';
import authApi from '@/api/auth';
import iamApi from '@/api/iam';
import './LoginPage.css';

const EDUCATION_OPTIONS = [
    { value: 'high_school', label: '高中/中专' },
    { value: 'associate', label: '大专' },
    { value: 'bachelor', label: '本科' },
    { value: 'master', label: '硕士' },
    { value: 'doctorate', label: '博士' },
    { value: 'other', label: '其他' },
];

export default function ProfileSetupPage() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [form, setForm] = useState({
        email: '',
        phone: '',
        birthday: '',
        id_number: '',
        home_address: '',
        graduation_school: '',
        education_level: '',
        new_password: '',
        confirm_password: '',
    });
    const [idCardFile, setIdCardFile] = useState(null);
    const [resumeFile, setResumeFile] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!form.new_password || form.new_password.length < 6) {
            setError('新密码长度不能少于6位');
            return;
        }
        if (form.new_password !== form.confirm_password) {
            setError('两次输入的密码不一致');
            return;
        }

        setLoading(true);
        try {
            await authApi.completeProfile({
                email: form.email || null,
                phone: form.phone || null,
                birthday: form.birthday || null,
                id_number: form.id_number || null,
                home_address: form.home_address || null,
                graduation_school: form.graduation_school || null,
                education_level: form.education_level || null,
                new_password: form.new_password,
            });

            // Upload files if selected
            if (idCardFile && user?.id) {
                try { await iamApi.uploadIdCardImage(user.id, idCardFile); } catch {}
            }
            if (resumeFile && user?.id) {
                try { await iamApi.uploadResume(user.id, resumeFile); } catch {}
            }

            // Update local user state
            const cached = JSON.parse(localStorage.getItem('user') || '{}');
            cached.profile_completed = true;
            cached.must_change_password = false;
            localStorage.setItem('user', JSON.stringify(cached));

            navigate('/');
            window.location.reload();
        } catch (err) {
            setError(err.response?.data?.message || '提交失败，请重试');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card" style={{ maxWidth: '540px' }}>
                <div className="login-header" style={{ marginBottom: '20px' }}>
                    <h1 style={{ fontSize: '24px' }}>完善个人档案</h1>
                    <p>首次登录，请填写以下信息并设置新密码</p>
                </div>

                <form onSubmit={handleSubmit} className="login-form">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div className="form-group">
                            <label>邮箱</label>
                            <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="工作邮箱" />
                        </div>
                        <div className="form-group">
                            <label>手机号</label>
                            <input type="tel" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="手机号码" />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div className="form-group">
                            <label>生日</label>
                            <input type="date" value={form.birthday} onChange={e => setForm(p => ({ ...p, birthday: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label>学历</label>
                            <select value={form.education_level} onChange={e => setForm(p => ({ ...p, education_level: e.target.value }))}>
                                <option value="">请选择</option>
                                {EDUCATION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>身份证号</label>
                        <input value={form.id_number} onChange={e => setForm(p => ({ ...p, id_number: e.target.value }))} placeholder="18位身份证号码" />
                    </div>

                    <div className="form-group">
                        <label>家庭住址</label>
                        <input value={form.home_address} onChange={e => setForm(p => ({ ...p, home_address: e.target.value }))} placeholder="详细家庭住址" />
                    </div>

                    <div className="form-group">
                        <label>毕业学校</label>
                        <input value={form.graduation_school} onChange={e => setForm(p => ({ ...p, graduation_school: e.target.value }))} placeholder="最高学历毕业院校" />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div className="form-group">
                            <label>身份证照片</label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 12px', border: '1px dashed #45475a', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', color: '#a6adc8', background: '#1e1e2e' }}>
                                <Upload size={16} />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {idCardFile ? idCardFile.name : '点击选择图片'}
                                </span>
                                <input type="file" accept="image/*" hidden onChange={e => setIdCardFile(e.target.files[0])} />
                            </label>
                        </div>
                        <div className="form-group">
                            <label>简历 (PDF)</label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 12px', border: '1px dashed #45475a', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', color: '#a6adc8', background: '#1e1e2e' }}>
                                <Upload size={16} />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {resumeFile ? resumeFile.name : '点击选择 PDF'}
                                </span>
                                <input type="file" accept=".pdf" hidden onChange={e => setResumeFile(e.target.files[0])} />
                            </label>
                        </div>
                    </div>

                    <hr style={{ border: 'none', borderTop: '1px solid #313244', margin: '4px 0' }} />

                    <div className="form-group">
                        <label>新密码 *</label>
                        <div className="input-with-icon">
                            <Lock size={18} className="input-icon" />
                            <input type="password" value={form.new_password} onChange={e => setForm(p => ({ ...p, new_password: e.target.value }))} placeholder="至少6位" required />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>确认密码 *</label>
                        <div className="input-with-icon">
                            <Lock size={18} className="input-icon" />
                            <input type="password" value={form.confirm_password} onChange={e => setForm(p => ({ ...p, confirm_password: e.target.value }))} placeholder="再次输入新密码" required />
                        </div>
                    </div>

                    {error && <div className="error-message">{error}</div>}

                    <button type="submit" disabled={loading} className="submit-btn">
                        {loading ? <Loader2 className="spinner" size={20} /> : '提交并进入系统'}
                    </button>
                </form>

                <div className="login-footer">
                    <button onClick={logout} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '13px' }}>
                        退出登录
                    </button>
                </div>
            </div>
        </div>
    );
}
