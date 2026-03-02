const { login, getCurrentUser } = require('../../services/auth');
const { setSession, getToken } = require('../../utils/storage');

Page({
  data: {
    username: '',
    password: '',
    loading: false,
  },
  onShow() {
    if (getToken()) {
      wx.switchTab({ url: '/pages/home/index' });
    }
  },
  onUsernameChange(e) {
    this.setData({ username: e.detail.value });
  },
  onPasswordChange(e) {
    this.setData({ password: e.detail.value });
  },
  async onLogin() {
    const { username, password } = this.data;
    if (!username || !password) {
      wx.showToast({ title: 'Username and password required', icon: 'none' });
      return;
    }
    this.setData({ loading: true });
    try {
      const result = await login(username, password);
      const token = result.access_token || result.token;
      if (!token) throw new Error('Invalid login response');
      let user = null;
      try {
        user = await getCurrentUser();
      } catch (e) {
        user = null;
      }
      setSession(token, user);
      getApp().globalData.user = user;
      wx.switchTab({ url: '/pages/home/index' });
    } catch (err) {
      wx.showToast({ title: err.message || 'Login failed', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },
});
