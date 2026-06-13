# Nexus Ora MVP - 人生K线

## 项目简介
Nexus Ora MVP版本，核心功能为"人生K线"可视化，让用户看到命运的形状。

## 技术栈
- **前端**: Next.js 14 + Tailwind CSS + ECharts + Framer Motion
- **后端**: Node.js + Express
- **排盘**: lunar-python (开源)
- **AI**: DeepSeek API
- **数据库**: PostgreSQL
- **支付**: Stripe
- **部署**: Vercel (前端) + Railway (后端)

## 项目结构
```
nexus-ora-mvp/
├── frontend/          # Next.js前端
├── backend/           # Node.js后端
├── docs/             # 文档
└── README.md
```

## 开发计划（4周）
- **Week 1**: 环境搭建 + 排盘库集成 + 基础前端框架
- **Week 2**: AI推理层 + ECharts可视化 + 交互原型
- **Week 3**: 付费墙 + 支付集成 + 截图分享
- **Week 4**: 测试 + 部署 + 冷启动准备

## 快速开始
详见各子目录的README.md

## 开源库使用
- lunar-python: MIT协议，八字排盘
- ECharts: Apache 2.0，数据可视化
- Next.js: MIT协议，前端框架
- Stripe Node SDK: MIT协议，支付集成
