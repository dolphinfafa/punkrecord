function getToken() {
  return wx.getStorageSync('token') || '';
}

function setSession(token, user) {
  wx.setStorageSync('token', token || '');
  wx.setStorageSync('user', user || null);
}

function clearSession() {
  wx.removeStorageSync('token');
  wx.removeStorageSync('user');
}

function getUser() {
  return wx.getStorageSync('user') || null;
}

module.exports = {
  getToken,
  setSession,
  clearSession,
  getUser,
};
