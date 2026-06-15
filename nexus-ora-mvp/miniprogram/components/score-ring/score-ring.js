// components/score-ring/score-ring.js
Component({
  properties: {
    value: { type: String, value: '0' },
    score: { type: Number, value: 0 },
    max: { type: Number, value: 100 },
    color: { type: String, value: '#C084FC' },
    colorEnd: { type: String, value: '#F472B6' },
    label: { type: String, value: '' },
    size: { type: Number, value: 200 },
    valSize: { type: Number, value: 56 },
    strokeWidth: { type: Number, value: 10 }
  },

  lifetimes: {
    attached() {
      this.drawRing()
    }
  },

  observers: {
    'score,color,value': function () {
      this.drawRing()
    }
  },

  methods: {
    drawRing() {
      const query = this.createSelectorQuery()
      query.select('#ringCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res[0]) return
          const canvas = res[0].node
          const ctx = canvas.getContext('2d')
          const dpr = wx.getWindowInfo().pixelRatio
          const size = res[0].width * dpr
          canvas.width = size
          canvas.height = size
          ctx.scale(dpr, dpr)

          const w = res[0].width
          const h = res[0].height
          const cx = w / 2
          const cy = h / 2
          const r = Math.max(1, (Math.min(w, h) / 2) - this.data.strokeWidth)
          const startAngle = -Math.PI / 2
          const ratio = Math.min(this.data.score / this.data.max, 1)
          const endAngle = startAngle + ratio * 2 * Math.PI

          ctx.clearRect(0, 0, w, h)

          // 背景圆环
          ctx.beginPath()
          ctx.arc(cx, cy, r, 0, 2 * Math.PI)
          ctx.strokeStyle = 'rgba(255,255,255,0.06)'
          ctx.lineWidth = this.data.strokeWidth
          ctx.lineCap = 'round'
          ctx.stroke()

          // 前景圆环（渐变）
          if (ratio > 0) {
            const gradient = ctx.createLinearGradient(0, 0, w, 0)
            gradient.addColorStop(0, this.data.color)
            gradient.addColorStop(1, this.data.colorEnd)
            ctx.beginPath()
            ctx.arc(cx, cy, r, startAngle, endAngle)
            ctx.strokeStyle = gradient
            ctx.lineWidth = this.data.strokeWidth
            ctx.lineCap = 'round'
            ctx.stroke()
          }
        })
    }
  }
})
