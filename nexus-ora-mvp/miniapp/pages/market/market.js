const app = getApp();

Page({
  data: {
    tab: 'items',
    categories: ['全部', '护身符', '水晶', '开运', '冥想'],
    activeCategory: '全部',
    items: [],
    loading: false,
    cart: [],
    cartCount: 0,
    cartTotal: 0,
  },

  onShow() {
    this.loadItems();
    const cart = wx.getStorageSync('marketCart') || [];
    const cartCount = cart.reduce((s, i) => s + i.qty, 0);
    const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
    this.setData({ cart, cartCount, cartTotal });
  },

  switchTab(e) {
    this.setData({ tab: e.currentTarget.dataset.t });
    if (e.currentTarget.dataset.t === 'items') this.loadItems();
  },

  setCategory(e) {
    this.setData({ activeCategory: e.currentTarget.dataset.cat });
    this.loadItems(e.currentTarget.dataset.cat);
  },

  async loadItems(category = '全部') {
    this.setData({ loading: true });
    try {
      const r = await app.request(`/api/market?category=${encodeURIComponent(category)}`, {}, 'GET');
      let items = r.items || r || [];
      // Demo 数据 fallback
      if (!items.length) {
        items = [
          { id: 1, name: '紫水晶护腕', price: 128, tag: '财运', emoji: '💜', desc: '天然紫水晶，增强直觉与灵性', stock: 12 },
          { id: 2, name: '黑曜石平安扣', price: 88, tag: '护身', emoji: '⚫', desc: '辟邪挡煞，守护平安', stock: 8 },
          { id: 3, name: '五行开运手串', price: 168, tag: '综合', emoji: '📿', desc: '金木水火土五色石材', stock: 5 },
          { id: 4, name: '冥想香薰套装', price: 98, tag: '修行', emoji: '🕯️', desc: '檀香 · 沉香 · 龙涎香', stock: 20 },
          { id: 5, name: '招财貔貅摆件', price: 248, tag: '财运', emoji: '🦁', desc: '铜制镀金，纳财招福', stock: 3 },
          { id: 6, name: '月光石戒指', price: 188, tag: '感情', emoji: '🌙', desc: '增进感情缘分', stock: 7 },
        ];
      }
      this.setData({ items, loading: false });
    } catch {
      this.setData({ loading: false });
    }
  },

  addToCart(e) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.items.find(i => i.id === id);
    if (!item) return;
    const cart = [...this.data.cart];
    const idx = cart.findIndex(c => c.id === id);
    if (idx >= 0) {
      cart[idx].qty += 1;
    } else {
      cart.push({ ...item, qty: 1 });
    }
    const cartCount = cart.reduce((s, i) => s + i.qty, 0);
    const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
    this.setData({ cart, cartCount, cartTotal });
    wx.setStorageSync('marketCart', cart);
    wx.showToast({ title: '已加入购物袋', icon: 'success' });
  },

  removeFromCart(e) {
    const id = e.currentTarget.dataset.id;
    let cart = this.data.cart.filter(c => c.id !== id);
    const cartCount = cart.reduce((s, i) => s + i.qty, 0);
    const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
    this.setData({ cart, cartCount, cartTotal });
    wx.setStorageSync('marketCart', cart);
  },

  checkout() {
    if (!this.data.cart.length) { wx.showToast({ title: '购物袋是空的', icon: 'none' }); return; }
    wx.showToast({ title: '支付功能即将上线', icon: 'none' });
  }
});
