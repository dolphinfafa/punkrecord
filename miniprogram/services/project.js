const request = require('../utils/request');

function listProjects(page = 1, page_size = 20) {
  return request({ url: '/project/projects', data: { page, page_size } });
}

module.exports = {
  listProjects,
};
