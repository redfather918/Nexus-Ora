# Nexus Ora — AI 原生玄学平台 MVP

> **人生 K 线** · 用东方命理 × AI 预测你的人生运势曲线

[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-22+-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?logo=python&logoColor=white)](https://python.org)

---

## ✨ 功能特性

- 🔮 **精准八字排盘** — 基于 `lunar-python` 开源库，年月日时四柱精确计算
- 📈 **人生 K 线可视化** — ECharts 折线图，中国股市红涨绿跌惯例
- 🤖 **AI 运势解读** — DeepSeek LLM 预测 0-100 岁运势曲线 + 六维度深度分析
- 🔒 **付费解锁机制** — Stripe 支付（Demo 模式无需配置，一键体验）
- 💾 **本地数据持久化** — sql.js (WASM SQLite)，无需安装数据库
- 🌙 **零配置启动** — 无 API Key 时自动回退算法模式，双击 HTML 即可预览

---

## 🚀 快速开始

### 方式一：纯前端预览（无需服务器）

直接双击打开 `frontend/index.html`，即可体验完整 Demo。

### 方式二：完整功能（推荐）

```bash
# 1. 克隆项目
git clone https://github.com/redfather918/Nexus-Ora.git
cd Nexus-Ora

# 2. 安装 Node.js 依赖
cd backend
npm install

# 3. 安装 Python 依赖
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Mac/Linux
pip install lunar-python

# 4. 配置环境变量（可选）
copy .env.example .env
# 编辑 .env，填入 DEEPSEEK_API_KEY 和 STRIPE_SECRET_KEY

# 5. 启动服务器（前台运行）
node server_unified.js

# 6. 浏览器访问
# http://127.0.0.1:3000
```

---

## ⚙️ 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 服务器端口 | `3000` |
| `DEEPSEEK_API_KEY` | DeepSeek API Key（可选） | 空（使用算法模式） |
| `STRIPE_SECRET_KEY` | Stripe 私钥（可选） | 空（使用 Demo 模式） |
| `STRIPE_PUBLISHABLE_KEY` | Stripe 公钥（可选） | 空 |

> **注意**：所有 API Key 均为可选。不配置时自动启用 Demo 模式，全部功能可用。

---

## 🏗️ 项目结构

```
nexus-ora-mvp/
├── frontend/
│   └── index.html          # 完整 SPA（Tailwind CSS + ECharts，CDN 引入）
├── backend/
│   ├── server_unified.js   # Express 主服务器（API + DB + AI + 支付）
│   ├── paipan_engine.py    # Python 八字排盘引擎（lunar-python）
│   ├── verify.js           # 全链路验证测试（34 项）
│   ├── package.json
│   └── .env.example
└── README.md
```

---

## 🛠️ 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端 | Tailwind CSS + ECharts | CDN 引入，Zero-build |
| 后端 | Node.js + Express | 单进程，无需构建 |
| 排盘 | Python + lunar-python | child_process 调用 |
| AI | DeepSeek API | 可选，回退算法模式 |
| 数据库 | sql.js (WASM SQLite) | 无需安装，纯 JS |
| 支付 | Stripe | 可选，回退 Demo 模式 |

---

## 📊 运势颜色规则

遵循中国股市惯例：
- 🔴 **红色** = 运势上涨（大吉 / 小吉）
- 🟢 **绿色** = 运势下跌（大凶 / 小凶）
- ⚪ **灰色** = 平稳

---

## 📝 开发路线图

- [x] MVP：八字排盘 + 人生 K 线 + AI 解读
- [x] 付费解锁 + 数据持久化
- [x] 自包含前端（无服务器可用）
- [ ] 紫微斗数模块
- [ ] 流年运势日历
- [ ] 合婚测算
- [ ] 移动端 App

---

## 📄 License

MIT © 2026 Nexus Ora
