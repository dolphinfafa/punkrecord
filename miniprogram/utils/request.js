const { getToken, clearSession } = require('./storage');

function request({ url, method = 'GET', data = {}, header = {} }) {
  const app = getApp();
  const token = getToken();
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${app.globalData.baseURL}${url}`,
      method,
      data,
      header: {
        'content-type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...header,
      },
      success(res) {
        const { statusCode } = res;
        const body = res.data || {};
        if (statusCode === 401) {
          clearSession();
          wx.showToast({ title: '登录已过期，请重新登录', icon: 'none' });
          wx.reLaunch({ url: '/pages/login/index' });
          reject(new Error('Unauthorized'));
          return;
        }
        if (statusCode >= 200 && statusCode < 300) {
          resolve(body.data !== undefined ? body.data : body);
          return;
        }
        const message = body.message || '请求失败';
        wx.showToast({ title: message, icon: 'none' });
        reject(new Error(message));
      },
      fail(err) {
        wx.showToast({ title: '网络异常，请稍后重试', icon: 'none' });
        reject(err);
      },
    });
  });
}

module.exports = request;
