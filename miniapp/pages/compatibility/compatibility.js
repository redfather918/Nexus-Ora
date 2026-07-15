const app = getApp();

Page({
  data: {
    birthA: '', timeA: '12:00', genderA: 1,
    birthB: '', timeB: '12:00', genderB: 2,
    result: null,
    loading: false,
    showResult: false,
    activeTab: 'score',
  },

  onBirthA(e) { this.setData({ birthA: e.detail.value }); },
  onBirthB(e) { this.setData({ birthB: e.detail.value }); },
  onTimeA(e)  { this.setData({ timeA: e.detail.value });  },
  onTimeB(e)  { this.setData({ timeB: e.detail.value });  },
  setGA(e)    { this.setData({ genderA: Number(e.currentTarget.dataset.g) }); },
  setGB(e)    { this.setData({ genderB: Number(e.currentTarget.dataset.g) }); },
  switchTab(e){ this.setData({ activeTab: e.currentTarget.dataset.tab }); },

  async doCompat() {
    const { birthA, birthB, timeA, timeB, genderA, genderB } = this.data;
    if (!birthA || !birthB) {
      wx.showToast({ title: '请填写双方出生日期', icon: 'none' });
      return;
    }
    this.setData({ loading: true, showResult: false });
    try {
      const r = await app.request('/api/compat', {
        birth_a: birthA, time_a: timeA, gender_a: genderA === 1 ? 'male' : 'female',
        birth_b: birthB, time_b: timeB, gender_b: genderB === 1 ? 'male' : 'female',
      }, 'POST');

      // 处理维度数据
      let dimArr = [];
      if (r.dimensions) {
        const dimMap = { '缘分': '💝', '互补': '☯️', '共鸣': '🎵', '磁场': '⚡', '灵性': '✨' };
        dimArr = Object.entries(r.dimensions).map(([k, v]) => ({
          name: k, score: v, emoji: dimMap[k] || '•',
          barW: `${v}%`,
          color: v >= 70 ? '#EF4444' : v >= 50 ? '#F59E0B' : '#a78bfa'
        }));
      }

      this.setData({ result: { ...r, dimArr }, loading: false, showResult: true, activeTab: 'score' });
    } catch (err) {
      wx.showToast({ title: '合盘失败，请重试', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  reset() {
    this.setData({ showResult: false, result: null });
  }
});
