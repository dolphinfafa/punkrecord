import client from './client';

export const todoApi = {
    // Create todo
    create: (data) => client.post('/todo', data),

    // Get todo list
    list: (params) => client.get('/todo/my', { params }),

    // Get single todo
    get: (id) => client.get(`/todo/${id}`),

    // Update todo
    update: (id, data) => client.patch(`/todo/${id}`, data),

    // Mark as done
    markDone: (id) => client.post(`/todo/${id}/done`),

    // Block todo
    block: (id, reason) => client.post(`/todo/${id}/block`, null, { params: { blocked_reason: reason } }),

    // Dismiss todo
    dismiss: (id, reason) => client.post(`/todo/${id}/dismiss`, null, { params: { dismiss_reason: reason } })
};
