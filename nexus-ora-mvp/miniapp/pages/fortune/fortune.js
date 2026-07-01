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

  onLoad(options) {
    // 处理分享参数：自动填入并触发排盘
    if (options.birth) {
      const g = Number(options.gender) || 1;
      const bt = decodeURIComponent(options.birthTime || '12:00');
      this.setData({
        birth: decodeURIComponent(options.birth),
        birthTime: bt,
        gender: g
      });
      this.doFortune();
    }
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

      // 后端返回 r.bazi 是 paipanResult（含内层 bazi 对象），需扁平化
      const baziInfo = (r.bazi && r.bazi.bazi) ? r.bazi.bazi : (r.bazi || {});

      // 处理五行数据为数组
      const wb = r.wuxing_balance || (r.bazi && r.bazi.wuxing_balance) || {};
      let wuxingArr = [];
      if (wb && Object.keys(wb).length) {
        const wuOrder = ['金', '木', '水', '火', '土'];
        const colorMap = { '金': '#F59E0B', '木': '#10B981', '水': '#3B82F6', '火': '#EF4444', '土': '#92400E' };
        const total = Object.values(wb).reduce((s, v) => s + v, 0) || 1;
        wuxingArr = wuOrder.map(name => ({
          name,
          value: wb[name] || 0,
          pct: Math.round(((wb[name] || 0) / total) * 100),
          color: colorMap[name]
        }));
      }

      // 处理流年数据（取前30年）
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
          bazi: baziInfo,
          pillars: r.pillars || (r.bazi && r.bazi.pillars) || [],
          wuxing_balance: wb,
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

  onShareAppMessage() {
    const { result, birth, gender, birthTime } = this.data;
    let title = 'Nexus Ora · AI 灵境预言';
    let path = '/pages/fortune/fortune';
    if (result && result.bazi) {
      const b = result.bazi;
      const g = gender === 1 ? '男' : '女';
      title = `AI命盘：${b.day_gan || '?' }日主 · ${b.body_strength || '未知'} · ${g}命`;
      path = `/pages/fortune/fortune?birth=${encodeURIComponent(birth)}&birthTime=${encodeURIComponent(birthTime)}&gender=${gender}`;
    }
    return {
      title,
      path
    };
  },

  onShareTimeline() {
    const { result, birth, gender, birthTime } = this.data;
    let title = 'Nexus Ora · AI 灵境预言';
    let query = '';
    if (result && result.bazi) {
      const b = result.bazi;
      const g = gender === 1 ? '男' : '女';
      title = `AI命盘：${b.day_gan || '?' }日主 · ${b.body_strength || '未知'} · ${g}命`;
      query = `birth=${encodeURIComponent(birth)}&birthTime=${encodeURIComponent(birthTime)}&gender=${gender}`;
    }
    return {
      title,
      query
    };
  }
});
