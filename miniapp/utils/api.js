// API base - 统一使用 app.js 中的配置
// 如需修改 API 地址，请统一在 app.js 中修改 DEBUG / PROD_API
const app = getApp();

function request(url, data, method = 'GET') {
  return app.request(url, data, method);
}

module.exports = { request, BASE: app ? app.globalData.apiBase : '' };
