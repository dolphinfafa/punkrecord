import client from './client';

export const wechatNotifyApi = {
    getBinding: () => client.get('/wechat-notify/binding'),
    startBind: () => client.post('/wechat-notify/bind/start'),
    checkBindStatus: (sessionId) => client.get(`/wechat-notify/bind/status/${sessionId}`),
    unbind: () => client.delete('/wechat-notify/unbind'),
    sendTest: () => client.post('/wechat-notify/test'),
    updatePreferences: (preferences) => client.put('/wechat-notify/preferences', { preferences }),
};
