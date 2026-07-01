// pages/dream/dream.js
const api = require('../../utils/api.js')

const MOODS = [
  { label: '喜悦', color: '#FCD34D' },
  { label: '平静', color: '#60A5FA' },
  { label: '困惑', color: '#9CA3AF' },
  { label: '焦虑', color: '#F87171' },
  { label: '悲伤', color: '#818CF8' },
  { label: '恐惧', color: '#A855F7' }
]

Page({
  data: {
    hasResult: false,
    loading: false,
    description: '',
    selectedMood: '困惑',
    moods: MOODS,
    result: null,
    history: []
  },

  onLoad() {
    this.loadHistory()
  },

  onShow() {
    this.loadHistory()
  },

  loadHistory() {
    // 后端梦境列表需要登录，这里先本地展示本次结果
  },

  onInput(e) {
    this.setData({ description: e.detail.value })
  },

  selectMood(e) {
    this.setData({ selectedMood: e.currentTarget.dataset.mood })
  },

  async analyze() {
    const text = this.data.description.trim()
    if (!text || text.length < 5) {
      wx.showToast({ title: '梦境描述至少5个字', icon: 'none' })
      return
    }
    if (this.data.loading) return

    this.setData({ loading: true })
    wx.showLoading({ title: '解梦中...', mask: true })

    try {
      const res = await api.post('/api/dream', {
        description: text,
        mood: this.data.selectedMood,
        title: text.slice(0, 20)
      })

      if (res.success && res.data) {
        this.setData({
          hasResult: true,
          result: res.data
        })
        this.addToHistory(res.data)
      } else {
        wx.showToast({ title: '解析失败', icon: 'none' })
      }
    } catch (e) {
      console.error('dream error:', e)
      // 本地回退
      this.localDreamAnalysis(text)
      wx.showToast({ title: '已离线解析', icon: 'none' })
    } finally {
      this.setData({ loading: false })
      wx.hideLoading()
    }
  },

  localDreamAnalysis(text) {
    const desc = text.toLowerCase()
    const symbols = []
    const map = {
      '水': ['水', '河', '海', '雨'], '飞行': ['飞', '翅膀', '天空'],
      '坠落': ['掉', '坠落', '摔'], '追逐': ['追', '逃跑'], '考试': ['考试', '考场'],
      '蛇': ['蛇', '蟒'], '恋爱': ['恋爱', '结婚', '婚礼']
    }
    for (const [sym, kws] of Object.entries(map)) {
      if (kws.some(k => desc.includes(k))) symbols.push(sym)
    }
    if (!symbols.length) symbols.push('寻常')

    const result = {
      mood: this.data.selectedMood,
      symbols,
      east_analysis: {
        title: '周公解梦',
        interpretation: `此梦涉及${symbols.join('、')}等意象，东方解梦认为梦境是现实的映射，提醒你关注近期生活中的变化。`,
        five_element: '木',
        omen: '平兆',
        classic_ref: '周公曰：梦由心生，吉凶在人'
      },
      west_analysis: {
        title: '潜意识映射',
        freudian: '弗洛伊德认为梦境是通往潜意识的皇家大道，当前情绪可能反映了你内心深处的某种需求或压抑。',
        jungian: '荣格视角下，梦中的意象可能关联着集体无意识中的原型，暗示你正在经历某种心理转化。',
        archetype: '未定型'
      },
      summary: '此梦为平兆。建议保持观察，关注近期情绪变化，用平和心态面对生活中的起伏。',
      luck_score: 55
    }

    this.setData({ hasResult: true, result })
    this.addToHistory(result)
  },

  addToHistory(item) {
    const history = [item, ...this.data.history].slice(0, 20)
    this.setData({ history })
    wx.setStorageSync('dream_history', history)
  },

  reset() {
    this.setData({
      hasResult: false,
      result: null,
      description: '',
      selectedMood: '困惑'
    })
  },

  onShareAppMessage() {
    return {
      title: '梦境回廊 - Nexus Ora',
      path: '/pages/dream/dream'
    }
  }
})
