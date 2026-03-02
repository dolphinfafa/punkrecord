const request = require('../utils/request');

function listMyTodos(page = 1, page_size = 20) {
  return request({ url: '/todo/my', data: { page, page_size } });
}

function listTeamPendingLeaves() {
  return request({ url: '/todo/leaves/team/pending' });
}

module.exports = {
  listMyTodos,
  listTeamPendingLeaves,
};
