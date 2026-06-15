const app = getApp();

Page({
  data: {
    tab: 'today',  // today | history
    practices: [
      { id: 'breathe', name: '五行呼吸', emoji: '🌬️', duration: 5, desc: '平衡五行能量，舒缓焦虑' },
      { id: 'mantra', name: '真言冥想', emoji: '🔔', duration: 10, desc: '专注真言，净化意识' },
      { id: 'visualize', name: '观想修炼', emoji: '👁️', duration: 15, desc: '观想光明，提升灵性' },
      { id: 'gratitude', name: '感恩日记', emoji: '📖', duration: 3, desc: '记录三件感恩之事' },
    ],
    activePractice: null,
    timer: 0,
    timerRunning: false,
    timerMax: 300,
    timerStr: '00:00',
    streak: 0,
    todayDone: [],
    history: [],
    journalText: '',
    showJournal: false,
    // 气泡冥想
    bubbles: [],
  },

  onShow() {
    const streak = wx.getStorageSync('cultivationStreak') || 0;
    const todayDone = wx.getStorageSync('cultivationToday') || [];
    const history = wx.getStorageSync('cultivationHistory') || [];
    this.setData({ streak, todayDone, history: history.slice(0, 30) });
    this.checkStreak();
  },

  onHide() {
    this.stopTimer();
  },

  checkStreak() {
    const lastDate = wx.getStorageSync('cultivationLastDate');
    const today = new Date().toDateString();
    if (lastDate !== today) {
      // 检查是否连续（昨天）
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      if (lastDate !== yesterday) {
        wx.setStorageSync('cultivationStreak', 0);
        this.setData({ streak: 0 });
      }
      wx.setStorageSync('cultivationToday', []);
      this.setData({ todayDone: [] });
    }
  },

  switchTab(e) {
    this.setData({ tab: e.currentTarget.dataset.t });
  },

  startPractice(e) {
    const id = e.currentTarget.dataset.id;
    const p = this.data.practices.find(x => x.id === id);
    const maxSec = p.duration * 60;
    this.setData({ activePractice: p, timer: 0, timerMax: maxSec, showJournal: id === 'gratitude' });
    if (id !== 'gratitude') this.startTimer();
  },

  startTimer() {
    this.stopTimer();
    this.setData({ timerRunning: true });
    this._timerInterval = setInterval(() => {
      const next = this.data.timer + 1;
      const fmt = (s) => {
        const m = Math.floor(s/60).toString().padStart(2,'0');
        const sec = (s%60).toString().padStart(2,'0');
        return `${m}:${sec}`;
      };
      if (next >= this.data.timerMax) {
        this.setData({ timer: this.data.timerMax, timerStr: fmt(this.data.timerMax), timerRunning: false });
        clearInterval(this._timerInterval);
        this.completePractice();
      } else {
        this.setData({ timer: next, timerStr: fmt(next) });
      }
    }, 1000);
  },

  stopTimer() {
    if (this._timerInterval) {
      clearInterval(this._timerInterval);
      this._timerInterval = null;
    }
    this.setData({ timerRunning: false });
  },

  formatTime(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  },

  onJournalInput(e) {
    this.setData({ journalText: e.detail.value });
  },

  async completePractice() {
    const { activePractice, todayDone, streak } = this.data;
    wx.showToast({ title: '修炼完成！', icon: 'success' });

    const done = [...todayDone];
    if (!done.includes(activePractice.id)) done.push(activePractice.id);

    const today = new Date().toDateString();
    wx.setStorageSync('cultivationLastDate', today);
    wx.setStorageSync('cultivationToday', done);

    const newStreak = done.length >= this.data.practices.length ? streak + 1 : streak;
    wx.setStorageSync('cultivationStreak', newStreak);

    const h = wx.getStorageSync('cultivationHistory') || [];
    h.unshift({
      date: new Date().toLocaleDateString('zh-CN'),
      practice: activePractice.name,
      duration: activePractice.duration,
      journal: this.data.journalText || ''
    });
    wx.setStorageSync('cultivationHistory', h.slice(0, 60));

    this.setData({
      todayDone: done, streak: newStreak,
      activePractice: null, timer: 0, timerRunning: false,
      journalText: '', showJournal: false
    });
  },

  cancelPractice() {
    this.stopTimer();
    this.setData({ activePractice: null, timer: 0, showJournal: false, journalText: '' });
  }
});
