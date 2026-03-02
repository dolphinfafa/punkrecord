const { listContracts } = require('../../services/contract');

function listItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload) return [];
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

Page({
  data: { contracts: [] },
  onShow() { this.load(); },
  async load() {
    try {
      const payload = await listContracts(1, 50);
      const contracts = listItems(payload).map((item) => ({
        ...item,
        titleText: item.title || '未命名合同',
        statusText: this.formatStatus(item.status),
        amountText: item.amount === undefined || item.amount === null ? '未设置' : item.amount,
      }));
      this.setData({ contracts });
    } catch (e) {}
  },
  formatStatus(status) {
    const map = {
      draft: '草稿',
      submitted: '已提交',
      approved: '已批准',
      rejected: '已驳回',
      active: '履行中',
      completed: '已完成',
      cancelled: '已取消',
    };
    return map[String(status || '').toLowerCase()] || '未知';
  },
});
