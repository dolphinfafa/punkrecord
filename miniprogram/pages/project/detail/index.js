const {
  getProjectDetail,
  listProjectStages,
  listProjectMembers,
  listProjectTodos,
  addProjectMember,
  removeProjectMember,
} = require('../../../services/project');
const { listUsers } = require('../../../services/iam');
const { getToken } = require('../../../utils/storage');
const { getCurrentUser } = require('../../../services/auth');

function listItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload) return [];
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

Page({
  data: {
    id: '',
    loading: false,
    project: null,
    stages: [],
    members: [],
    todos: [],
    activeTab: 'overview',
    tabs: [
      { key: 'overview', label: '概览' },
      { key: 'stages', label: '阶段' },
      { key: 'members', label: '成员' },
      { key: 'todos', label: '任务' },
    ],
    stageAttachments: [],
    showStageAttachments: false,

    canManageMembers: false,
    addingMember: false,
    removingMemberId: '',
    userOptions: [],
    selectedUserIndex: 0,
  },

  onLoad(query) {
    this.setData({ id: (query && query.id) || '' });
  },

  onShow() {
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData().finally(() => wx.stopPullDownRefresh());
  },

  onTabTap(e) {
    const tab = e.currentTarget.dataset.tab;
    if (!tab || tab === this.data.activeTab) return;
    this.setData({ activeTab: tab });
  },

  toggleStageAttachments() {
    this.setData({ showStageAttachments: !this.data.showStageAttachments });
  },

  onUserPickerChange(e) {
    const idx = Number(e.detail.value || 0);
    this.setData({ selectedUserIndex: Number.isFinite(idx) ? idx : 0 });
  },

  async onAddMemberTap() {
    if (!this.data.canManageMembers || this.data.addingMember) return;
    const options = this.data.userOptions;
    if (!options.length) {
      wx.showToast({ title: '暂无可添加成员', icon: 'none' });
      return;
    }
    const selected = options[this.data.selectedUserIndex] || options[0];
    if (!selected || !selected.id) return;

    this.setData({ addingMember: true });
    try {
      await addProjectMember(this.data.id, selected.id);
      wx.showToast({ title: '成员已添加', icon: 'success' });
      await this.loadMembersAndUsers();
    } catch (e) {
      // Request layer already handles toasts.
    } finally {
      this.setData({ addingMember: false });
    }
  },

  async onRemoveMemberTap(e) {
    if (!this.data.canManageMembers || this.data.removingMemberId) return;
    const userId = e.currentTarget.dataset.userId;
    if (!userId) return;

    const project = this.data.project || {};
    if (String(userId) === String(project.pm_user_id) || String(userId) === String(project.owner_user_id)) {
      wx.showToast({ title: '项目负责人不可移除', icon: 'none' });
      return;
    }

    this.setData({ removingMemberId: userId });
    try {
      await removeProjectMember(this.data.id, userId);
      wx.showToast({ title: '成员已移除', icon: 'success' });
      await this.loadMembersAndUsers();
    } catch (e) {
      // Request layer already handles toasts.
    } finally {
      this.setData({ removingMemberId: '' });
    }
  },

  async onStageAttachmentTap(e) {
    const stageId = e.currentTarget.dataset.stageId;
    const attachmentId = e.currentTarget.dataset.attachmentId;
    const fileName = e.currentTarget.dataset.fileName || '附件';
    if (!stageId || !attachmentId) return;

    const app = getApp();
    const token = getToken();
    const baseURL = app && app.globalData ? app.globalData.baseURL : '';
    if (!baseURL) {
      wx.showToast({ title: '未配置服务地址', icon: 'none' });
      return;
    }

    const url = `${baseURL}/project/projects/${this.data.id}/stages/${stageId}/attachments/${attachmentId}/download`;
    wx.showLoading({ title: '下载中...' });
    wx.downloadFile({
      url,
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300 && res.tempFilePath) {
          wx.openDocument({
            filePath: res.tempFilePath,
            showMenu: true,
            fail: () => {
              wx.showToast({ title: `已下载：${fileName}`, icon: 'none' });
            },
          });
          return;
        }
        wx.showToast({ title: '附件下载失败', icon: 'none' });
      },
      fail: () => {
        wx.showToast({ title: '附件下载失败', icon: 'none' });
      },
      complete: () => wx.hideLoading(),
    });
  },

  onStageActionTap(e) {
    const action = e.currentTarget.dataset.action;
    if (!action || action === 'none') return;

    if (action === 'dev_progress' || action === 'bug_manage') {
      this.setData({ activeTab: 'todos' });
      wx.showToast({ title: '已切到任务列表查看执行进度', icon: 'none' });
      return;
    }

    if (action === 'acceptance_report') {
      this.downloadAcceptanceReport();
      return;
    }

    if (action === 'ai_contract') {
      wx.navigateTo({ url: '/pages/contract/index' });
      return;
    }

    if (action === 'feature_list' || action === 'quote_sheet' || action === 'prototype_confirm') {
      wx.showToast({ title: '该操作暂需在 Web 端执行', icon: 'none' });
      return;
    }

    wx.showToast({ title: '该操作暂未开放', icon: 'none' });
  },

  async loadData() {
    const projectId = this.data.id;
    if (!projectId) {
      wx.showToast({ title: '缺少项目ID', icon: 'none' });
      return;
    }

    this.setData({ loading: true });
    try {
      const [project, stages, todos] = await Promise.all([
        getProjectDetail(projectId),
        listProjectStages(projectId),
        listProjectTodos(projectId),
      ]);

      const normalizedProject = this.normalizeProject(project);
      const normalizedStages = listItems(stages).map((item) => this.normalizeStage(item, normalizedProject));
      const stageAttachments = [];
      normalizedStages.forEach((stage) => {
        (stage.attachments || []).forEach((file) => {
          stageAttachments.push({
            ...file,
            stage_name: stage.stage_name,
            stage_code: stage.stage_code,
          });
        });
      });

      this.setData({
        project: normalizedProject,
        stages: normalizedStages,
        stageAttachments,
        todos: listItems(todos).map((item) => this.normalizeTodo(item)),
      });

      await this.loadMembersAndUsers();
    } catch (e) {
      wx.showToast({ title: '项目详情加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  async loadMembersAndUsers() {
    const project = this.data.project || {};
    const [members, users] = await Promise.all([
      listProjectMembers(this.data.id),
      listUsers(1, 100),
    ]);

    const memberRows = listItems(members).map((item) => this.normalizeMember(item));
    const userRows = listItems(users);

    const memberIdSet = new Set(memberRows.map((item) => String(item.user_id)));
    const options = userRows
      .filter((item) => !memberIdSet.has(String(item.id)))
      .map((item) => ({
        id: item.id,
        label: item.display_name || item.username || item.email || String(item.id),
      }));

    const app = getApp();
    let currentUser = app && app.globalData ? app.globalData.user : null;
    if (!currentUser || !currentUser.id) {
      try {
        currentUser = await getCurrentUser();
        if (app && app.globalData) app.globalData.user = currentUser;
      } catch (e) {
        currentUser = null;
      }
    }
    const currentId = currentUser && currentUser.id ? String(currentUser.id) : '';
    const canManage = currentId && (
      currentId === String(project.pm_user_id || '') ||
      currentId === String(project.owner_user_id || '')
    );

    this.setData({
      members: memberRows,
      userOptions: options,
      selectedUserIndex: 0,
      canManageMembers: !!canManage,
    });
  },

  normalizeProject(item) {
    if (!item) return null;
    const progress = this.normalizeProgress(item.progress);
    return {
      ...item,
      nameText: item.name || '未命名项目',
      projectNoText: item.project_no || '-',
      typeText: this.formatType(item.project_type),
      statusLabel: this.formatProjectStatus(item.status),
      pmText: item.pm_name || '-',
      startText: item.start_at || '未设置',
      dueText: item.due_at || '未设置',
      progressText: `${Math.round(progress * 100)}%`,
      progressWidth: `${Math.round(progress * 100)}%`,
      descText: item.description || '暂无描述',
    };
  },

  normalizeStage(item, project) {
    const status = String(item.status || '').toLowerCase();
    const dateText = `${item.planned_start_at || '-'} ~ ${item.planned_end_at || '-'}`;
    const attachments = Array.isArray(item.attachments)
      ? item.attachments.map((file) => ({ ...file, stageId: item.id }))
      : [];
    const stageCode = String(item.stage_code || '').toLowerCase();
    const action = this.mapStageAction(stageCode, project);
    return {
      ...item,
      status,
      statusLabel: this.formatStageStatus(status),
      dateText,
      attachments,
      attachmentCount: attachments.length,
      actionLabel: action.label,
      actionKey: action.key,
    };
  },

  mapStageAction(stageCode, project) {
    const projectType = String((project && project.project_type) || '').toLowerCase();
    if (stageCode === 'requirement_alignment' && projectType === 'b2b') {
      return { key: 'feature_list', label: '功能清单' };
    }
    if (stageCode === 'project_initiation' && projectType === 'b2c') {
      return { key: 'feature_list', label: '功能清单' };
    }
    if (stageCode === 'quotation' && projectType === 'b2b') {
      return { key: 'quote_sheet', label: '报价单' };
    }
    if (stageCode === 'contract_signed') {
      return { key: 'ai_contract', label: 'AI生成合同' };
    }
    if (stageCode === 'prototype_confirmed') {
      return { key: 'prototype_confirm', label: '原型确认单' };
    }
    if (stageCode === 'development') {
      return { key: 'dev_progress', label: '开发进度' };
    }
    if (stageCode === 'testing') {
      return { key: 'bug_manage', label: 'Bug管理' };
    }
    if (stageCode === 'delivery') {
      return { key: 'acceptance_report', label: '验收报告' };
    }
    return { key: 'none', label: '-' };
  },

  normalizeMember(item) {
    const name = item.user_name || item.user_email || '成员';
    return {
      ...item,
      nameText: name,
      roleText: item.role_in_project || '项目成员',
      initial: String(name).slice(0, 1).toUpperCase(),
      canRemove: String(item.user_id) !== String((this.data.project || {}).pm_user_id || '') &&
        String(item.user_id) !== String((this.data.project || {}).owner_user_id || ''),
    };
  },

  normalizeTodo(item) {
    const status = String(item.status || '').toLowerCase();
    const priority = String(item.priority || '').toUpperCase();
    return {
      ...item,
      status,
      statusLabel: this.formatTodoStatus(status),
      priorityText: priority || 'P2',
      titleText: item.title || '未命名任务',
      assigneeText: item.assignee_name || '-',
      dueText: this.formatDate(item.due_at),
    };
  },

  normalizeProgress(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return 0;
    if (num > 1) return Math.min(num / 100, 1);
    return Math.max(0, Math.min(num, 1));
  },

  formatType(type) {
    const value = String(type || '').toLowerCase();
    const map = { b2b: 'B2B', b2c: 'B2C' };
    return map[value] || (type || '未设置');
  },

  formatProjectStatus(status) {
    const map = {
      draft: '草稿',
      active: '进行中',
      paused: '已暂停',
      closed: '已关闭',
      cancelled: '已取消',
      planning: '规划中',
      in_progress: '进行中',
      done: '已完成',
    };
    return map[String(status || '').toLowerCase()] || '未知';
  },

  formatStageStatus(status) {
    const map = {
      not_started: '未开始',
      in_progress: '进行中',
      blocked: '阻塞',
      done: '已完成',
      skipped: '已跳过',
    };
    return map[status] || '未知';
  },

  formatTodoStatus(status) {
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

  formatDate(value) {
    if (!value) return '未设置';
    const text = String(value);
    return text.includes('T') ? text.replace('T', ' ').slice(0, 16) : text;
  },

  async downloadAcceptanceReport() {
    const app = getApp();
    const token = getToken();
    const baseURL = app && app.globalData ? app.globalData.baseURL : '';
    if (!baseURL) {
      wx.showToast({ title: '未配置服务地址', icon: 'none' });
      return;
    }
    const url = `${baseURL}/project/projects/${this.data.id}/acceptance-report/download`;
    wx.showLoading({ title: '下载中...' });
    wx.downloadFile({
      url,
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300 && res.tempFilePath) {
          wx.openDocument({
            filePath: res.tempFilePath,
            showMenu: true,
            fail: () => wx.showToast({ title: '已下载验收报告', icon: 'none' }),
          });
          return;
        }
        wx.showToast({ title: '验收报告下载失败', icon: 'none' });
      },
      fail: () => wx.showToast({ title: '验收报告下载失败', icon: 'none' }),
      complete: () => wx.hideLoading(),
    });
  },
});
