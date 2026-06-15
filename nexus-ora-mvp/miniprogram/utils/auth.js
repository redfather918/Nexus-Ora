// utils/auth.js — 微信登录工具
const api = require('./api')

function login() {
  return new Promise((resolve, reject) => {
    // 先检查是否已有 token
    const token = wx.getStorageSync('token')
    if (token) {
      resolve({ token })
      return
    }

    // 微信登录
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
              } else {
                reject(new Error('登录失败'))
              }
            })
            .catch(reject)
        } else {
          reject(new Error('wx.login 失败'))
        }
      },
      fail: reject
    })
  })
}

function getUserProfile() {
  return new Promise((resolve, reject) => {
    wx.getUserProfile({
      desc: '用于完善个人资料',
      success: resolve,
      fail: reject
    })
  })
}

function logout() {
  wx.removeStorageSync('token')
  const app = getApp()
  app.globalData.token = null
  app.globalData.userInfo = null
}

function isLoggedIn() {
  return !!wx.getStorageSync('token')
}

module.exports = {
  login, getUserProfile, logout, isLoggedIn
}
