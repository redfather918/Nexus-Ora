// pages/login/login.js
const auth = require('../../utils/auth.js')
const app = getApp()

Page({
  data: {
    phone: '',
    code: '',
    debugCode: '',
    smsText: '获取验证码',
    smsDisabled: false,
    submitText: '登录 / 注册',
    canSubmit: false
  },

  onLoad() {
    // 如果已登录，直接返回
    if (auth.isLoggedIn()) {
      setTimeout(() => wx.navigateBack(), 200)
    }
  },

  onPhoneInput(e) {
    this.setData({ phone: e.detail.value, canSubmit: this._checkCanSubmit(e.detail.value, this.data.code) })
  },

  onCodeInput(e) {
    this.setData({ code: e.detail.value, canSubmit: this._checkCanSubmit(this.data.phone, e.detail.value) })
  },

  _checkCanSubmit(phone, code) {
    return /^1[3-9]\d{9}$/.test(phone) && /^\d{6}$/.test(code)
  },

  async onSendSms() {
    const phone = this.data.phone.trim()
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      return wx.showToast({ title: '手机号格式错误', icon: 'none' })
    }
    this.setData({ smsDisabled: true, smsText: '发送中...' })
    try {
      const data = await auth.sendSms(phone)
      if (data.code === 0) {
        wx.showToast({ title: '已发送', icon: 'success' })
        if (data.debugCode) this.setData({ debugCode: data.debugCode })
        // 60s 倒计时
        let sec = 60
        const t = setInterval(() => {
          if (sec <= 0) {
            clearInterval(t)
            this.setData({ smsDisabled: false, smsText: '获取验证码' })
          } else {
            this.setData({ smsText: `${sec}s 后重试` })
            sec--
          }
        }, 1000)
      } else {
        this.setData({ smsDisabled: false, smsText: '获取验证码' })
        wx.showToast({ title: data.msg || '发送失败', icon: 'none' })
      }
    } catch (e) {
      this.setData({ smsDisabled: false, smsText: '获取验证码' })
      wx.showToast({ title: '网络错误', icon: 'none' })
    }
  },

  async onSubmit() {
    if (!this.data.canSubmit) return
    this.setData({ submitText: '登录中...' })
    try {
      const data = await auth.phoneLogin(this.data.phone.trim(), this.data.code.trim())
      if (data.code === 0) {
        wx.showToast({ title: '✓ 登录成功', icon: 'success' })
        app.globalData.userInfo = data.user
        app.globalData.token = data.token
        setTimeout(() => {
          const pages = getCurrentPages()
          if (pages.length > 1) wx.navigateBack()
          else wx.switchTab({ url: '/pages/home/home' })
        }, 800)
      } else {
        this.setData({ submitText: '登录 / 注册' })
        wx.showToast({ title: data.msg || '登录失败', icon: 'none' })
      }
    } catch (e) {
      this.setData({ submitText: '登录 / 注册' })
      wx.showToast({ title: '网络错误', icon: 'none' })
    }
  }
})
