const BASE = 'http://127.0.0.1:3000';
function request(url, data, method = 'GET') {
  return new Promise((resolve, reject) => {
    wx.request({ url: BASE + url, data, method, success: r => resolve(r.data), fail: reject });
  });
}
module.exports = { request, BASE };