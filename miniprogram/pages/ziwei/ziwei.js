// pages/ziwei/ziwei.js
Page({
  data: {
    hasInput: false,
    birthDate: '',
    birthTime: '',
    gender: '',
    canSubmit: false,
    userInfo: {},
    palaces: []
  },

  onLoad() {
    // 尝试从本地存储恢复
    const saved = wx.getStorageSync('ziwei_input');
    if (saved && saved.birthDate) {
      this.setData({
        hasInput: true,
        birthDate: saved.birthDate,
        birthTime: saved.birthTime,
        gender: saved.gender
      });
      this.generateChart();
    }
  },

  onDateChange(e) {
    this.setData({ birthDate: e.detail.value });
    this.checkCanSubmit();
  },

  onTimeChange(e) {
    this.setData({ birthTime: e.detail.value });
    this.checkCanSubmit();
  },

  onGenderChange(e) {
    this.setData({ gender: e.detail.value });
    this.checkCanSubmit();
  },

  checkCanSubmit() {
    const { birthDate, birthTime, gender } = this.data;
    this.setData({ canSubmit: !!(birthDate && birthTime && gender) });
  },

  onSubmit() {
    if (!this.data.canSubmit) {
      wx.showToast({ title: '请完整填写信息', icon: 'none' });
      return;
    }

    // 缓存输入
    wx.setStorageSync('ziwei_input', {
      birthDate: this.data.birthDate,
      birthTime: this.data.birthTime,
      gender: this.data.gender
    });

    this.setData({ hasInput: true });
    this.generateChart();

    wx.showToast({ title: '命盘已生成', icon: 'success' });
  },

  generateChart() {
    // 简化版：基于时辰生成十二宫位占位数据
    // 实际项目应调用后端紫微排盘引擎
    const palaceNames = ['命宫', '兄弟', '夫妻', '子女', '财帛', '疾厄', '迁移', '交友', '事业', '田宅', '福德', '父母'];
    const majorStars = ['紫微', '天府', '太阳', '武曲', '天同', '廉贞', '天机', '贪狼', '巨门', '天相', '天梁', '七杀'];

    // 简单的哈希分布算法（演示用）
    const seed = (this.data.birthDate + this.data.birthTime).split('').reduce((s, c) => s + c.charCodeAt(0), 0);
    const palaces = palaceNames.map((name, i) => ({
      name,
      majorStar: majorStars[(seed + i) % majorStars.length]
    }));

    this.setData({ palaces });
  },

  onReset() {
    wx.showModal({
      title: '重新排盘',
      content: '确定要清除当前命盘，重新输入出生信息吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('ziwei_input');
          this.setData({
            hasInput: false,
            birthDate: '',
            birthTime: '',
            gender: '',
            canSubmit: false,
            palaces: []
          });
        }
      }
    });
  },

  onShare() {
    wx.showToast({ title: '分享功能开发中', icon: 'none' });
  },

  onShareAppMessage() {
    return {
      title: '我的紫微命盘 - Nexus Ora',
      path: '/pages/ziwei/ziwei'
    };
  }
});
