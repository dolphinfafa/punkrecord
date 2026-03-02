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
      const users = listItems(payload).map((item) => ({
        ...item,
        nameText: item.real_name || item.username || '未命名用户',
        statusText: this.formatStatus(item.status),
        emailText: item.email || '未填写邮箱',
      }));
      this.setData({ users });
    } catch (e) {}
  },
  formatStatus(status) {
    const map = {
      active: '在职',
      inactive: '停用',
      suspended: '冻结',
      pending: '待激活',
    };
    return map[String(status || '').toLowerCase()] || '未知';
  },
});
