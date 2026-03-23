import axios from 'axios';

const client = axios.create({
    baseURL: '/punkrecord/api/v1',
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add a request interceptor
client.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Add a response interceptor
client.interceptors.response.use(
    (response) => {
        return response.data;
    },
    (error) => {
        if (error.response && error.response.status === 401) {
            // Clear token and redirect to login if 401
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            // Don't redirect if already on the login page (avoid reload loop on login failure)
            if (!window.location.pathname.endsWith('/login')) {
                window.location.href = '/punkrecord/login';
            }
        }
        return Promise.reject(error);
    }
);

export default client;
