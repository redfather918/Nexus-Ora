const app = getApp();

const TAB_BAR_PAGES = [
  '/pages/index/index',
  '/pages/fortune/fortune',
  '/pages/persona/persona',
  '/pages/market/market',
  '/pages/mine/mine'
];

Page({
  data: {
    hasProfile: false,
    modules: [
      { id: 1, icon: '📜', name: '灵境预言', desc: '八字排盘·百年运势', page: '/pages/fortune/fortune' },
      { id: 2, icon: '🎯', name: '灵境图谱', desc: '六维度深度分析', page: '/pages/radar/radar' },
      { id: 3, icon: '💕', name: '缘分配对', desc: '双人合盘·缘分指数', page: '/pages/compatibility/compatibility' },
      { id: 4, icon: '⭐', name: '紫微斗数', desc: '十二宫命盘解析', page: '/pages/ziwei/ziwei' },
      { id: 5, icon: '🌙', name: '梦境回廊', desc: '双维度解梦', page: '/pages/dream/dream' },
      { id: 6, icon: '🎭', name: '灵境人格', desc: 'AI 人格对话', page: '/pages/persona/persona' },
      { id: 7, icon: '🎴', name: '灵境占卜', desc: '塔罗·筊杯', page: '/pages/divination/divination' },
      { id: 8, icon: '🧘', name: '灵境修行', desc: '冥想·打卡', page: '/pages/cultivation/cultivation' },
      { id: 9, icon: '💎', name: '灵境市集', desc: '数字藏品', page: '/pages/market/market' }
    ]
  },
  onShow() {
    const p = wx.getStorageSync('userProfile');
    this.setData({ hasProfile: !!p });
  },
  openBirthForm() {
    app.globalData.pendingAction = 'birth';
    wx.switchTab({ url: '/pages/mine/mine' });
  },
  goModule(e) {
    const page = e.currentTarget.dataset.page;
    if (!page) return;
    if (TAB_BAR_PAGES.includes(page)) {
      wx.switchTab({ url: page });
    } else {
      wx.navigateTo({ url: page });
    }
  }
});
