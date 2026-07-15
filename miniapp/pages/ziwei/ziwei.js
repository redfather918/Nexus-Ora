const app = getApp();

Page({
  data: {
    birth: '', birthTime: '12:00', gender: 1,
    result: null, loading: false, showResult: false,
    activeTab: 'overview',
    flyGong: '',
    palaceNames: ['命宫','兄弟','夫妻','子女','财帛','疾厄','迁移','交友','官禄','田宅','福德','父母'],
  },

  onBirthChange(e) { this.setData({ birth: e.detail.value }); },
  onTimeChange(e)  { this.setData({ birthTime: e.detail.value }); },
  setGender(e)     { this.setData({ gender: Number(e.currentTarget.dataset.g) }); },
  switchTab(e)     { this.setData({ activeTab: e.currentTarget.dataset.tab }); },
  selectFlyGong(e) { this.setData({ flyGong: e.currentTarget.dataset.g }); },

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

      // 处理十二宫数据（stars 是对象数组）
      let palaces = [];
      if (r.palaces) {
        palaces = r.palaces.map(p => {
          const mainStarObj = (p.stars || []).find(s => s.type === '主星');
          const subStars = (p.stars || []).filter(s => s.type !== '主星').map(s => s.name).join(' ');
          return {
            ...p,
            main_star: mainStarObj ? mainStarObj.name : '',
            stars_str: subStars,
            hasMainStar: !!mainStarObj,
            is_ming: !!p.isMing,
            is_shen: !!p.isShen
          };
        });
      }

      // 提取命盘摘要字段，兼容 WXML 所用变量名
      const mingGong = r.mingGong || {};
      const interpret = mingGong.interpret || {};
      const summary = r.summary || {};

      // 构建宫位解读
      const findPalaceDesc = (name) => {
        const p = (r.palaces || []).find(x => x.name === name);
        if (!p) return '';
        const stars = (p.stars || []).map(s => s.name).join('、');
        return stars ? `${name}宫主星：${stars}` : '';
      };

      const flatResult = {
        ...r,
        palaces,
        qinTian: r.qinTian || null,
        // 命主信息 → WXML 变量
        ming_zhu: `${mingGong.zhi || ''}宫 · ${mingGong.mainStar || ''}坐命`,
        main_star: mingGong.mainStar || '',
        element: interpret.element || '',
        ju_type: interpret.title || '',
        // 宫位解读
        ming_palace_desc: interpret.desc || '',
        career_desc: findPalaceDesc('事业') || (summary['化权'] || ''),
        wealth_desc: findPalaceDesc('财帛') || (summary['化禄'] || ''),
        love_desc: findPalaceDesc('夫妻') || '',
        ai_summary: `${summary['格局'] || ''}。幸运色：${interpret.lucky || '--'}。${summary['化忌'] ? '注意：' + summary['化忌'] : ''}`,
      };

      const firstFly = (r.qinTian && r.qinTian.flyingByPalace && r.qinTian.flyingByPalace[0]) ? r.qinTian.flyingByPalace[0].gong : '';
      this.setData({ result: flatResult, loading: false, showResult: true, activeTab: 'overview', flyGong: firstFly });
    } catch (err) {
      wx.showToast({ title: '排盘失败，请重试', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  reset() { this.setData({ showResult: false, result: null }); }
});
