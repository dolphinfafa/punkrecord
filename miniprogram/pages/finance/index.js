const { listAccounts, listTransactions } = require('../../services/finance');

function listItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload) return [];
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

Page({
  data: { accounts: [], transactions: [] },
  onShow() { this.load(); },
  onPullDownRefresh() {
    this.load().finally(() => wx.stopPullDownRefresh());
  },
  async load() {
    try {
      const [accounts, txns] = await Promise.all([
        listAccounts(),
        listTransactions(1, 20),
      ]);
      this.setData({
        accounts: listItems(accounts),
        transactions: listItems(txns),
      });
    } catch (e) {}
  },
});
