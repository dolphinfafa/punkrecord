const request = require('../utils/request');

function listUsers(page = 1, page_size = 20) {
  return request({ url: '/iam/users', data: { page, page_size } });
}

module.exports = {
  listUsers,
};
