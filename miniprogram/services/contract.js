const request = require('../utils/request');

function listContracts(page = 1, page_size = 20) {
  return request({ url: '/contract/contracts', data: { page, page_size } });
}

module.exports = {
  listContracts,
};
