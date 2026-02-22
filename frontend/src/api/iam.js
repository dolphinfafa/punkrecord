import client from './client';

export const iamApi = {
    // Users
    listUsers: async (params = {}) => {
        const { page = 1, page_size = 20, department_id, job_title_id } = params;
        let url = `/iam/users?page=${page}&page_size=${page_size}`;
        if (department_id) url += `&department_id=${department_id}`;
        if (job_title_id) url += `&job_title_id=${job_title_id}`;
        return client.get(url);
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

    // Job Titles
    listJobTitles: async () => {
        return client.get('/iam/job-titles');
    },

    createJobTitle: async (data) => {
        return client.post('/iam/job-titles', data);
    },

    updateJobTitle: async (id, data) => {
        return client.patch(`/iam/job-titles/${id}`, data);
    },

    deleteJobTitle: async (id) => {
        return client.delete(`/iam/job-titles/${id}`);
    },

    // Departments
    listDepartments: async () => {
        return client.get('/iam/departments');
    },

    createDepartment: async (data) => {
        return client.post('/iam/departments', data);
    },

    updateDepartment: async (id, data) => {
        return client.patch(`/iam/departments/${id}`, data);
    },

    deleteDepartment: async (id) => {
        return client.delete(`/iam/departments/${id}`);
    },

    // Org Chart
    getOrgChart: async () => {
        return client.get('/iam/org-chart');
    },

    // Our Entities
    listEntities: async () => {
        return client.get('/iam/entities');
    },

    createEntity: async (entityData) => {
        return client.post('/iam/our-entities', entityData);
    },
};

export default iamApi;
