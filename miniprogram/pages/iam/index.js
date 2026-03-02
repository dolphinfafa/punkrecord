const { listUsers } = require('../../services/iam');

function listItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload) return [];
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

Page({
  data: { users: [] },
  onShow() { this.load(); },
  async load() {
    try {
      const payload = await listUsers(1, 50);
      this.setData({ users: listItems(payload) });
    } catch (e) {}
  },
});
