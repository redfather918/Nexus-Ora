// components/module-card/module-card.js
Component({
  properties: {
    icon: { type: String, value: '' },
    title: { type: String, value: '' },
    desc: { type: String, value: '' },
    bgColor: { type: String, value: 'rgba(168,85,247,0.15)' },
    url: { type: String, value: '' }
  },
  methods: {
    onTap() {
      if (this.data.url) {
        wx.navigateTo({ url: this.data.url })
      }
      this.triggerEvent('tap', { url: this.data.url })
    }
  }
})
