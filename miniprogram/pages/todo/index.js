const { listMyTodos } = require('../../services/todo');

function listItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload) return [];
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

Page({
  data: { todos: [] },
  onShow() { this.loadTodos(); },
  onPullDownRefresh() {
    this.loadTodos().finally(() => wx.stopPullDownRefresh());
  },
  async loadTodos() {
    try {
      const payload = await listMyTodos(1, 50);
      this.setData({ todos: listItems(payload) });
    } catch (e) {}
  },
});
