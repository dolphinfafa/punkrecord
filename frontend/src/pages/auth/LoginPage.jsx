import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Loader2, Eye, EyeOff } from 'lucide-react';
import './LoginPage.css';

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const userData = await login(username, password);
            if (!userData.profile_completed || userData.must_change_password) {
                navigate('/profile-setup');
            } else {
                navigate('/');
            }
        } catch (err) {
            const msg = err?.response?.data?.message || err?.message || '';
            if (msg.includes('停用')) {
                setError('该账号已停用，请联系管理员');
            } else if (msg.includes('密码') || msg.includes('用户')) {
                setError(msg);
            } else {
                setError('用户名或密码错误，请检查后重试');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-header">
                    <h1>PunkRecord</h1>
                    <p>企业管理系统</p>
                </div>

                <form onSubmit={handleSubmit} className="login-form">
                    <div className="form-group">
                        <label htmlFor="username">用户名</label>
                        <div className="input-with-icon">
                            <User size={18} className="input-icon" />
                            <input
                                id="username"
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="请输入用户名"
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">密码</label>
                        <div className="input-with-icon">
                            <Lock size={18} className="input-icon" />
                            <input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => {
                                    const v = e.target.value.replace(/[^\x20-\x7E]/g, '');
                                    setPassword(v);
                                }}
                                onCompositionStart={(e) => e.target.setAttribute('data-composing', 'true')}
                                onCompositionEnd={(e) => {
                                    e.target.setAttribute('data-composing', 'false');
                                    const v = e.target.value.replace(/[^\x20-\x7E]/g, '');
                                    setPassword(v);
                                }}
                                placeholder="请输入密码"
                                required
                                autoComplete="current-password"
                            />
                            <button
                                type="button"
                                className="password-toggle"
                                onClick={() => setShowPassword(!showPassword)}
                                tabIndex={-1}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    {error && <div className="error-message">{error}</div>}

                    <button type="submit" disabled={loading} className="submit-btn">
                        {loading ? <Loader2 className="spinner" size={20} /> : '登录'}
                    </button>
                </form>

                <div className="login-footer">
                    <p>PunkRecord 企业管理平台</p>
                </div>
            </div>
        </div>
    );
}
