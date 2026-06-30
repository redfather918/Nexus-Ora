// utils/api.js — 网络请求封装
const app = getApp()

function request(options) {
  return new Promise((resolve, reject) => {
    const token = app.globalData.token
    const header = {
      'Content-Type': 'application/json',
    }
    if (token) {
      header['Authorization'] = `Bearer ${token}`
    }

    wx.request({
      url: `${app.getApiBase()}${options.url}`,
      method: options.method || 'GET',
      data: options.data || {},
      header: Object.assign(header, options.header || {}),
      success: (res) => {
        if (res.statusCode === 200) {
          resolve(res.data)
        } else if (res.statusCode === 401) {
          // token 过期，重新登录
          app.wxLogin().then(() => {
            // 重试一次
            header['Authorization'] = `Bearer ${app.globalData.token}`
            wx.request({
              url: `${app.getApiBase()}${options.url}`,
              method: options.method || 'GET',
              data: options.data || {},
              header: Object.assign(header, options.header || {}),
              success: (res2) => resolve(res2.data),
              fail: reject
            })
          }).catch(reject)
        } else {
          reject(new Error(`HTTP ${res.statusCode}`))
        }
      },
      fail: reject
    })
  })
}

// 便捷方法
function get(url, data) {
  return request({ url, method: 'GET', data })
}

function post(url, data) {
  return request({ url, method: 'POST', data })
}

function del(url, data) {
  return request({ url, method: 'DELETE', data })
}

module.exports = {
  request, get, post, del
}
