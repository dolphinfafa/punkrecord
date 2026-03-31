import client from './client';

export const financeApi = {
    // Accounts
    listAccounts: async (params = {}) => {
        const { page = 1, page_size = 20 } = params;
        return client.get('/finance/accounts', { params: { page, page_size } });
    },

    createAccount: async (accountData) => {
        return client.post('/finance/accounts', accountData);
    },

    updateAccount: async (accountId, accountData) => {
        return client.patch(`/finance/accounts/${accountId}`, accountData);
    },

    // Transactions
    listTransactions: async (params = {}) => {
        const { page = 1, page_size = 20, account_id, txn_direction, date_from, date_to } = params;
        return client.get('/finance/transactions', {
            params: { page, page_size, account_id, txn_direction, date_from, date_to }
        });
    },

    exportTransactions: async (params = {}) => {
        const { date_from, date_to, account_id, txn_direction } = params;
        return client.get('/finance/transactions/export', {
            params: { date_from, date_to, account_id, txn_direction },
            responseType: 'blob'
        });
    },

    createTransaction: async (transactionData) => {
        return client.post('/finance/transactions', transactionData);
    },

    getTransaction: async (txnId) => {
        return client.get(`/finance/transactions/${txnId}`);
    },

    updateTransaction: async (txnId, data) => {
        return client.patch(`/finance/transactions/${txnId}`, data);
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
