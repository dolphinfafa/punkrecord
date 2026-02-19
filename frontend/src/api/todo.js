import client from './client';

export const todoApi = {
    // Create todo
    create: (data) => client.post('/todo', data),

    // Get my todo list
    list: (params) => client.get('/todo/my', { params }),

    // Get team todos (manager view)
    listTeam: (params) => client.get('/todo/team', { params }),

    // Get single todo
    get: (id) => client.get(`/todo/${id}`),

    // Update todo
    update: (id, data) => client.patch(`/todo/${id}`, data),

    // Start todo (Open -> In Progress)
    start: (id) => client.post(`/todo/${id}/start`),

    // Employee submits task as complete → pending_review
    submit: (id) => client.post(`/todo/${id}/submit`),

    // Manager approves → done
    approve: (id, comment) => client.post(`/todo/${id}/approve`, { comment }),

    // Manager rejects → open with comment
    reject: (id, comment) => client.post(`/todo/${id}/reject`, { comment }),

    // Block todo
    block: (id, reason) => client.post(`/todo/${id}/block`, null, { params: { blocked_reason: reason } }),

    // Dismiss todo
    dismiss: (id, reason) => client.post(`/todo/${id}/dismiss`, null, { params: { dismiss_reason: reason } }),

    // Legacy mark done (now goes to pending_review)
    markDone: (id) => client.post(`/todo/${id}/done`),
    // Generic status update for DnD (Backward transitions)
    updateStatus: (id, status, comment) => client.post(`/todo/${id}/status`, { status, comment }),
};
