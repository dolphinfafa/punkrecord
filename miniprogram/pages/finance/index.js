const { listAccounts, listTransactions } = require('../../services/finance');

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
    accounts: [],
    transactions: [],
    activeTab: 'transactions',
    totalBalance: 0,
    incomingTotal: 0,
    outgoingTotal: 0,
  },
  onShow() { this.load(); },
  onPullDownRefresh() {
    this.load().finally(() => wx.stopPullDownRefresh());
  },
  onTabTap(e) {
    const tab = e.currentTarget.dataset.tab;
    if (!tab || tab === this.data.activeTab) return;
    this.setData({ activeTab: tab });
  },
  async load() {
    this.setData({ loading: true });
    try {
      const [accounts, txns] = await Promise.all([
        listAccounts(),
        listTransactions(1, 20),
      ]);
      const accountItems = listItems(accounts).map((item) => ({
        ...item,
        nameText: item.name || '未命名账户',
        balanceText: this.toNumber(item.balance),
      }));
      const transactionItems = listItems(txns).map((item) => this.normalizeTxn(item));
      const totals = this.computeTotals(accountItems, transactionItems);
      this.setData({
        accounts: accountItems,
        transactions: transactionItems,
        totalBalance: totals.totalBalance,
        incomingTotal: totals.incomingTotal,
        outgoingTotal: totals.outgoingTotal,
      });
    } catch (e) {
      this.setData({
        accounts: [],
        transactions: [],
        totalBalance: 0,
        incomingTotal: 0,
        outgoingTotal: 0,
      });
    } finally {
      this.setData({ loading: false });
    }
  },
  normalizeTxn(item) {
    const direction = String(item.direction || item.txn_direction || '').toLowerCase();
    const amount = this.toNumber(item.amount);
    const isIncome = direction === 'in' || direction === 'income';
    const sign = isIncome ? '+' : '-';
    return {
      ...item,
      titleText: item.description || '无说明',
      directionLabel: this.formatDirection(direction),
      amountValue: amount,
      amountText: `${sign}${amount.toFixed(2)}`,
      dateText: item.txn_date || '未设置',
      directionClass: isIncome ? 'in' : 'out',
    };
  },
  formatDirection(direction) {
    const map = { in: '收入', income: '收入', out: '支出', expense: '支出' };
    return map[direction] || '未知';
  },
  computeTotals(accounts, transactions) {
    let totalBalance = 0;
    let incomingTotal = 0;
    let outgoingTotal = 0;
    accounts.forEach((item) => {
      totalBalance += this.toNumber(item.balanceText);
    });
    transactions.forEach((item) => {
      if (item.directionClass === 'in') incomingTotal += item.amountValue;
      else outgoingTotal += item.amountValue;
    });
    return { totalBalance, incomingTotal, outgoingTotal };
  },
  toNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  },
});
