App({
  globalData: {
    baseURL: 'http://127.0.0.1:15085/api/v1',
    user: null,
  },
  onLaunch() {
    const token = wx.getStorageSync('token');
    const user = wx.getStorageSync('user');
    if (token) {
      this.globalData.user = user || null;
    }
  },
});
