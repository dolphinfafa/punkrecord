const { getUser } = require('../../utils/storage');
const { listMyTodos, listTeamPendingLeaves } = require('../../services/todo');
const { listProjects } = require('../../services/project');
const { listTransactions } = require('../../services/finance');

function listItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload) return [];
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

Page({
  data: {
    userName: '',
    todoCount: 0,
    projectCount: 0,
    txnCount: 0,
    pendingLeaveCount: 0,
  },
  onShow() {
    const user = getUser();
    this.setData({ userName: user && (user.real_name || user.username) ? (user.real_name || user.username) : '' });
    this.loadSummary();
  },
  async loadSummary() {
    try {
      const [todos, projects, txns, leaves] = await Promise.all([
        listMyTodos(1, 5),
        listProjects(1, 5),
        listTransactions(1, 5),
        listTeamPendingLeaves(),
      ]);
      this.setData({
        todoCount: listItems(todos).length,
        projectCount: listItems(projects).length,
        txnCount: listItems(txns).length,
        pendingLeaveCount: listItems(leaves).length,
      });
    } catch (e) {
      // Request layer already shows error toast.
    }
  },
  goTodo() { wx.switchTab({ url: '/pages/todo/index' }); },
  goProject() { wx.switchTab({ url: '/pages/project/index' }); },
  goFinance() { wx.switchTab({ url: '/pages/finance/index' }); },
  goMine() { wx.switchTab({ url: '/pages/mine/index' }); },
  goContract() { wx.navigateTo({ url: '/pages/contract/index' }); },
  goIAM() { wx.navigateTo({ url: '/pages/iam/index' }); },
});
