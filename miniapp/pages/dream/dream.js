const app = getApp();

Page({
  data: {
    content: '',
    emotion: 'neutral',
    emotions: [
      { key: 'peaceful', label: '平静', emoji: '😌' },
      { key: 'fearful',  label: '恐惧', emoji: '😨' },
      { key: 'joyful',   label: '喜悦', emoji: '😊' },
      { key: 'anxious',  label: '焦虑', emoji: '😰' },
      { key: 'sad',      label: '悲伤', emoji: '😢' },
      { key: 'neutral',  label: '平淡', emoji: '😐' },
    ],
    result: null,
    loading: false,
    history: [],
    tab: 'input', // input | history
  },

  onShow() {
    this.loadHistory();
  },

  onInput(e) {
    this.setData({ content: e.detail.value });
  },

  setEmotion(e) {
    this.setData({ emotion: e.currentTarget.dataset.key });
  },

  switchTab(e) {
    this.setData({ tab: e.currentTarget.dataset.t });
    if (e.currentTarget.dataset.t === 'history') this.loadHistory();
  },

  loadHistory() {
    const h = wx.getStorageSync('dreamHistory') || [];
    this.setData({ history: h.slice(0, 20) });
  },

  async interpret() {
    const { content, emotion } = this.data;
    if (!content.trim()) {
      wx.showToast({ title: '请描述您的梦境', icon: 'none' });
      return;
    }
    this.setData({ loading: true, result: null });
    try {
      const r = await app.request('/api/dream', { content, emotion }, 'POST');
      this.setData({ result: r, loading: false });

      // 保存历史（兼容 summary / interpretation / jungian 多种字段）
      const h = wx.getStorageSync('dreamHistory') || [];
      h.unshift({
        id: Date.now(),
        content: content.slice(0, 50),
        emotion,
        date: new Date().toLocaleDateString('zh-CN'),
        zhougong: (r.zhougong && (r.zhougong.summary || r.zhougong.interpretation || r.zhougong.title)) || '',
        psych: (r.psychology && (r.psychology.summary || r.psychology.jungian || r.psychology.title)) || ''
      });
      wx.setStorageSync('dreamHistory', h.slice(0, 30));
    } catch (err) {
      wx.showToast({ title: '解梦失败，请重试', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  reset() {
    this.setData({ result: null, content: '', emotion: 'neutral' });
  }
});
