import client from './client';

const agentTokenApi = {
    create: (data) => client.post('/auth/agent-tokens', data),
    list: () => client.get('/auth/agent-tokens'),
    revoke: (tokenId) => client.delete(`/auth/agent-tokens/${tokenId}`),
};

export default agentTokenApi;
