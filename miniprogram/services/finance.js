const request = require('../utils/request');

function listAccounts() {
  return request({ url: '/finance/accounts', data: { page: 1, page_size: 50 } });
}

function listTransactions(page = 1, page_size = 20) {
  return request({ url: '/finance/transactions', data: { page, page_size } });
}

module.exports = {
  listAccounts,
  listTransactions,
};
