const API = 'https://life.p1web.site';

App({
  globalData: { birthDate: '', gender: '', userProfile: null, pendingAction: '' },
  onLaunch() {
    const p = wx.getStorageSync('userProfile');
    if (p) this.globalData.userProfile = p;
  },
  request(url, data, method = 'GET') {
    return new Promise((resolve, reject) => {
      wx.request({
        url: API + url,
        data,
        method,
        header: { 'Content-Type': 'application/json' },
        success: (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const body = res.data;
            // 自动解包后端返回的 {success: true, data: ...} 格式
            if (body && typeof body === 'object' && body.success === true && body.data !== undefined) {
              resolve(body.data);
            } else {
              resolve(body);
            }
          } else {
            reject(res);
          }
        },
        fail: reject
      });
    });
  }
});
