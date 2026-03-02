const { listMyTodos, startTodo, markTodoDone } = require('../../services/todo');

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
    todos: [],
    displayTodos: [],
    keyword: '',
    activeStatus: 'all',
    statusTabs: [
      { key: 'all', label: '全部' },
      { key: 'open', label: '未开始' },
      { key: 'in_progress', label: '进行中' },
      { key: 'pending_review', label: '待审核' },
      { key: 'done', label: '已完成' },
      { key: 'blocked', label: '阻塞' },
    ],
    actionBusyId: '',
  },
  onShow() { this.loadTodos(); },
  onPullDownRefresh() {
    this.loadTodos().finally(() => wx.stopPullDownRefresh());
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
    this.loadTodos();
  },
  async loadTodos() {
    this.setData({ loading: true });
    try {
      const status = this.data.activeStatus === 'all' ? '' : this.data.activeStatus;
      const payload = await listMyTodos(1, 80, status);
      const todos = listItems(payload).map((item) => this.normalizeTodo(item));
      this.setData({ todos });
      this.applyFilters();
    } catch (e) {
      this.setData({ todos: [], displayTodos: [] });
    } finally {
      this.setData({ loading: false });
    }
  },
  applyFilters() {
    const keyword = (this.data.keyword || '').trim().toLowerCase();
    let rows = this.data.todos.slice();
    if (keyword) {
      rows = rows.filter((item) => {
        const text = `${item.titleText} ${item.descriptionText}`.toLowerCase();
        return text.includes(keyword);
      });
    }
    this.setData({ displayTodos: rows });
  },
  normalizeTodo(item) {
    const status = item.status || 'unknown';
    const priority = item.priority || '';
    return {
      ...item,
      status,
      statusLabel: this.formatStatus(status),
      titleText: item.title || '未命名待办',
      descriptionText: item.description || '',
      priorityText: this.formatPriority(priority),
      dueText: this.formatDate(item.due_at || item.due_date),
      canStart: status === 'open',
      canDone: status === 'open' || status === 'in_progress' || status === 'blocked',
    };
  },
  formatStatus(status) {
    const map = {
      open: '未开始',
      in_progress: '进行中',
      pending_review: '待审核',
      done: '已完成',
      blocked: '阻塞',
      dismissed: '已关闭',
    };
    return map[status] || '未知';
  },
  formatPriority(priority) {
    const value = String(priority || '').toLowerCase();
    const map = { p0: 'P0', p1: 'P1', p2: 'P2', p3: 'P3' };
    return map[value] || (priority ? String(priority) : '未设置');
  },
  formatDate(value) {
    if (!value) return '未设置';
    const text = String(value);
    return text.includes('T') ? text.replace('T', ' ').slice(0, 16) : text;
  },
  async onStartTap(e) {
    const todoId = e.currentTarget.dataset.id;
    if (!todoId || this.data.actionBusyId) return;
    this.setData({ actionBusyId: todoId });
    try {
      await startTodo(todoId);
      wx.showToast({ title: '已开始', icon: 'success' });
      await this.loadTodos();
    } catch (err) {
      // Request layer already toasts message.
    } finally {
      this.setData({ actionBusyId: '' });
    }
  },
  async onDoneTap(e) {
    const todoId = e.currentTarget.dataset.id;
    if (!todoId || this.data.actionBusyId) return;
    this.setData({ actionBusyId: todoId });
    try {
      await markTodoDone(todoId);
      wx.showToast({ title: '已更新', icon: 'success' });
      await this.loadTodos();
    } catch (err) {
      // Request layer already toasts message.
    } finally {
      this.setData({ actionBusyId: '' });
    }
  },
});
