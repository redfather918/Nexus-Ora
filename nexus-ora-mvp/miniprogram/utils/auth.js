// utils/auth.js — 登录工具（v2 支持手机号+验证码）
const api = require('./api')

// ═══ 手机号 + 验证码登录 ═══
function sendSms(phone) {
  return api.post('/api/auth/send-sms', { phone })
}

function phoneLogin(phone, code) {
  return api.post('/api/auth/phone-login', { phone, code }).then(data => {
    if (data.token) {
      wx.setStorageSync('token', data.token)
      wx.setStorageSync('user', data.user)
      const app = getApp()
      app.globalData.token = data.token
      app.globalData.userInfo = data.user
    }
    return data
  })
}

// ═══ 微信登录（保留兼容） ═══
function wxLogin() {
  return new Promise((resolve, reject) => {
    const token = wx.getStorageSync('token')
    if (token) { resolve({ token }); return }
    wx.login({
      success: (res) => {
        if (res.code) {
          api.post('/api/auth/wx-login', { code: res.code })
            .then((data) => {
              if (data.token) {
                wx.setStorageSync('token', data.token)
                const app = getApp()
                app.globalData.token = data.token
                app.globalData.userInfo = data.user
                resolve(data)
              } else { reject(new Error('登录失败')) }
            }).catch(reject)
        } else { reject(new Error('wx.login 失败')) }
      },
      fail: reject
    })
  })
}

function getUserProfile() {
  return new Promise((resolve, reject) => {
    wx.getUserProfile({ desc: '用于完善个人资料', success: resolve, fail: reject })
  })
}

function logout() {
  const token = wx.getStorageSync('token')
  if (token) api.post('/api/auth/logout', {}).catch(() => {})
  wx.removeStorageSync('token')
  wx.removeStorageSync('user')
  const app = getApp()
  app.globalData.token = null
  app.globalData.userInfo = null
}

function isLoggedIn() { return !!wx.getStorageSync('token') }

module.exports = {
  sendSms, phoneLogin, wxLogin, getUserProfile, logout, isLoggedIn
}
