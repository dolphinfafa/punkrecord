const { clearSession, getUser, getToken, setSession } = require('../../utils/storage');
const { getCurrentUser } = require('../../services/auth');

Page({
  data: {
    name: '',
    username: '',
    initial: 'G',
  },
  async onShow() {
    let user = getUser();
    const token = getToken();
    if (!user && token) {
      try {
        user = await getCurrentUser();
        setSession(token, user);
      } catch (e) {
        // keep guest fallback
      }
    }
    const name = (user && (user.display_name || user.real_name || user.username)) || '';
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
