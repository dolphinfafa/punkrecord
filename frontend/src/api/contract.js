import client from './client';

export const contractApi = {
    // Contracts
    listContracts: async (params = {}) => {
        const { page = 1, page_size = 20, status, contract_type } = params;
        let url = `/contract/contracts?page=${page}&page_size=${page_size}`;
        if (status) url += `&status=${status}`;
        if (contract_type) url += `&contract_type=${contract_type}`;
        return client.get(url);
    },

    getContract: async (contractId) => {
        return client.get(`/contract/contracts/${contractId}`);
    },

    createContract: async (contractData) => {
        return client.post('/contract/contracts', contractData);
    },

    updateContract: async (contractId, contractData) => {
        return client.patch(`/contract/contracts/${contractId}`, contractData);
    },

    submitForApproval: async (contractId) => {
        return client.post(`/contract/contracts/${contractId}/submit`);
    },

    getPaymentPlans: async (contractId) => {
        return client.get(`/contract/contracts/${contractId}/payment-plans`);
    },

    // Counterparties
    listCounterparties: async (params = {}) => {
        const { type } = params;
        let url = '/contract/counterparties';
        if (type) url += `?type=${type}`;
        return client.get(url);
    },

    createCounterparty: async (counterpartyData) => {
        return client.post('/contract/counterparties', counterpartyData);
    },
};

export default contractApi;
