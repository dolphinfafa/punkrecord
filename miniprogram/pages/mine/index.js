const { clearSession, getUser } = require('../../utils/storage');

Page({
  data: {
    name: '',
    username: '',
    initial: 'G',
  },
  onShow() {
    const user = getUser();
    const name = (user && (user.real_name || user.username)) || '';
    const username = (user && user.username) || '';
    const initial = (name || username || 'G').slice(0, 1).toUpperCase();
    this.setData({ name, username, initial });
  },
  goContract() { wx.navigateTo({ url: '/pages/contract/index' }); },
  goIAM() { wx.navigateTo({ url: '/pages/iam/index' }); },
  logout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出当前账号吗？',
      success: (res) => {
        if (!res.confirm) return;
        clearSession();
        wx.reLaunch({ url: '/pages/login/index' });
      },
    });
  },
});
