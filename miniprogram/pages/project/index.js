const { listProjects } = require('../../services/project');

function listItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload) return [];
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

Page({
  data: {
    loading: false,
    projects: [],
    displayProjects: [],
    activeStatus: 'all',
    statusTabs: [
      { key: 'all', label: '全部' },
      { key: 'planning', label: '规划中' },
      { key: 'in_progress', label: '进行中' },
      { key: 'done', label: '已完成' },
      { key: 'paused', label: '已暂停' },
    ],
  },
  onShow() { this.load(); },
  onPullDownRefresh() {
    this.load().finally(() => wx.stopPullDownRefresh());
  },
  onStatusTabTap(e) {
    const status = e.currentTarget.dataset.status;
    if (status === this.data.activeStatus) return;
    this.setData({ activeStatus: status });
    this.applyFilters();
  },
  async load() {
    this.setData({ loading: true });
    try {
      const payload = await listProjects(1, 50);
      const projects = listItems(payload).map((item) => this.normalizeProject(item));
      this.setData({ projects });
      this.applyFilters();
    } catch (e) {
      this.setData({ projects: [], displayProjects: [] });
    } finally {
      this.setData({ loading: false });
    }
  },
  applyFilters() {
    let rows = this.data.projects.slice();
    if (this.data.activeStatus !== 'all') {
      rows = rows.filter((item) => item.status === this.data.activeStatus);
    }
    this.setData({ displayProjects: rows });
  },
  normalizeProject(item) {
    const status = item.status || 'unknown';
    return {
      ...item,
      nameText: item.name || '未命名项目',
      status,
      statusLabel: this.formatStatus(status),
      typeText: item.type || item.project_type || '未设置',
      budgetText: item.budget === undefined || item.budget === null ? '未设置' : item.budget,
    };
  },
  formatStatus(status) {
    const map = {
      planning: '规划中',
      in_progress: '进行中',
      done: '已完成',
      paused: '已暂停',
      cancelled: '已取消',
    };
    return map[status] || '未知';
  },
});
