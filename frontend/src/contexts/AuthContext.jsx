import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import client from '@/api/client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const initAuth = async () => {
            const token = localStorage.getItem('token');
            const cachedUser = localStorage.getItem('user');

            if (!token) {
                setLoading(false);
                return;
            }

            // Immediately restore from cache so UI is fast
            if (cachedUser) {
                setUser(JSON.parse(cachedUser));
            }

            try {
                // Re-validate token against backend
                const resp = await client.get('/auth/me');
                // Axios interceptor returns response.data, so resp is {code, data, message}
                const profile = resp.data || resp;
                if (profile && profile.id) {
                    const userData = {
                        id: profile.id,
                        name: profile.display_name,
                        profile_completed: profile.profile_completed,
                        must_change_password: profile.must_change_password,
                        permissions: profile.permissions || [],
                    };
                    setUser(userData);
                    localStorage.setItem('user', JSON.stringify(userData));
                }
            } catch (error) {
                console.log('Token validation failed, clearing auth state');
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                setUser(null);
            }
            setLoading(false);
        };

        initAuth();
    }, []);

    const login = async (username, password) => {
        try {
            const response = await client.post('/auth/login', { username, password });
            const { access_token, user_id, display_name, profile_completed, must_change_password } = response;

            localStorage.setItem('token', access_token);

            // Fetch full profile with permissions right after login
            const meResp = await client.get('/auth/me');
            const profile = meResp.data || meResp;
            const permissions = profile.permissions || [];

            const userData = { id: user_id, name: display_name, profile_completed, must_change_password, permissions };

            localStorage.setItem('user', JSON.stringify(userData));
            setUser(userData);

            return userData;
        } catch (error) {
            console.error('Login failed:', error);
            throw error;
        }
    };

    const logout = async () => {
        try {
            await client.post('/auth/logout');
        } catch (err) {
            console.error('Logout API failed:', err);
        }
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        window.location.href = '/login';
    };

    const hasPermission = useCallback((code) => {
        if (!user || !user.permissions) return false;
        return user.permissions.includes(code);
    }, [user]);

    const hasAnyPermission = useCallback((codes) => {
        if (!user || !user.permissions) return false;
        return codes.some((c) => user.permissions.includes(c));
    }, [user]);

    return (
        <AuthContext.Provider value={{ user, login, logout, loading, hasPermission, hasAnyPermission }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
