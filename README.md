# Nexus Ora — AI 原生玄学平台 MVP

人生 K 线 · 用东方命理 × AI 预测你的人生运势曲线

License: MIT Node.js Pure JS

✨ 功能特性
🔮 精准八字排盘 — 基于 lunar-typescript 开源库，纯 JS 实现，年月日时四柱精确计算
📈 人生 K 线可视化 — ECharts 折线图，中国股市红涨绿跌惯例
🤖 AI 运势解读 — DeepSeek LLM 预测 0-100 岁运势曲线 + 六维度深度分析
🔊 算法回退 — 无 AI Key 时自动使用五行生克算法，离线完整可用
💾 本地数据持久化 — sql.js (WASM SQLite)，无需安装数据库
🌐 零配置启动 — 无需 Python、无需 API Key，一条命令即可运行

---

## 🚀 快速开始

### 一条命令启动

```bash
cd backend
npm install
node server_unified.js
# 浏览器打开 http://127.0.0.1:3000
```

> **无需 Python！** v3.0 起排盘引擎已完全 JavaScript 化，不再需要 Python 环境。

### 配置 AI 增强（可选）

```bash
cp .env.example .env
# 编辑 .env，填入 DEEPSEEK_API_KEY（不填则使用算法模式）
```

---

## ⚙️ 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 服务器端口 | `3000` |
| `DEEPSEEK_API_KEY` | DeepSeek API Key（可选） | 空（算法模式） |
| `STRIPE_SECRET_KEY` | Stripe 私钥（可选） | 空（Demo 模式） |
| `UNLOCK_FULL_REPORT` | 推广模式：true 时完整报告对所有人免费 | `false` |
| `SHARE_URL` | 分享图二维码域名（留空回退当前域名） | 空 |

---

## 🏗️ 项目结构

```
nexus-ora-mvp/
├── frontend/
│   └── index.html           # 完整 SPA（Tailwind CSS + ECharts，CDN 引入）
├── backend/
│   ├── server_unified.js    # Express 主服务器（API + AI + DB + 支付）
│   ├── agents/              # 多智能体议会（盘师/运师/世师 + 主笔人）
│   ├── swarm_fortune.js     # 群体涌现运势预测
│   ├── life_sandbox.js      # 人生沙盘推演（平行世界线）
│   ├── paipan_engine.js     # JS 八字排盘引擎（lunar-typescript）
│   └── package.json
├── docs/
│   ├── PRD.md               # 产品需求文档
│   └── TRD.md               # 技术需求文档
└── README.md
```

---

## 🛠️ 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端 | Tailwind CSS + ECharts | CDN 引入，Zero-build |
| 后端 | Node.js + Express | 单进程，直接启动 |
| 排盘 | **lunar-typescript (纯 JS)** | v3.0 迁移，无 Python 依赖 |
| AI | DeepSeek API | 可选，回退算法模式 |
| 数据库 | sql.js (WASM SQLite) | 无需安装，纯 JS |
| 支付 | Stripe | 可选，回退 Demo 模式 |

---

## 📊 运势颜色规则

遵循**中国股市惯例**（与欧美色系相反）：
- 🔴 **红色** = 运势上涨（大吉 / 小吉）
- 🟢 **绿色** = 运势下跌（大凶 / 小凶）
- ⚪ **灰色** = 平稳

---

## 🏛️ 架构决策

| 决策 | 内容 | 理由 |
|------|------|------|
| ADR-003 | **纯 JS 排盘** | 消除 Python 子进程依赖，适配沙箱环境 |
| ADR-001 | Zero-build 前端 | MVP 阶段降低复杂度 |
| ADR-002 | 单进程架构 | 简化部署，零外部服务 |
| ADR-005 | Demo 优先 | 零配置即可体验完整功能 |

详见 [TRD.md](docs/TRD.md)

---

## 📝 开发路线图

- [x] MVP：八字排盘 + 人生 K 线 + AI 解读
- [x] 纯 JS 排盘引擎（v3.0）
- [x] 多智能体议会解读 + 群体涌现算法
- [x] 人生沙盘推演 + 引擎透视可视化
- [x] 付费解锁 + 数据持久化 + 推广模式开关
- [ ] 紫微斗数模块
- [ ] 流年运势日历
- [ ] 合婚测算
- [ ] 移动端 PWA

---

## 📄 License

MIT © 2026 Nexus Ora
