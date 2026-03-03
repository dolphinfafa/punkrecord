const {
  listMyTodos,
  listTeamTodos,
  startTodo,
  submitTodo,
  blockTodo,
  recallTodo,
  approveTodo,
  rejectTodo,
  createLeave,
  listMyLeaves,
  listTeamPendingLeaves,
  approveLeave,
  rejectLeave,
} = require('../../services/todo');
const { getCurrentUser } = require('../../services/auth');

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
    scopeTabs: [
      { key: 'my', label: '我的待办' },
      { key: 'team', label: '团队待办' },
    ],
    activeScope: 'my',
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

    leaveSubmitting: false,
    leaveReviewingId: '',
    leaveType: 'annual',
    leaveTypes: [
      { key: 'annual', label: '年假' },
      { key: 'maternity', label: '产假' },
      { key: 'marriage', label: '婚假' },
      { key: 'sick', label: '病假' },
      { key: 'personal', label: '事假' },
    ],
    leaveStartDate: '',
    leaveEndDate: '',
    leaveReason: '',
    myLeaves: [],
    teamPendingLeaves: [],
    myProfile: null,
  },

  onShow() {
    this.loadPageData();
  },

  onPullDownRefresh() {
    this.loadPageData().finally(() => wx.stopPullDownRefresh());
  },

  async loadPageData() {
    this.setData({ loading: true });
    try {
      await this.loadLeavePanels();
      await this.loadTodos();
    } finally {
      this.setData({ loading: false });
    }
  },

  onScopeTabTap(e) {
    const scope = e.currentTarget.dataset.scope;
    if (!scope || scope === this.data.activeScope) return;
    this.setData({ activeScope: scope });
    this.loadTodos();
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
    try {
      const status = this.data.activeStatus === 'all' ? '' : this.data.activeStatus;
      const payload = this.data.activeScope === 'team'
        ? await listTeamTodos(1, 80, status)
        : await listMyTodos(1, 80, status);
      const todos = listItems(payload).map((item) => this.normalizeTodo(item));
      this.setData({ todos });
      this.applyFilters();
    } catch (e) {
      this.setData({ todos: [], displayTodos: [] });
    }
  },

  applyFilters() {
    const keyword = (this.data.keyword || '').trim().toLowerCase();
    let rows = this.data.todos.slice();
    if (keyword) {
      rows = rows.filter((item) => {
        const text = `${item.titleText} ${item.descriptionText} ${item.assigneeText}`.toLowerCase();
        return text.includes(keyword);
      });
    }
    this.setData({ displayTodos: rows });
  },

  normalizeTodo(item) {
    const status = item.status || 'unknown';
    const priority = item.priority || '';
    const isMineScope = this.data.activeScope === 'my';
    const currentUserId = this.data.myProfile && this.data.myProfile.id ? String(this.data.myProfile.id) : '';
    const creatorUserId = item.creator_user_id ? String(item.creator_user_id) : '';
    const canReview = !isMineScope && status === 'pending_review' && currentUserId && creatorUserId === currentUserId;
    return {
      ...item,
      status,
      statusLabel: this.formatStatus(status),
      titleText: item.title || '未命名待办',
      descriptionText: item.description || '',
      priorityText: this.formatPriority(priority),
      dueText: this.formatDate(item.due_at || item.due_date),
      assigneeText: item.assignee_name || '',
      canStart: isMineScope && status === 'open',
      canSubmit: isMineScope && (status === 'open' || status === 'in_progress' || status === 'blocked'),
      canBlock: isMineScope && (status === 'open' || status === 'in_progress'),
      canRecall: isMineScope && status === 'pending_review',
      canApprove: !!canReview,
      canReject: !!canReview,
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

  formatLeaveType(type) {
    const map = {
      annual: '年假',
      maternity: '产假',
      marriage: '婚假',
      sick: '病假',
      personal: '事假',
    };
    return map[type] || '其他';
  },

  formatLeaveStatus(status) {
    const map = {
      pending: '待审批',
      approved: '已通过',
      rejected: '已驳回',
      cancelled: '已取消',
    };
    return map[status] || '未知';
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

  async onSubmitTap(e) {
    const todoId = e.currentTarget.dataset.id;
    if (!todoId || this.data.actionBusyId) return;
    this.setData({ actionBusyId: todoId });
    try {
      await submitTodo(todoId);
      wx.showToast({ title: '已提交', icon: 'success' });
      await this.loadTodos();
    } catch (err) {
      // Request layer already toasts message.
    } finally {
      this.setData({ actionBusyId: '' });
    }
  },

  async onBlockTap(e) {
    const todoId = e.currentTarget.dataset.id;
    if (!todoId || this.data.actionBusyId) return;
    this.setData({ actionBusyId: todoId });
    try {
      await blockTodo(todoId);
      wx.showToast({ title: '已标记阻塞', icon: 'success' });
      await this.loadTodos();
    } catch (err) {
      // Request layer already toasts message.
    } finally {
      this.setData({ actionBusyId: '' });
    }
  },

  async onRecallTap(e) {
    const todoId = e.currentTarget.dataset.id;
    if (!todoId || this.data.actionBusyId) return;
    this.setData({ actionBusyId: todoId });
    try {
      await recallTodo(todoId);
      wx.showToast({ title: '已撤回提交', icon: 'success' });
      await this.loadTodos();
    } catch (err) {
      // Request layer already toasts message.
    } finally {
      this.setData({ actionBusyId: '' });
    }
  },

  async onApproveTap(e) {
    const todoId = e.currentTarget.dataset.id;
    if (!todoId || this.data.actionBusyId) return;
    this.setData({ actionBusyId: todoId });
    try {
      await approveTodo(todoId, '通过');
      wx.showToast({ title: '已通过', icon: 'success' });
      await this.loadTodos();
    } catch (err) {
      // Request layer already toasts message.
    } finally {
      this.setData({ actionBusyId: '' });
    }
  },

  async onRejectTap(e) {
    const todoId = e.currentTarget.dataset.id;
    if (!todoId || this.data.actionBusyId) return;
    this.setData({ actionBusyId: todoId });
    try {
      await rejectTodo(todoId, '请修改后重新提交');
      wx.showToast({ title: '已驳回', icon: 'success' });
      await this.loadTodos();
    } catch (err) {
      // Request layer already toasts message.
    } finally {
      this.setData({ actionBusyId: '' });
    }
  },

  onLeaveTypeTap(e) {
    const type = e.currentTarget.dataset.type;
    if (!type || type === this.data.leaveType) return;
    this.setData({ leaveType: type });
  },

  onLeaveStartDateChange(e) {
    this.setData({ leaveStartDate: e.detail.value || '' });
  },

  onLeaveEndDateChange(e) {
    this.setData({ leaveEndDate: e.detail.value || '' });
  },

  onLeaveReasonInput(e) {
    this.setData({ leaveReason: e.detail.value || '' });
  },

  async onSubmitLeaveTap() {
    const { leaveType, leaveStartDate, leaveEndDate, leaveReason, leaveSubmitting, myProfile } = this.data;
    if (leaveSubmitting) return;
    if (myProfile && Number(myProfile.level) === 0) {
      wx.showToast({ title: 'L0 级别无需请假', icon: 'none' });
      return;
    }
    if (!leaveStartDate || !leaveEndDate) {
      wx.showToast({ title: '请选择请假日期', icon: 'none' });
      return;
    }
    if (leaveStartDate > leaveEndDate) {
      wx.showToast({ title: '结束日期不能早于开始日期', icon: 'none' });
      return;
    }

    this.setData({ leaveSubmitting: true });
    try {
      await createLeave({
        leave_type: leaveType,
        start_at: `${leaveStartDate}T09:00:00`,
        end_at: `${leaveEndDate}T18:00:00`,
        reason: leaveReason || null,
      });
      wx.showToast({ title: '请假已提交', icon: 'success' });
      this.setData({
        leaveStartDate: '',
        leaveEndDate: '',
        leaveReason: '',
      });
      await this.loadLeavePanels();
    } catch (err) {
      // Request layer already toasts message.
    } finally {
      this.setData({ leaveSubmitting: false });
    }
  },

  async loadLeavePanels() {
    try {
      const [myLeaves, teamPendingLeaves, profile] = await Promise.all([
        listMyLeaves(1, 5),
        listTeamPendingLeaves(),
        getCurrentUser(),
      ]);
      this.setData({
        myLeaves: listItems(myLeaves).map((item) => ({
          ...item,
          leaveTypeLabel: this.formatLeaveType(item.leave_type),
          leaveStatusLabel: this.formatLeaveStatus(item.status),
          rangeText: `${this.formatDate(item.start_at)} - ${this.formatDate(item.end_at)}`,
        })),
        teamPendingLeaves: listItems(teamPendingLeaves).map((item) => ({
          ...item,
          leaveTypeLabel: this.formatLeaveType(item.leave_type),
          rangeText: `${this.formatDate(item.start_at)} - ${this.formatDate(item.end_at)}`,
        })),
        myProfile: profile || null,
      });
    } catch (err) {
      this.setData({ myLeaves: [], teamPendingLeaves: [] });
    }
  },

  async onApproveLeaveTap(e) {
    const leaveId = e.currentTarget.dataset.id;
    if (!leaveId || this.data.leaveReviewingId) return;
    this.setData({ leaveReviewingId: leaveId });
    try {
      await approveLeave(leaveId);
      wx.showToast({ title: '已通过', icon: 'success' });
      await this.loadLeavePanels();
    } catch (err) {
      // Request layer already toasts message.
    } finally {
      this.setData({ leaveReviewingId: '' });
    }
  },

  async onRejectLeaveTap(e) {
    const leaveId = e.currentTarget.dataset.id;
    if (!leaveId || this.data.leaveReviewingId) return;
    this.setData({ leaveReviewingId: leaveId });
    try {
      await rejectLeave(leaveId, '请假申请未通过');
      wx.showToast({ title: '已驳回', icon: 'success' });
      await this.loadLeavePanels();
    } catch (err) {
      // Request layer already toasts message.
    } finally {
      this.setData({ leaveReviewingId: '' });
    }
  },
});
