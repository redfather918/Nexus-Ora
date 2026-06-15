const app = getApp();

Page({
  data: {
    birth: '', birthTime: '12:00', gender: 1,
    result: null, loading: false, showResult: false,
    activeTab: 'overview',
    palaceNames: ['命宫','兄弟','夫妻','子女','财帛','疾厄','迁移','交友','官禄','田宅','福德','父母'],
  },

  onBirthChange(e) { this.setData({ birth: e.detail.value }); },
  onTimeChange(e)  { this.setData({ birthTime: e.detail.value }); },
  setGender(e)     { this.setData({ gender: Number(e.currentTarget.dataset.g) }); },
  switchTab(e)     { this.setData({ activeTab: e.currentTarget.dataset.tab }); },

  async doZiwei() {
    const { birth, birthTime, gender } = this.data;
    if (!birth) { wx.showToast({ title: '请选择出生日期', icon: 'none' }); return; }
    this.setData({ loading: true, showResult: false });
    try {
      const r = await app.request('/api/ziwei', {
        birth_date: birth,
        birth_time: birthTime,
        gender: gender === 1 ? 'male' : 'female'
      }, 'POST');

      // 处理十二宫数据
      let palaces = [];
      if (r.palaces) {
        palaces = r.palaces.map(p => ({
          ...p,
          stars_str: (p.stars || []).join(' '),
          hasMainStar: !!(p.main_star || p.stars?.length > 0)
        }));
      }

      this.setData({ result: { ...r, palaces }, loading: false, showResult: true, activeTab: 'overview' });
    } catch (err) {
      wx.showToast({ title: '排盘失败，请重试', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  reset() { this.setData({ showResult: false, result: null }); }
});
