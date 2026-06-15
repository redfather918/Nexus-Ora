const app = getApp();

Page({
  data: {
    method: 'tarot', // tarot | jiaoqian | hexagram
    methods: [
      { key: 'tarot', name: '塔罗牌', emoji: '🃏' },
      { key: 'jiaoqian', name: '签筒抽签', emoji: '🎋' },
      { key: 'hexagram', name: '六爻卦', emoji: '☯️' },
    ],
    question: '',
    result: null,
    loading: false,
    cards: [],       // 塔罗选牌状态
    selectedCards: [],
    shaking: false,  // 摇签动画
  },

  onLoad() {},

  selectMethod(e) {
    this.setData({ method: e.currentTarget.dataset.key, result: null, question: '', selectedCards: [] });
  },

  onInput(e) {
    this.setData({ question: e.detail.value });
  },

  async doDivination() {
    const { method, question } = this.data;
    if (!question.trim()) {
      wx.showToast({ title: '请输入您的问题', icon: 'none' });
      return;
    }
    this.setData({ loading: true, result: null });

    if (method === 'jiaoqian') {
      this.setData({ shaking: true });
      await new Promise(r => setTimeout(r, 1200));
      this.setData({ shaking: false });
    }

    try {
      const r = await app.request('/api/divination', { method, question }, 'POST');
      this.setData({ result: r, loading: false });
    } catch (err) {
      wx.showToast({ title: '占卜失败，请重试', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  reset() {
    this.setData({ result: null, question: '', selectedCards: [] });
  }
});
