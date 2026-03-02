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
      this.setData({ contracts: listItems(payload) });
    } catch (e) {}
  },
});
