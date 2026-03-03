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

function submitTodo(todoId) {
  return request({ url: `/todo/${todoId}/submit`, method: 'POST' });
}

function blockTodo(todoId, blockedReason = '任务受阻，待排查') {
  const reason = encodeURIComponent(blockedReason);
  return request({ url: `/todo/${todoId}/block?blocked_reason=${reason}`, method: 'POST' });
}

function recallTodo(todoId, comment = '撤回提交，继续处理') {
  return request({
    url: `/todo/${todoId}/status`,
    method: 'POST',
    data: { status: 'in_progress', comment },
  });
}

module.exports = {
  listMyTodos,
  listTeamPendingLeaves,
  startTodo,
  markTodoDone,
  submitTodo,
  blockTodo,
  recallTodo,
};
