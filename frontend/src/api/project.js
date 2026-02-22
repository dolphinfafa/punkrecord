import client from './client';

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
};

export default projectApi;
