const request = require('../utils/request');

function listMyTodos(page = 1, page_size = 20, status = '') {
  const data = { page, page_size };
  if (status) data.status = status;
  return request({ url: '/todo/my', data });
}

function listTeamPendingLeaves() {
  return request({ url: '/todo/leaves/team/pending' });
}

function startTodo(todoId) {
  return request({ url: `/todo/${todoId}/start`, method: 'POST' });
}

function markTodoDone(todoId) {
  return request({ url: `/todo/${todoId}/done`, method: 'POST' });
}

module.exports = {
  listMyTodos,
  listTeamPendingLeaves,
  startTodo,
  markTodoDone,
};
