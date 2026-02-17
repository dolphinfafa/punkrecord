import React, { createContext, useContext, useState, useEffect } from 'react';
import client from '@/api/client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Validate token on app initialization
        const initAuth = async () => {
            const token = localStorage.getItem('token');
            const savedUser = localStorage.getItem('user');

            if (token && savedUser) {
                try {
                    // Validate token by calling /auth/me
                    await client.get('/auth/me');
                    // Token is valid, set user
                    setUser(JSON.parse(savedUser));
                } catch (error) {
                    // Token is invalid (e.g., server restarted), clear storage
                    console.log('Token validation failed, clearing auth state');
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    setUser(null);
                }
            }
            setLoading(false);
        };

        initAuth();
    }, []);

    const login = async (username, password) => {
        try {
            const response = await client.post('/auth/login', { username, password });
            const { access_token, user_id, display_name } = response;

            const userData = { id: user_id, name: display_name };

            localStorage.setItem('token', access_token);
            localStorage.setItem('user', JSON.stringify(userData));
            setUser(userData);

            return true;
        } catch (error) {
            console.error('Login failed:', error);
            throw error;
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        window.location.href = '/login';
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
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
