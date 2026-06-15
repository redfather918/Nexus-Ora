const app = getApp();

Page({
  data: {
    personas: [
      { id: 'sage', name: '智者', emoji: '🧙', desc: '古老东方智慧的化身', color: '#a78bfa' },
      { id: 'warrior', name: '战士', emoji: '⚔️', desc: '守护与力量的象征', color: '#EF4444' },
      { id: 'lover', name: '恋者', emoji: '💖', desc: '情感与感知的引导者', color: '#EC4899' },
      { id: 'explorer', name: '探索者', emoji: '🌟', desc: '未知领域的追寻者', color: '#F59E0B' },
    ],
    selectedPersona: null,
    messages: [],
    inputText: '',
    loading: false,
    hasProfile: false,
  },

  onShow() {
    const p = wx.getStorageSync('userProfile');
    this.setData({ hasProfile: !!p });
    if (!this.data.selectedPersona) {
      this.setData({ selectedPersona: this.data.personas[0] });
    }
  },

  selectPersona(e) {
    const id = e.currentTarget.dataset.id;
    const p = this.data.personas.find(x => x.id === id);
    this.setData({ selectedPersona: p, messages: [] });
  },

  onInput(e) {
    this.setData({ inputText: e.detail.value });
  },

  async send() {
    const { inputText, selectedPersona, messages } = this.data;
    if (!inputText.trim() || this.data.loading) return;

    const userMsg = { role: 'user', text: inputText, ts: Date.now() };
    const newMsgs = [...messages, userMsg];
    this.setData({ messages: newMsgs, inputText: '', loading: true });

    // 滚动到底部
    setTimeout(() => {
      wx.createSelectorQuery().select('#msg-end').boundingClientRect(r => {
        if (r) wx.pageScrollTo({ scrollTop: r.top + r.height, duration: 300 });
      }).exec();
    }, 100);

    try {
      const r = await app.request('/api/persona/chat', {
        persona: selectedPersona.id,
        message: inputText,
        history: messages.slice(-6).map(m => ({ role: m.role, content: m.text }))
      }, 'POST');

      const aiMsg = { role: 'assistant', text: r.reply || r.message || '...', ts: Date.now() };
      this.setData({ messages: [...newMsgs, aiMsg], loading: false });
    } catch (err) {
      const errMsg = { role: 'assistant', text: '灵境暂时失去连接，请稍后再试', ts: Date.now() };
      this.setData({ messages: [...newMsgs, errMsg], loading: false });
    }
  }
});
