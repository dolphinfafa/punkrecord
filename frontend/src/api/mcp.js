import client from './client';

const mcpApi = {
    // { url, tools: [{name, description}] }
    getInfo: () => client.get('/mcp-info'),
};

export default mcpApi;
