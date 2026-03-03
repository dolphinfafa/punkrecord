const request = require('../utils/request');

function listMyTodos(page = 1, page_size = 20, status = '') {
  const data = { page, page_size };
  if (status) data.status = status;
  return request({ url: '/todo/my', data });
}

function listTeamTodos(page = 1, page_size = 20, status = '') {
  const data = { page, page_size };
  if (status) data.status = status;
  return request({ url: '/todo/team', data });
}

function listTeamPendingLeaves() {
  return request({ url: '/todo/leaves/team/pending' });
}

function startTodo(todoId) {
  return request({ url: `/todo/${todoId}/start`, method: 'POST' });
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

function approveTodo(todoId, comment = '通过') {
  return request({
    url: `/todo/${todoId}/approve`,
    method: 'POST',
    data: { comment },
  });
}

function rejectTodo(todoId, comment = '请修改后重新提交') {
  return request({
    url: `/todo/${todoId}/reject`,
    method: 'POST',
    data: { comment },
  });
}

function createLeave(payload) {
  return request({
    url: '/todo/leaves',
    method: 'POST',
    data: payload,
  });
}

function listMyLeaves(page = 1, page_size = 20, status = '') {
  const data = { page, page_size };
  if (status) data.status = status;
  return request({ url: '/todo/leaves/my', data });
}

function approveLeave(leaveId) {
  return request({ url: `/todo/leaves/${leaveId}/approve`, method: 'POST' });
}

function rejectLeave(leaveId, comment = '请假申请未通过') {
  return request({
    url: `/todo/leaves/${leaveId}/reject`,
    method: 'POST',
    data: { comment },
  });
}

module.exports = {
  listMyTodos,
  listTeamTodos,
  listTeamPendingLeaves,
  startTodo,
  submitTodo,
  blockTodo,
  recallTodo,
  approveTodo,
  rejectTodo,
  createLeave,
  listMyLeaves,
  approveLeave,
  rejectLeave,
};
