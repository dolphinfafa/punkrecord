const request = require('../utils/request');

function listProjects(page = 1, page_size = 20) {
  return request({ url: '/project/projects', data: { page, page_size } });
}

function getProjectDetail(projectId) {
  return request({ url: `/project/projects/${projectId}` });
}

function listProjectStages(projectId) {
  return request({ url: `/project/projects/${projectId}/stages` });
}

function listProjectMembers(projectId) {
  return request({ url: `/project/projects/${projectId}/members` });
}

function listProjectTodos(projectId) {
  return request({ url: `/project/projects/${projectId}/todos` });
}

function addProjectMember(projectId, userId, roleInProject = '') {
  const data = { user_id: userId };
  if (roleInProject) data.role_in_project = roleInProject;
  return request({
    url: `/project/projects/${projectId}/members`,
    method: 'POST',
    data,
  });
}

function removeProjectMember(projectId, userId) {
  return request({
    url: `/project/projects/${projectId}/members/${userId}`,
    method: 'DELETE',
  });
}

module.exports = {
  listProjects,
  getProjectDetail,
  listProjectStages,
  listProjectMembers,
  listProjectTodos,
  addProjectMember,
  removeProjectMember,
};
