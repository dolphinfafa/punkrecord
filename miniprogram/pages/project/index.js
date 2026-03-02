const { listProjects } = require('../../services/project');

function listItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload) return [];
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

Page({
  data: { projects: [] },
  onShow() { this.load(); },
  onPullDownRefresh() {
    this.load().finally(() => wx.stopPullDownRefresh());
  },
  async load() {
    try {
      const payload = await listProjects(1, 50);
      this.setData({ projects: listItems(payload) });
    } catch (e) {}
  },
});
