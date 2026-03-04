import client from './client';
import axios from 'axios';

export const projectApi = {
    // Projects
    listProjects: async (params = {}) => {
        const { page = 1, page_size = 20, status, project_type } = params;
        return client.get('/project/projects', {
            params: { page, page_size, status, project_type }
        });
    },

    getProject: async (projectId) => {
        return client.get(`/project/projects/${projectId}`);
    },
    getProjectAttachments: async (projectId) => {
        return client.get(`/project/projects/${projectId}/attachments`);
    },
    uploadProjectAttachment: async (projectId, file) => {
        const formData = new FormData();
        formData.append('file', file);
        return client.post(`/project/projects/${projectId}/attachments`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },
    deleteProjectAttachment: async (projectId, attachmentId) => {
        return client.delete(`/project/projects/${projectId}/attachments/${attachmentId}`);
    },
    downloadProjectAttachment: async (projectId, attachmentId) => {
        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        return axios.get(`/api/v1/project/projects/${projectId}/attachments/${attachmentId}/download`, {
            responseType: 'blob',
            withCredentials: true,
            headers,
        });
    },

    createProject: async (data) => {
        return client.post('/project/projects', data);
    },

    updateProject: async (projectId, data) => {
        return client.patch(`/project/projects/${projectId}`, data);
    },

    // Project Stages
    getProjectStages: async (id) => {
        return client.get(`/project/projects/${id}/stages`);
    },

    updateProjectStage: async (projectId, stageId, data) => {
        return client.patch(`/project/projects/${projectId}/stages/${stageId}`, data);
    },

    deleteProject: async (projectId) => {
        return client.delete(`/project/projects/${projectId}`);
    },

    // Project Members
    getProjectMembers: async (projectId) => {
        return client.get(`/project/projects/${projectId}/members`);
    },

    addProjectMember: async (projectId, data) => {
        return client.post(`/project/projects/${projectId}/members`, data);
    },

    removeProjectMember: async (projectId, userId) => {
        return client.delete(`/project/projects/${projectId}/members/${userId}`);
    },

    // Project Tasks
    getProjectTodos: async (projectId) => {
        return client.get(`/project/projects/${projectId}/todos`);
    },
    assignProjectTodo: async (projectId, todoId, assignee_user_id) => {
        return client.post(`/project/projects/${projectId}/todos/${todoId}/assign`, { assignee_user_id });
    },
    updateProjectTodoPlan: async (projectId, todoId, data) => {
        return client.post(`/project/projects/${projectId}/todos/${todoId}/plan`, data);
    },
    batchAssignProjectTodos: async (projectId, todoIds, assigneeUserId) => {
        return client.post(`/project/projects/${projectId}/todos/batch-assign`, {
            todo_ids: todoIds,
            assignee_user_id: assigneeUserId,
        });
    },
    deleteProjectTodo: async (projectId, todoId) => {
        return client.delete(`/project/projects/${projectId}/todos/${todoId}`);
    },
    clearProjectTodos: async (projectId) => {
        return client.delete(`/project/projects/${projectId}/todos`);
    },

    // Dev Task Generation
    getProjectFeatureList: async (projectId) => {
        return client.get(`/project/projects/${projectId}/feature-list`);
    },

    generateDevTasks: async (projectId, tasks) => {
        return client.post(`/project/projects/${projectId}/generate-dev-tasks`, { tasks });
    },
    syncDevTasks: async (projectId) => {
        return client.post(`/project/projects/${projectId}/sync-dev-tasks`);
    },

    // Contract context (enriched data for contract generation)
    getProjectContractContext: async (projectId) => {
        return client.get(`/project/projects/${projectId}/contract-context`);
    },
    downloadAcceptanceReport: async (projectId) => {
        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        return axios.get(`/api/v1/project/projects/${projectId}/acceptance-report/download`, {
            responseType: 'blob',
            withCredentials: true,
            headers,
        });
    },
};

export default projectApi;
