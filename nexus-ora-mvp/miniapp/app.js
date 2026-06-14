const API = 'http://127.0.0.1:3000';

App({
  globalData: { birthDate: '', gender: '', userProfile: null },
  onLaunch() {
    const p = wx.getStorageSync('userProfile');
    if (p) this.globalData.userProfile = p;
  },
  request(url, data, method = 'GET') {
    return new Promise((resolve, reject) => {
      wx.request({ url: API + url, data, method, success: r => resolve(r.data), fail: reject });
    });
  }
});