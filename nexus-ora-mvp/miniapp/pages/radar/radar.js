const app = getApp();

Page({
  data: {
    result: null,
    loading: false,
    hasProfile: false,
    dimensions: ['命格强弱', '财运潜力', '事业发展', '感情姻缘', '健康指数', '智慧灵性']
  },

  onShow() {
    const p = wx.getStorageSync('userProfile');
    this.setData({ hasProfile: !!p });
    if (p && !this.data.result) {
      this.load(p);
    }
  },

  goProfile() {
    wx.switchTab({ url: '/pages/mine/mine' });
  },

  async load(profile) {
    if (!profile) {
      const p = wx.getStorageSync('userProfile');
      if (!p) { wx.showToast({ title: '请先完善个人信息', icon: 'none' }); return; }
      profile = p;
    }
    this.setData({ loading: true });
    try {
      const r = await app.request('/api/radar', {
        birth_date: profile.birth,
        birth_time: profile.birthTime || '12:00',
        gender: profile.gender || 'male'
      }, 'POST');

      // 处理六维度数据
      const dimNames = ['命格强弱', '财运潜力', '事业发展', '感情姻缘', '健康指数', '智慧灵性'];
      const dimKeys  = ['fate', 'wealth', 'career', 'love', 'health', 'wisdom'];
      const dimColors= ['#a78bfa', '#F59E0B', '#3B82F6', '#EC4899', '#10B981', '#8B5CF6'];

      let items = [];
      if (r.dimensions) {
        items = dimKeys.map((k, i) => ({
          name: dimNames[i],
          score: r.dimensions[k] || r.dimensions[dimNames[i]] || Math.floor(50 + Math.random()*30),
          desc: r.dimension_desc?.[k] || r.dimension_desc?.[dimNames[i]] || '',
          color: dimColors[i],
          barW: `${r.dimensions[k] || 60}%`
        }));
      } else if (r.items) {
        items = r.items.map((item, i) => ({
          name: item.name || dimNames[i],
          score: item.score || 60,
          desc: item.text || item.desc || '',
          color: dimColors[i % dimColors.length],
          barW: `${item.score || 60}%`
        }));
      }

      this.setData({ result: { ...r, items }, loading: false });
    } catch (e) {
      wx.showToast({ title: '分析失败，请重试', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  refresh() {
    this.setData({ result: null });
    const p = wx.getStorageSync('userProfile');
    if (p) this.load(p);
  }
});
