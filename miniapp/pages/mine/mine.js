const app = getApp();

Page({
  data: {
    profile: null,
    editing: false,
    form: { name: '', birth: '', birthTime: '12:00', gender: 1, city: '' },
    stats: { fortune: 0, dreams: 0, practices: 0 },
    settings: { notification: true, language: 'zh' },
    // 从 fortune 排盘缓存的命盘摘要
    fortuneSummary: null,
  },

  onShow() {
    const p = wx.getStorageSync('userProfile');
    if (p) {
      this.setData({ profile: p });
      app.globalData.userProfile = p;
      // ⚠️ 编辑中不要覆盖 form，否则 picker 关闭后 onShow 触发会冲掉用户刚选的值
      if (!this.data.editing) {
        this.setData({ form: { ...p } });
      }
    }
    this.loadStats();
    // 从首页"设置出生信息"跳转过来时自动打开编辑
    if (app.globalData.pendingAction === 'birth') {
      this.setData({
        editing: true,
        form: p ? { ...p } : { name: '', birth: '', birthTime: '12:00', gender: 1, city: '' }
      });
      app.globalData.pendingAction = null;
    }
  },

  loadStats() {
    const dreams = (wx.getStorageSync('dreamHistory') || []).length;
    const practices = (wx.getStorageSync('cultivationHistory') || []).length;
    const streak = wx.getStorageSync('cultivationStreak') || 0;
    this.setData({ stats: { dreams, practices, streak } });
  },

  startEdit() {
    const p = this.data.profile;
    this.setData({
      editing: true,
      form: p ? { ...p } : { name: '', birth: '', birthTime: '12:00', gender: 1, city: '' }
    });
  },

  cancelEdit() {
    this.setData({ editing: false });
  },

  onNameInput(e)  { this.setData({ 'form.name': e.detail.value }); },
  onBirthChange(e){
    // 用整体替换 form 而非路径赋值，规避部分基础库路径 setData 不触发渲染的 bug
    const form = { ...this.data.form, birth: e.detail.value };
    this.setData({ form });
  },
  onTimeChange(e) {
    const form = { ...this.data.form, birthTime: e.detail.value };
    this.setData({ form });
  },
  onCityInput(e)  { this.setData({ 'form.city': e.detail.value }); },
  setGender(e)    { this.setData({ 'form.gender': Number(e.currentTarget.dataset.g) }); },

  saveProfile() {
    const { form } = this.data;
    if (!form.birth) { wx.showToast({ title: '出生日期不能为空', icon: 'none' }); return; }
    const profile = { ...form, updatedAt: new Date().toISOString() };
    wx.setStorageSync('userProfile', profile);
    app.globalData.userProfile = profile;
    this.setData({ profile, editing: false });
    wx.showToast({ title: '档案已保存', icon: 'success' });
  },

  clearData() {
    wx.showModal({
      title: '清除所有数据',
      content: '将清除本地所有档案、梦境、修行记录，此操作不可恢复',
      confirmText: '确认清除',
      confirmColor: '#EF4444',
      success: (res) => {
        if (res.confirm) {
          wx.clearStorageSync();
          this.setData({ profile: null, form: { name: '', birth: '', birthTime: '12:00', gender: 1, city: '' }, stats: { fortune: 0, dreams: 0, practices: 0 } });
          wx.showToast({ title: '数据已清除', icon: 'success' });
        }
      }
    });
  },

  goPage(e) {
    wx.navigateTo({ url: e.currentTarget.dataset.url });
  },

  contact() {
    wx.showModal({ title: '联系我们', content: '邮箱：support@nexus-ora.app\n微信：nexusora_support', showCancel: false });
  }
});
