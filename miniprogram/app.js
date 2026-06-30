// app.js — Nexus Ora 小程序入口
App({
  onLaunch() {
    // 检查登录态
    this.checkLogin()
  },

  globalData: {
    userInfo: null,
    token: null,
    apiBase: 'https://your-domain.com',  // 生产环境改为实际域名
    apiBaseDev: 'http://127.0.0.1:3000', // 本地开发
  },

  getApiBase() {
    // 优先使用线上地址，开发时可切换
    return this.globalData.apiBase
  },

  checkLogin() {
    const token = wx.getStorageSync('token')
    if (token) {
      this.globalData.token = token
    }
  },

  // 微信登录
  wxLogin() {
    return new Promise((resolve, reject) => {
      wx.login({
        success: (res) => {
          if (res.code) {
            wx.request({
              url: `${this.getApiBase()}/api/auth/wx-login`,
              method: 'POST',
              data: { code: res.code },
              success: (apiRes) => {
                if (apiRes.data && apiRes.data.token) {
                  this.globalData.token = apiRes.data.token
                  this.globalData.userInfo = apiRes.data.user
                  wx.setStorageSync('token', apiRes.data.token)
                  resolve(apiRes.data)
                } else {
                  reject(new Error('登录失败'))
                }
              },
              fail: reject
            })
          } else {
            reject(new Error('wx.login 失败'))
          }
        },
        fail: reject
      })
    })
  }
})
