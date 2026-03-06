import client from './client';

export const authApi = {
    // Login
    login: async (username, password) => {
        return client.post('/auth/login', { username, password });
    },

    // Register
    register: async (userData) => {
        return client.post('/auth/register', userData);
    },

    // Get current user
    getCurrentUser: async () => {
        return client.get('/auth/me');
    },

    // Complete profile (first-time login)
    completeProfile: async (data) => {
        return client.post('/auth/complete-profile', data);
    },

    // Change password
    changePassword: async (oldPassword, newPassword) => {
        return client.post('/auth/change-password', {
            old_password: oldPassword,
            new_password: newPassword,
        });
    },

    // Logout (client-side only, clear token)
    logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    },
};

export default authApi;
