// pages/compat/compat.js
const api = require('../../utils/api.js')

Page({
  data: {
    hasResult: false,
    loading: false,
    personA: { name: '', birthDate: '', birthTime: '', gender: '' },
    personB: { name: '', birthDate: '', birthTime: '', gender: '' },
    canSubmit: false,
    result: null
  },

  onLoad() {
    // 预填甲方信息：优先读 userProfile，再读 user
    const profile = wx.getStorageSync('userProfile') || null
    const user = wx.getStorageSync('user') || null

    if (profile && profile.birth) {
      this.setData({
        'personA.name': profile.nickname || user?.nickname || '我',
        'personA.birthDate': profile.birth,
        'personA.birthTime': profile.birthTime || '',
        'personA.gender': profile.gender || 'male'
      })
    }
    this.checkCanSubmit()
  },

  onANameInput(e) {
    this.setData({ 'personA.name': e.detail.value })
  },
  onADateChange(e) {
    this.setData({ 'personA.birthDate': e.detail.value })
    this.checkCanSubmit()
  },
  onATimeChange(e) {
    this.setData({ 'personA.birthTime': e.detail.value })
    this.checkCanSubmit()
  },
  onAGenderChange(e) {
    this.setData({ 'personA.gender': e.detail.value })
    this.checkCanSubmit()
  },

  onBNameInput(e) {
    this.setData({ 'personB.name': e.detail.value })
  },
  onBDateChange(e) {
    this.setData({ 'personB.birthDate': e.detail.value })
    this.checkCanSubmit()
  },
  onBTimeChange(e) {
    this.setData({ 'personB.birthTime': e.detail.value })
    this.checkCanSubmit()
  },
  onBGenderChange(e) {
    this.setData({ 'personB.gender': e.detail.value })
    this.checkCanSubmit()
  },

  checkCanSubmit() {
    const { personA, personB } = this.data
    const okA = personA.birthDate && personA.birthTime && personA.gender
    const okB = personB.birthDate && personB.birthTime && personB.gender
    this.setData({ canSubmit: okA && okB })
  },

  async calculate() {
    if (!this.data.canSubmit || this.data.loading) return

    const { personA, personB } = this.data
    const [ay, am, ad] = personA.birthDate.split('-').map(Number)
    const [by, bm, bd] = personB.birthDate.split('-').map(Number)
    const ah = personA.birthTime ? parseInt(personA.birthTime.split(':')[0], 10) : 12
    const bh = personB.birthTime ? parseInt(personB.birthTime.split(':')[0], 10) : 12
    const amin = personA.birthTime ? parseInt(personA.birthTime.split(':')[1], 10) : 0
    const bmin = personB.birthTime ? parseInt(personB.birthTime.split(':')[1], 10) : 0

    this.setData({ loading: true })
    wx.showLoading({ title: '合盘中...', mask: true })

    try {
      const res = await api.post('/api/compatibility', {
        personA: {
          name: personA.name || '甲方',
          year: ay, month: am, day: ad, hour: ah, minute: amin, gender: personA.gender
        },
        personB: {
          name: personB.name || '乙方',
          year: by, month: bm, day: bd, hour: bh, minute: bmin, gender: personB.gender
        }
      })

      if (res.success && res.compatibility) {
        this.setData({
          hasResult: true,
          result: res
        })
        wx.showToast({ title: '合盘完成', icon: 'success' })
      } else {
        wx.showToast({ title: res.error || '合盘失败', icon: 'none' })
      }
    } catch (e) {
      console.error('compat error:', e)
      // 本地回退：简单五行算法
      this.localCompatFallback()
      wx.showToast({ title: '网络已回退本地算法', icon: 'none' })
    } finally {
      this.setData({ loading: false })
      wx.hideLoading()
    }
  },

  localCompatFallback() {
    const { personA, personB } = this.data
    const WX = ['金', '木', '水', '火', '土']
    const aWx = WX[personA.birthDate.slice(-1).charCodeAt(0) % 5]
    const bWx = WX[personB.birthDate.slice(-1).charCodeAt(0) % 5]

    const wxScore = aWx === bWx ? 75 : 60
    const overall = Math.min(95, Math.round(wxScore + 15))

    const dimensions = {
      personality: { score: overall - 5, label: '性格互补' },
      career: { score: overall - 2, label: '事业合作' },
      romance: { score: overall, label: '感情契合' },
      communicaton: { score: overall - 3, label: '沟通默契' },
      long_term: { score: overall - 4, label: '长期发展' }
    }

    this.setData({
      hasResult: true,
      result: {
        personA: { info: { birth_date: personA.birthDate } },
        personB: { info: { birth_date: personB.birthDate } },
        compatibility: {
          relation_type: '五行初判',
          relation_icon: '💞',
          relation_desc: `本地简易算法：日主${aWx}与${bWx}，缘分指数 ${overall}。详细解读请连接后端服务。`,
          wx_relation: `${aWx}与${bWx}`,
          overall_score: overall,
          dimensions,
          advice: ['此为离线回退结果，联网后可获取更详细解读。', '建议双方多沟通，真诚是关系最好的调和剂。']
        }
      }
    })
  },

  reset() {
    this.setData({
      hasResult: false,
      result: null,
      personB: { name: '', birthDate: '', birthTime: '', gender: '' }
    })
    this.checkCanSubmit()
  },

  onShareAppMessage() {
    return {
      title: '缘分配对 - Nexus Ora',
      path: '/pages/compat/compat'
    }
  }
})
