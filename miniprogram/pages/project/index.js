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
    keyword: '',
    activeStatus: 'all',
    statusTabs: [
      { key: 'all', label: '全部' },
      { key: 'draft', label: '草稿' },
      { key: 'active', label: '进行中' },
      { key: 'paused', label: '已暂停' },
      { key: 'closed', label: '已关闭' },
      { key: 'cancelled', label: '已取消' },
    ],
    stats: {
      total: 0,
      active: 0,
      paused: 0,
      closed: 0,
    },
  },

  onShow() { this.load(); },

  onPullDownRefresh() {
    this.load().finally(() => wx.stopPullDownRefresh());
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value || '' });
    this.applyFilters();
  },

  clearKeyword() {
    this.setData({ keyword: '' });
    this.applyFilters();
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
      const payload = await listProjects(1, 80);
      const projects = listItems(payload).map((item) => this.normalizeProject(item));
      this.setData({ projects, stats: this.buildStats(projects) });
      this.applyFilters();
    } catch (e) {
      this.setData({
        projects: [],
        displayProjects: [],
        stats: { total: 0, active: 0, paused: 0, closed: 0 },
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  applyFilters() {
    const activeStatus = this.data.activeStatus;
    const keyword = (this.data.keyword || '').trim().toLowerCase();

    let rows = this.data.projects.slice();
    if (activeStatus !== 'all') {
      rows = rows.filter((item) => item.status === activeStatus);
    }
    if (keyword) {
      rows = rows.filter((item) => {
        const text = `${item.nameText} ${item.projectNoText} ${item.pmText}`.toLowerCase();
        return text.includes(keyword);
      });
    }

    this.setData({ displayProjects: rows });
  },

  normalizeProject(item) {
    const status = this.normalizeStatus(item.status || 'unknown');
    const progress = this.normalizeProgress(item.progress);
    return {
      ...item,
      status,
      statusLabel: this.formatStatus(status),
      nameText: item.name || '未命名项目',
      typeText: this.formatType(item.project_type || item.type || ''),
      projectNoText: item.project_no || '-',
      pmText: item.pm_name || '-',
      dueText: item.due_at || '未设置',
      progressText: `${Math.round(progress * 100)}%`,
      progressWidth: `${Math.round(progress * 100)}%`,
    };
  },

  normalizeStatus(status) {
    const value = String(status || '').toLowerCase();
    const map = {
      planning: 'draft',
      in_progress: 'active',
      done: 'closed',
      draft: 'draft',
      active: 'active',
      paused: 'paused',
      closed: 'closed',
      cancelled: 'cancelled',
    };
    return map[value] || value || 'unknown';
  },

  normalizeProgress(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return 0;
    if (num > 1) return Math.min(num / 100, 1);
    return Math.max(0, Math.min(num, 1));
  },

  buildStats(projects) {
    return {
      total: projects.length,
      active: projects.filter((item) => item.status === 'active').length,
      paused: projects.filter((item) => item.status === 'paused').length,
      closed: projects.filter((item) => item.status === 'closed').length,
    };
  },

  formatStatus(status) {
    const map = {
      draft: '草稿',
      active: '进行中',
      paused: '已暂停',
      closed: '已关闭',
      cancelled: '已取消',
    };
    return map[status] || '未知';
  },

  formatType(type) {
    const value = String(type || '').toLowerCase();
    const map = { b2b: 'B2B', b2c: 'B2C' };
    return map[value] || (type || '未设置');
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/project/detail/index?id=${id}` });
  },
});
