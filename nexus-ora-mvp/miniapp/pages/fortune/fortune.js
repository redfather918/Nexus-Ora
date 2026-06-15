const app = getApp();

Page({
  data: {
    birth: '',
    birthTime: '12:00',
    gender: 1, // 1=男 2=女
    result: null,
    loading: false,
    showResult: false,
    activeTab: 'bazi', // bazi | wuxing | fortune | daYun
  },

  onBirthChange(e) {
    this.setData({ birth: e.detail.value });
  },

  onTimeChange(e) {
    this.setData({ birthTime: e.detail.value });
  },

  setGender(e) {
    this.setData({ gender: Number(e.currentTarget.dataset.g) });
  },

  switchTab(e) {
    this.setData({ activeTab: e.currentTarget.dataset.tab });
  },

  async doFortune() {
    const { birth, gender, birthTime } = this.data;
    if (!birth) {
      wx.showToast({ title: '请选择出生日期', icon: 'none' });
      return;
    }
    this.setData({ loading: true, showResult: false });

    const gStr = gender === 1 ? 'male' : 'female';
    const birthDatetime = `${birth} ${birthTime}`;

    try {
      const r = await app.request('/api/fortune', {
        birth_date: birth,
        birth_time: birthTime,
        gender: gStr
      }, 'POST');

      // 处理五行数据为数组
      let wuxingArr = [];
      if (r.wuxing_balance) {
        const wuOrder = ['金', '木', '水', '火', '土'];
        const colorMap = { '金': '#F59E0B', '木': '#10B981', '水': '#3B82F6', '火': '#EF4444', '土': '#92400E' };
        const total = Object.values(r.wuxing_balance).reduce((s, v) => s + v, 0) || 1;
        wuxingArr = wuOrder.map(name => ({
          name,
          value: r.wuxing_balance[name] || 0,
          pct: Math.round(((r.wuxing_balance[name] || 0) / total) * 100),
          color: colorMap[name]
        }));
      }

      // 处理流年数据（取前20年）
      let fortuneSlice = [];
      if (r.fortune && r.fortune.length) {
        fortuneSlice = r.fortune.slice(0, 30).map(f => ({
          ...f,
          barWidth: `${Math.round(f.score)}%`,
          scoreColor: f.score >= 70 ? '#EF4444' : f.score >= 50 ? '#F59E0B' : '#10B981'
        }));
      }

      // 处理大运数据
      let daYunArr = [];
      if (r.da_yun && r.da_yun.length) {
        daYunArr = r.da_yun.slice(0, 8);
      }

      this.setData({
        result: {
          ...r,
          wuxingArr,
          fortuneSlice,
          daYunArr
        },
        loading: false,
        showResult: true,
        activeTab: 'bazi'
      });
    } catch (err) {
      console.error(err);
      wx.showToast({ title: '排盘失败，请重试', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  reset() {
    this.setData({ showResult: false, result: null, birth: '', activeTab: 'bazi' });
  },

  shareCard() {
    wx.showToast({ title: '分享功能即将上线', icon: 'none' });
  }
});
