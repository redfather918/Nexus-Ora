// pages/persona/persona.js
const api = require('../../utils/api.js')

const MOODS = ['喜悦', '平静', '困惑', '焦虑', '悲伤', '恐惧']

Page({
  data: {
    hasPersona: false,
    loading: false,
    birthDate: '',
    birthTime: '',
    gender: '',
    canSubmit: false,
    persona: null,
    messages: [],
    inputValue: '',
    scrollTo: '',
    moodIndex: 0,
    moods: MOODS
  },

  onLoad() {
    // 尝试读取本地档案
    const profile = wx.getStorageSync('userProfile') || null
    if (profile && profile.birth) {
      this.setData({
        birthDate: profile.birth,
        birthTime: profile.birthTime || '',
        gender: profile.gender || ''
      })
      this.checkCanSubmit()
    }

    // 尝试读取已缓存的人格
    const cached = wx.getStorageSync('persona_cache') || null
    if (cached && cached.persona) {
      this.setData({
        hasPersona: true,
        persona: cached.persona,
        messages: cached.messages || []
      })
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

  async generatePersona() {
    if (!this.data.canSubmit || this.data.loading) return

    const [year, month, day] = this.data.birthDate.split('-').map(Number)
    const hour = this.data.birthTime ? parseInt(this.data.birthTime.split(':')[0], 10) : 12
    const minute = this.data.birthTime ? parseInt(this.data.birthTime.split(':')[1], 10) : 0

    this.setData({ loading: true })
    wx.showLoading({ title: '召唤人格中...', mask: true })

    try {
      const res = await api.post('/api/persona/generate', {
        year, month, day, hour, minute, gender: this.data.gender
      })

      if (res.success && res.data) {
        const persona = res.data
        const welcomeMsg = {
          role: 'assistant',
          content: `吾名 ${persona.name}，${persona.archetype}。${persona.ss_info.desc}。今日起，愿与你共话尘缘。`
        }
        const messages = [welcomeMsg]

        this.setData({
          hasPersona: true,
          persona,
          messages,
          inputValue: ''
        })
        this.cachePersona(persona, messages)
        wx.showToast({ title: '人格已生成', icon: 'success' })
      } else {
        wx.showToast({ title: '生成失败', icon: 'none' })
      }
    } catch (e) {
      console.error('persona generate error:', e)
      wx.showToast({ title: '网络错误，请重试', icon: 'none' })
    } finally {
      this.setData({ loading: false })
      wx.hideLoading()
    }
  },

  onInput(e) {
    this.setData({ inputValue: e.detail.value })
  },

  async sendMessage() {
    const text = this.data.inputValue.trim()
    if (!text || !this.data.persona) return

    const userMsg = { role: 'user', content: text }
    const messages = [...this.data.messages, userMsg]
    this.setData({ inputValue: '', messages })
    this.scrollToBottom()

    this.setData({ loading: true })

    try {
      const res = await api.post('/api/persona/chat', {
        persona_id: this.data.persona.persona_id,
        message: text
      })

      if (res.success) {
        const assistantMsg = { role: 'assistant', content: res.reply }
        const updated = [...messages, assistantMsg]
        this.setData({ messages: updated })
        this.cachePersona(this.data.persona, updated)
      } else {
        wx.showToast({ title: '回复失败', icon: 'none' })
      }
    } catch (e) {
      console.error('persona chat error:', e)
      // 本地回退：随机经典回复
      const fallback = [
        '我在听，你继续说。',
        '此问甚好，容我思量片刻。',
        '天机不可尽泄，但你的心意我已感知。'
      ]
      const assistantMsg = { role: 'assistant', content: fallback[Math.floor(Math.random() * fallback.length)] }
      const updated = [...messages, assistantMsg]
      this.setData({ messages: updated })
      this.cachePersona(this.data.persona, updated)
    } finally {
      this.setData({ loading: false })
      this.scrollToBottom()
    }
  },

  scrollToBottom() {
    const id = 'msg-' + (this.data.messages.length - 1)
    this.setData({ scrollTo: id })
  },

  cachePersona(persona, messages) {
    wx.setStorageSync('persona_cache', { persona, messages })
  },

  resetPersona() {
    wx.showModal({
      title: '重置人格',
      content: '确定要清除当前人格与对话记录吗？',
      success: (res) => {
        if (res.confirm) {
          const pid = this.data.persona && this.data.persona.persona_id
          wx.removeStorageSync('persona_cache')
          this.setData({
            hasPersona: false,
            persona: null,
            messages: [],
            inputValue: ''
          })
          if (pid) {
            api.post('/api/persona/reset', { persona_id: pid }).catch(() => {})
          }
        }
      }
    })
  },

  onShareAppMessage() {
    return {
      title: '我的灵境人格 - Nexus Ora',
      path: '/pages/persona/persona'
    }
  }
})
