import client from './client';

export const financeApi = {
    // Accounts
    listAccounts: async (params = {}) => {
        return client.get('/finance/accounts', { params });
    },

    createAccount: async (accountData) => {
        return client.post('/finance/accounts', accountData);
    },

    updateAccount: async (accountId, accountData) => {
        return client.patch(`/finance/accounts/${accountId}`, accountData);
    },

    // Transactions
    listTransactions: async (params = {}) => {
        const { page = 1, page_size = 20 } = params;
        return client.get(`/finance/transactions?page=${page}&page_size=${page_size}`);
    },

    createTransaction: async (transactionData) => {
        return client.post('/finance/transactions', transactionData);
    },

    getTransaction: async (txnId) => {
        return client.get(`/finance/transactions/${txnId}`);
    },

    // Invoices
    listInvoices: async (params = {}) => {
        const { page = 1, page_size = 20, invoice_kind } = params;
        return client.get('/finance/invoices', {
            params: { page, page_size, invoice_kind }
        });
    },

    createInvoice: async (data) => {
        return client.post('/finance/invoices', data);
    },

    // Reimbursements
    listReimbursements: async (params = {}) => {
        const { page = 1, page_size = 20, status } = params;
        return client.get('/finance/reimbursements', {
            params: { page, page_size, status }
        });
    },

    createReimbursement: async (data) => {
        return client.post('/finance/reimbursements', data);
    },
};

export default financeApi;
