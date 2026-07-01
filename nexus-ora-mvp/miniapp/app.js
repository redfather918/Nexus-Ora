// ====== 环境配置 ======
// DEBUG=true  → 本地开发服务器（微信开发者工具模拟器）
// DEBUG=false → 生产服务器
const DEBUG = true;
const LOCAL_API = 'http://127.0.0.1:3000';
const PROD_API = 'https://life.p1web.site';
const API = DEBUG ? LOCAL_API : PROD_API;

App({
  globalData: { birthDate: '', gender: '', userProfile: null, pendingAction: '', apiBase: API },
  onLaunch() {
    const p = wx.getStorageSync('userProfile');
    if (p) this.globalData.userProfile = p;
    console.log('[Nexus Ora] API:', API);
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
        fail: (err) => {
          console.error('[API Error]', url, err);
          reject(err);
        }
      });
    });
  }
});
