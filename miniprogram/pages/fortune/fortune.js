// pages/fortune/fortune.js
const api = require('../../utils/api.js')

Page({
  data: {
    hasResult: false,
    loading: false,
    birthDate: '',
    birthTime: '',
    gender: '',
    canSubmit: false,
    report: null,
    summary: null,
    dimensions: null,
    bestAges: [],
    cautionAges: []
  },

  onLoad() {
    const profile = wx.getStorageSync('userProfile') || null
    if (profile && profile.birth) {
      this.setData({
        birthDate: profile.birth,
        birthTime: profile.birthTime || '',
        gender: profile.gender || ''
      })
      this.checkCanSubmit()
    }
  },

  onDateChange(e) {
    this.setData({ birthDate: e.detail.value })
    this.checkCanSubmit()
  },

  onTimeChange(e) {
    this.setData({ birthTime: e.detail.value })
    this.checkCanSubmit()
  },

  onGenderChange(e) {
    this.setData({ gender: e.detail.value })
    this.checkCanSubmit()
  },

  checkCanSubmit() {
    const { birthDate, birthTime, gender } = this.data
    this.setData({ canSubmit: !!(birthDate && birthTime && gender) })
  },

  async calculate() {
    if (!this.data.canSubmit || this.data.loading) return

    const [year, month, day] = this.data.birthDate.split('-').map(Number)
    const hour = this.data.birthTime ? parseInt(this.data.birthTime.split(':')[0], 10) : 12
    const minute = this.data.birthTime ? parseInt(this.data.birthTime.split(':')[1], 10) : 0

    this.setData({ loading: true })
    wx.showLoading({ title: '排盘中...', mask: true })

    try {
      const res = await api.post('/api/fortune', {
        year, month, day, hour, minute, gender: this.data.gender
      })

      if (res.success && res.data) {
        const report = res.data
        this.setData({
          hasResult: true,
          report,
          summary: report.summary || {},
          dimensions: report.dimensions || {},
          bestAges: report.summary.best_ages || [],
          cautionAges: report.summary.caution_ages || []
        })
        wx.showToast({ title: '命盘已生成', icon: 'success' })
      } else {
        wx.showToast({ title: res.error || '排盘失败', icon: 'none' })
      }
    } catch (e) {
      console.error('fortune error:', e)
      wx.showToast({ title: '网络错误，请重试', icon: 'none' })
    } finally {
      this.setData({ loading: false })
      wx.hideLoading()
    }
  },

  reset() {
    this.setData({
      hasResult: false,
      report: null,
      summary: null,
      dimensions: null,
      bestAges: [],
      cautionAges: []
    })
  },

  onShareAppMessage() {
    return {
      title: '我的命运K线 - Nexus Ora',
      path: '/pages/fortune/fortune'
    }
  }
})
