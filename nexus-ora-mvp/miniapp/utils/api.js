// API base - 与 app.js 保持一致，统一使用生产域名
const BASE = 'https://life.p1web.site';

function request(url, data, method = 'GET') {
  return new Promise((resolve, reject) => {
    wx.request({
      url: BASE + url,
      data,
      method,
      header: { 'content-type': 'application/json' },
      success: r => resolve(r.data),
      fail: reject
    });
  });
}

module.exports = { request, BASE };
