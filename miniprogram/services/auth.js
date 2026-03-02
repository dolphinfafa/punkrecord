const request = require('../utils/request');

function login(username, password) {
  return request({
    url: '/auth/login',
    method: 'POST',
    data: { username, password },
  });
}

function getCurrentUser() {
  return request({
    url: '/auth/me',
    method: 'GET',
  });
}

module.exports = {
  login,
  getCurrentUser,
};
