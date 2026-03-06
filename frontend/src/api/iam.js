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
    resetUserLeaveBalances: async (userId) => {
        return client.post(`/iam/users/${userId}/reset-leave-balances`);
    },
    resetAllLeaveBalances: async () => {
        return client.post('/iam/users/reset-leave-balances');
    },
    // Beli rules
    listBeliRules: async () => {
        return client.get('/iam/beli-rules');
    },
    createBeliRule: async (data) => {
        return client.post('/iam/beli-rules', data);
    },
    updateBeliRule: async (id, data) => {
        return client.patch(`/iam/beli-rules/${id}`, data);
    },
    deleteBeliRule: async (id) => {
        return client.delete(`/iam/beli-rules/${id}`);
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

    // Permissions
    listPermissions: async () => {
        return client.get('/iam/permissions');
    },

    getJobTitlePermissions: async (jobTitleId) => {
        return client.get(`/iam/job-titles/${jobTitleId}/permissions`);
    },

    setJobTitlePermissions: async (jobTitleId, permissionCodes) => {
        return client.put(`/iam/job-titles/${jobTitleId}/permissions`, { permission_codes: permissionCodes });
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

    // User password reset
    resetUserPassword: async (userId) => {
        return client.post(`/iam/users/${userId}/reset-password`);
    },

    // User file uploads
    uploadIdCardImage: async (userId, file) => {
        const formData = new FormData();
        formData.append('file', file);
        return client.post(`/iam/users/${userId}/id-card-image`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },

    uploadResume: async (userId, file) => {
        const formData = new FormData();
        formData.append('file', file);
        return client.post(`/iam/users/${userId}/resume`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },

    getUserFileUrl: (userId, filename) => {
        return `/api/v1/iam/users/${userId}/files/${filename}`;
    },

    downloadUserFile: async (userId, filename) => {
        const response = await client.get(`/iam/users/${userId}/files/${filename}`, {
            responseType: 'blob',
            transformResponse: [(data) => data],
        });
        return response;
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
