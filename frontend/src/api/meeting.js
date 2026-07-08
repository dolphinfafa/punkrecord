import client from './client';

export const meetingApi = {
    createMeeting: (title, meetingType = 'morning', meetingDate = null) => {
        const formData = new FormData();
        formData.append('title', title);
        formData.append('meeting_type', meetingType);
        if (meetingDate) formData.append('meeting_date', meetingDate);
        return client.post('/meeting/records', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },
    uploadAudio: (meetingId, file) => {
        const formData = new FormData();
        formData.append('file', file);
        return client.post(`/meeting/records/${meetingId}/upload-audio`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },
    updateAttendees: (meetingId, attendees) =>
        client.patch(`/meeting/records/${meetingId}/attendees`, { attendees }),
    getMeetings: (params) => client.get('/meeting/records', { params }),
    getMeeting: (id) => client.get(`/meeting/records/${id}`),
    deleteMeeting: (id) => client.delete(`/meeting/records/${id}`),
    getStatus: (id) => client.get(`/meeting/records/${id}/status`),
    getTranscript: (id) => client.get(`/meeting/records/${id}/transcript`),
    updateTranscript: (id, data) => client.patch(`/meeting/records/${id}/transcript`, data),
    updateSpeakers: (id, data) => client.put(`/meeting/records/${id}/speakers`, data),
    retranscribe: (id) => client.post(`/meeting/records/${id}/retranscribe`),
    archiveToKB: (id) => client.post(`/meeting/records/${id}/archive`),
    getAudioUrl: (id) => `/api/v1/meeting/records/${id}/audio`,
};
