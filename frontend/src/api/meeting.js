import client from './client';

export const meetingApi = {
    createMeeting: (file, title, meetingType = 'morning') => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('title', title);
        formData.append('meeting_type', meetingType);
        return client.post('/meeting/records', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },
    getMeetings: (params) => client.get('/meeting/records', { params }),
    getMeeting: (id) => client.get(`/meeting/records/${id}`),
    deleteMeeting: (id) => client.delete(`/meeting/records/${id}`),
    getStatus: (id) => client.get(`/meeting/records/${id}/status`),
    getTranscript: (id) => client.get(`/meeting/records/${id}/transcript`),
    updateTranscript: (id, data) => client.patch(`/meeting/records/${id}/transcript`, data),
    updateSpeakers: (id, data) => client.put(`/meeting/records/${id}/speakers`, data),
    archiveToKB: (id) => client.post(`/meeting/records/${id}/archive`),
    getAudioUrl: (id) => `/punkrecord/api/v1/meeting/records/${id}/audio`,
};
