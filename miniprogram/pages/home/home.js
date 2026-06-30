// pages/home/home.js
const app = getApp()
const auth = require('../../utils/auth.js')

Page({
  data: {
    isLoggedIn: false,
    userInfo: {},
    modules: [
      {
        id: 'fortune',
        name: '灵境图谱',
        desc: '人生K线 · 八字排盘',
        icon: '📈',
        url: '/pages/fortune/fortune',
        bgColor: 'rgba(168, 85, 247, 0.15)'
      },
      {
        id: 'compat',
        name: '缘分配对',
        desc: '双人合盘 · 五维评分',
        icon: '💞',
        url: '/pages/compat/compat',
        bgColor: 'rgba(236, 72, 153, 0.15)'
      },
      {
        id: 'dream',
        name: '梦境回廊',
        desc: 'AI解梦 · 双维度解析',
        icon: '🌙',
        url: '/pages/dream/dream',
        bgColor: 'rgba(129, 140, 248, 0.15)'
      },
      {
        id: 'persona',
        name: '灵境人格',
        desc: '十神人格 · AI对话',
        icon: '🧬',
        url: '/pages/persona/persona',
        bgColor: 'rgba(236, 72, 153, 0.15)'
      },
      {
        id: 'oracle',
        name: '灵境占卜',
        desc: '塔罗 · 杯筊 · 每日签',
        icon: '🔮',
        url: '/pages/oracle/oracle',
        bgColor: 'rgba(245, 158, 11, 0.15)'
      },
      {
        id: 'cultivation',
        name: '灵境修行',
        desc: '打卡 · 冥想 · 日记',
        icon: '🧘',
        url: '/pages/cultivation/cultivation',
        bgColor: 'rgba(34, 197, 94, 0.15)'
      },
      {
        id: 'market',
        name: '灵境市集',
        desc: '数字周边 · 水晶商城',
        icon: '🏪',
        url: '/pages/market/market',
        bgColor: 'rgba(245, 158, 11, 0.15)'
      },
      {
        id: 'ziwei',
        name: '紫微命盘',
        desc: '十二宫 · 主星 · 四化',
        icon: '⭐',
        url: '/pages/ziwei/ziwei',
        bgColor: 'rgba(168, 85, 247, 0.15)'
      }
    ]
  },

  onLoad() {
    this.refreshLoginState()
  },

  onShow() {
    this.refreshLoginState()
  },

  refreshLoginState() {
    const user = wx.getStorageSync('user') || null
    this.setData({
      isLoggedIn: !!auth.isLoggedIn(),
      userInfo: user || {}
    })
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' })
  },

  onUserTap() {
    wx.showActionSheet({
      itemList: ['查看我的命盘', '退出登录'],
      success: (res) => { if (res.tapIndex === 1) this.onLogout() }
    })
  },

  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出当前账号吗？',
      success: (res) => {
        if (res.confirm) {
          auth.logout()
          this.refreshLoginState()
          wx.showToast({ title: '已退出', icon: 'success' })
        }
      }
    })
  },

  goModule(e) {
    const url = e.currentTarget.dataset.url
    if (url) {
      wx.navigateTo({ url })
    }
  },

  onShareAppMessage() {
    return {
      title: 'Nexus Ora — AI原生玄学平台',
      path: '/pages/home/home',
      imageUrl: ''
    }
  }
})
