import client from './client';

export const changelogApi = {
    list: async (params = {}) => {
        const { page = 1, page_size = 20 } = params;
        return client.get('/changelog/entries', { params: { page, page_size } });
    },

    create: async (data) => {
        return client.post('/changelog/entries', data);
    },

    update: async (id, data) => {
        return client.patch(`/changelog/entries/${id}`, data);
    },

    delete: async (id) => {
        return client.delete(`/changelog/entries/${id}`);
    },
};

export default changelogApi;
