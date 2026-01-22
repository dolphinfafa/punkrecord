import client from './client';

export const authApi = {
    // Login
    login: async (username, password) => {
        const formData = new URLSearchParams();
        formData.append('username', username);
        formData.append('password', password);

        return client.post('/auth/login', formData, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });
    },

    // Register
    register: async (userData) => {
        return client.post('/auth/register', userData);
    },

    // Get current user
    getCurrentUser: async () => {
        return client.get('/auth/me');
    },

    // Logout (client-side only, clear token)
    logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    },
};

export default authApi;
