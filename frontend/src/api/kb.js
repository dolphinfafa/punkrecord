import client from './client';

export const kbApi = {
    // Documents
    uploadDocument: (file, title) => {
        const formData = new FormData();
        formData.append('file', file);
        if (title) formData.append('title', title);
        return client.post('/kb/documents/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },
    getDocuments: (params) => client.get('/kb/documents', { params }),
    getDocument: (id) => client.get(`/kb/documents/${id}`),
    updateDocument: (id, data) => client.patch(`/kb/documents/${id}`, data),
    deleteDocument: (id) => client.delete(`/kb/documents/${id}`),
    downloadDocument: (id) => `${client.defaults.baseURL}/kb/documents/${id}/download`,
    reprocessDocument: (id) => client.post(`/kb/documents/${id}/reprocess`),
    getTags: () => client.get('/kb/tags'),

    // Conversations
    createConversation: (data) => client.post('/kb/conversations', data),
    getConversations: () => client.get('/kb/conversations'),
    getMessages: (id) => client.get(`/kb/conversations/${id}/messages`),
    deleteConversation: (id) => client.delete(`/kb/conversations/${id}`),

    // Chat & Search
    search: (data) => client.post('/kb/search', data),
};
