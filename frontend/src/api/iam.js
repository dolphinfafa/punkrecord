import client from './client';

export const iamApi = {
    // Users
    listUsers: async (params = {}) => {
        const { page = 1, page_size = 20 } = params;
        return client.get(`/iam/users?page=${page}&page_size=${page_size}`);
    },

    getUser: async (userId) => {
        return client.get(`/iam/users/${userId}`);
    },

    createUser: async (userData) => {
        return client.post('/iam/users', userData);
    },

    updateUser: async (userId, userData) => {
        return client.patch(`/iam/users/${userId}`, userData);
    },

    // Our Entities
    listEntities: async () => {
        return client.get('/iam/our-entities');
    },

    createEntity: async (entityData) => {
        return client.post('/iam/our-entities', entityData);
    },
};

export default iamApi;
