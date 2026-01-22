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
    getProjectStages: async (projectId) => {
        return client.get(`/project/projects/${projectId}/stages`);
    },

    updateStageStatus: async (stageId, data) => {
        return client.patch(`/project/stages/${stageId}`, data);
    },
};

export default projectApi;
