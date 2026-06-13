# Nexus Ora — 技术需求文档 (TRD)

> 版本：v3.7 | 更新日期：2026-06-13 | 8 大模块全部实现

---

## 1. 架构总览

### 1.1 系统架构图

```
┌─────────────────────────────────────────────────────┐
│                    Browser (Client)                   │
│  ┌─────────────────────────────────────────────────┐ │
│  │         frontend/index.html (SPA)                │ │
│  │   Tailwind CSS (CDN) + ECharts (CDN)            │ │
│  │   Zero-build, 双模块入口（人生K线 + 缘分配对）    │ │
│  └──────────────────┬──────────────────────────────┘ │
└─────────────────────┼────────────────────────────────┘
                      │ HTTP POST
                      │ /api/fortune · /api/compatibility
                      ▼
┌─────────────────────────────────────────────────────┐
│              Node.js Express Server                   │
│              (server_unified.js — v3.7)               │
│  ┌─────────────┬──────────────┬────────────────────┐ │
│  │ Paipan Engine│  LLM Client  │  8 Module Handlers │ │
│  │ (纯 JS)      │ (DeepSeek)   │  K / Compat / Dream│ │
│  │ + Ziwei      │              │  / Persona / Oracle│ │
│  │              │              │  / Cultivation /   │ │
│  │              │              │  / Market / ...    │ │
│  └─────────────┴──────────────┴────────────────────┘ │
│  ┌──────────────────────────────────────────────────┐ │
│  │              sql.js (WASM SQLite)                │ │
│  │  users / fortune_reports / orders / dreams /     │ │
│  │  persona_chat / divinations / checkins /         │ │
│  │  diary / wishlist / events                       │ │
│  └──────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### 1.2 设计原则
- **单进程架构**：一个 Node.js 进程包含 API + 排盘 + 数据库，零外部依赖
- **零构建 (Zero-build)**：前端 CDN 引入，无需 Webpack/Vite 等构建工具
- **渐进增强**：核心功能纯算法实现，AI 功能为可选增强
- **Demo 优先**：无任何配置即可运行，所有功能在 Demo 模式下完整可用

---

## 2. 技术栈明细

| 层级 | 技术 | 版本 | 选型理由 |
|------|------|------|----------|
| 运行时 | Node.js | 22+ | 异步 I/O，轻量级 |
| Web 框架 | Express | 4.x | 成熟稳定，社区庞大 |
| 排盘引擎 | lunar-typescript | latest | 纯 JS，无需 Python |
| AI 服务 | DeepSeek API | v1 | 国产 LLM，中文理解佳 |
| 数据库 | sql.js | latest | WASM SQLite，无需安装 |
| 前端样式 | Tailwind CSS | 3.x (CDN) | 原子化 CSS，开发效率高 |
| 图表库 | ECharts | 5.x (CDN) | 国产图表库，中文文档好 |
| 版本管理 | Git + GitHub | — | 开源托管 |

---

## 3. 模块设计

### 3.1 排盘引擎 (`paipan_engine.js`)

**v3.0 重要变更**：排盘引擎从 Python (`lunar-python`) 迁移为纯 JavaScript (`lunar-typescript`)，不再依赖 `child_process` 调用外部 Python 进程。这解决了 WorkBuddy 沙箱环境下子进程调用受限的问题。

```javascript
// API: 同步函数，返回排盘结果
function paipan({ year, month, day, hour, minute, gender }): PaipanResult

// 返回结构
interface PaipanResult {
    success: boolean
    bazi: { year, month, day, hour, day_gan, day_wuxing, body_strength, strength_score }
    pillars: Array<{ name, ganzhi, gan, zhi, gan_wuxing, zhi_wuxing, shishen }>
    wuxing_balance: { [wuxing: string]: number }
    info: { animal, zodiac, lunar_date, birth_date, gender }
}
```

**核心算法**：
1. 使用 `Solar.fromYmdHms()` 创建阳历对象
2. 通过 `solar.getLunar()` 获取农历对象
3. 提取年月日时四柱干支 (`getYearInGanZhi` 等)
4. 五行映射 (WUXING_MAP)：天干地支 → 金木水火土
5. 十神计算 (SHISHEN_MAP)：以日干为基准，查表获取十神关系
6. 身强身弱判定：日主五行出现次数 ≥3 → 身强，=2 → 中和，≤1 → 身弱

### 3.2 LLM 客户端 (`callLLM`)

- **模型**：`deepseek-chat`
- **格式**：`response_format: { type: 'json_object' }` 强制 JSON 输出
- **超时**：90 秒
- **回退策略**：API 调用失败 → 返回 null → 自动切换到算法模式
- **System Prompt**：30 年资历命理大师角色，严格的 JSON 输出格式约束

### 3.3 算法回退 (`algorithmFortune` / `algorithmDimensions`)

当 DeepSeek API 不可用时，启用纯算法模式：

**运势曲线计算 (`algorithmFortune`)**：
```
score = phase.base + wuxing_bonus + balance_bonus + sin_wave + strength_adjust
```
- `phase.base`：人生阶段基础分（成长期 46 ~ 黄金期 65）
- `wuxing_bonus`：流年天干与日主五行的生克关系 (±10)
- `balance_bonus`：五行分布均匀度奖励 (±7.5)
- `sin_wave`：正弦+余弦自然波动 (±12)
- `strength_adjust`：身强身弱修正

**六维度解读 (`algorithmDimensions`)**：
- 内置 5 种日主五行 × 4 个维度的专家知识库
- 评分 = 基础分 + 运势均分修正
- 贵人和挑战维度根据运势均分动态生成

### 3.5 缘分配对引擎 (`calcCompatibility`) — v3.1 新增

**算法流程**：

```
输入双方出生信息
    ↓
paipan(personA) + paipan(personB)   # 独立排盘
    ↓
┌── 五行分析 ──────────────────────┐
│ 日干五行生克关系（WX_RELATION）   │
│ 相生: 75-90 分（⽣我 / 我⽣）     │
│ 同气: 75 分（同五行）             │
│ 相克: 40-45 分（克我 / 我克）     │
└──────────────────────────────────┘
    ↓
┌── 十神分析 ──────────────────────┐
│ getShishen(dayGan, targetGan)    │
│ A→B + B→A 双向计算               │
│ 理想搭配（正官+正印等 7 组）→ +15 │
└──────────────────────────────────┘
    ↓
┌── 日柱地支 ──────────────────────┐
│ 六合: 90 分（子丑/寅亥/卯戌...）  │
│ 六冲: 30 分（子午/丑未/寅申...）  │
│ 普通: 50 分                       │
└──────────────────────────────────┘
    ↓
┌── 五维评分 ──────────────────────┐
│ personality = wx*0.6 + ss*1.2 + 20│
│ career      = ss为主 + 波动       │
│ romance     = zhi*0.55 + wx*0.3   │
│ communicaton= wx*0.7 + 15         │
│ long_term   = 四维均值            │
└──────────────────────────────────┘
    ↓
五维雷达图 + 五行对比图 + 关系解读
```

**核心映射表**：
- `WX_RELATION`: 五行 → `{ sheng, ke, beiSheng, beiKe }`（生克关系）
- `ZHI_HE`: 6 组地支六合对 → "合"
- `ZHI_CHONG`: 6 组地支六冲对 → "冲"
- `GOOD_SS_PAIRS`: 7 组理想十神配对 → +15 加分
- `getShishen()`: 复用车公排盘引擎的十神计算

### 3.6 数据库设计

**Schema**（sql.js WASM SQLite，零安装）：

| 表名 | 关键字段 | 说明 |
|------|----------|------|
| `users` | id, gender, birth_date | 用户基本信息 |
| `fortune_reports` | id, user_id, report_data, llm_enhanced | 排盘报告（JSON 存储） |
| `orders` | id, report_id, plan, amount, status | 支付订单 |
| `dreams` | id, title, description, mood, dream_date, symbols, east_analysis, west_analysis, summary, luck_score, llm_enhanced | 梦境记录 (v3.3) |
| `persona` | id, user_id, name, archetype, traits, system_prompt, created_at | 虚拟人格画像 (v3.4) |
| `persona_chat` | id, persona_id, role, content, created_at | 人格对话历史 (v3.4) |
| `divination_log` | id, type, payload, result, llm_enhanced, created_at | 占卜记录 (v3.5) |
| `checkins` | id, user_id, task_id, task_type, checkin_date, created_at | 修行打卡 (v3.6) |
| `diary` | id, user_id, mood, energy, gratitudes, reflection, diary_date | 能量日记 (v3.6) |
| `wishlist` | id, user_id, item_id, item_type, created_at | 心愿单 (v3.7) |

---

## 4. API 接口

### 4.1 健康检查
```
GET /api/health
Response: { status: "ok", version: "3.0.0", llm: boolean, db: boolean }
```

### 4.2 运势计算（主接口）
```
POST /api/fortune
Body: { year, month, day, hour?, minute?, gender? }
Response: {
    success: true,
    report_id: string,
    data: {
        bazi: PaipanResult,
        fortune: Array<{age,score,level,phase,event}> (101 items),
        dimensions: { career, wealth, relationships, health, mentors, challenges },
        summary: { average_score, peak_age, valley_age, best_ages, caution_ages, overview },
        ai_enhanced: boolean
    }
}
```

### 4.3 报告查询
```
GET /api/report/:id
Response: { success: true, data: ReportData }
```

### 4.4 支付相关
```
POST /api/payment/create-checkout   # 创建支付会话
POST /api/payment/verify            # 验证支付状态
```

### 4.5 缘分配对（v3.1 新增）
```
POST /api/compatibility
Body: {
    personA: { year, month, day, hour?, minute?, gender? },
    personB: { year, month, day, hour?, minute?, gender? }
}
Response: {
    success: true,
    personA: { bazi, info, pillars, wuxing_balance },
    personB: { bazi, info, pillars, wuxing_balance },
    compatibility: {
        relation_type: "天作之合" | "五行相生" | "十神相合" | "欢喜冤家" | "平常之缘",
        relation_icon, relation_desc,
        wx_relation: "木生火" | "金克木" 等,
        wx_score: number,           // 五行匹配度 0-100
        ss_a_to_b: string,          // A对B的十神关系
        ss_b_to_a: string,          // B对A的十神关系
        zhi_relation: "六合" | "六冲" | "普通",
        zhi_score: number,          // 日柱地支匹配度
        dimensions: {
            personality:  { score, label: "性格互补" },
            career:       { score, label: "事业合作" },
            romance:      { score, label: "感情契合" },
            communicaton: { score, label: "沟通默契" },
            long_term:    { score, label: "长期发展" }
        },
        overall_score: number,
        radar_data: [{ element, personA, personB }],
        advice: string[]
    }
}
```

### 4.6 紫微斗数 (v3.2)
```
POST /api/ziwei
Body: { year, month, day, hour?, minute?, gender? }
Response: { success, data: { 命宫, 身宫, 十二宫, 主星, 辅星, 四化 } }
```

### 4.7 梦境回廊 (v3.3)
```
POST /api/dream       # 录入并解析梦境
GET  /api/dreams      # 列出历史
GET  /api/dream/trend # 趋势数据
DELETE /api/dream/:id # 删除
```

### 4.8 灵境人格 (v3.4)
```
POST /api/persona/generate   # 生成虚拟人格画像
Body: { year, month, day, hour?, gender? }
Response: {
  persona: { name, archetype, traits[], speaking_style, avatar, system_prompt }
}

POST /api/persona/chat       # 与人格对话
Body: { persona_id, message }
Response: { reply, ai_enhanced }

GET  /api/persona/history    # 获取对话历史
POST /api/persona/reset      # 重置人格
```

### 4.9 灵境占卜 (v3.5)
```
POST /api/divination/tarot
Body: { spread: 'single' | 'three' | 'celtic', question: string }
Response: { cards: [{ name, upright, position, meaning }], interpretation }

POST /api/divination/jiaobei
Body: { question: string }
Response: { result: '圣杯' | '阴杯' | '阳杯', throws: [bool, bool], interpretation }

GET  /api/divination/daily
# 基于日期 + 用户八字生成稳定签文
Response: { qian_id, level, poem, story, advice }
```

### 4.10 灵境修行 (v3.6)
```
GET    /api/cultivation/today        # 今日打卡任务
POST   /api/cultivation/checkin      # 完成任务 { task_id }
GET    /api/cultivation/stats        # 修行统计 (streak, level, total)
GET    /api/cultivation/meditation   # 冥想场景列表
GET    /api/cultivation/meditation/:id  # 获取引导脚本
POST   /api/cultivation/diary        # 写日记 { mood, energy, gratitudes[], reflection }
GET    /api/cultivation/diary        # 日记列表（按日期）
GET    /api/cultivation/diary/trend   # 7/30/90 天情绪趋势
```

### 4.11 灵境市集 (v3.7)
```
GET   /api/market/digital      # 数字周边商品
GET   /api/market/crystals     # 水晶列表
GET   /api/market/events       # 线下活动
POST  /api/market/wishlist     # 加入心愿单 { item_id, type }
GET   /api/market/wishlist     # 我的心愿单
```

---

## 5. 文件结构

```
nexus-ora-mvp/
├── frontend/
│   └── index.html              # 单页应用 (2480+ 行)
├── backend/
│   ├── server_unified.js       # Express 服务器 (640+ 行)
│   ├── paipan_engine.js        # JS 排盘引擎 (130+ 行)
│   ├── paipan_engine.py        # Python 排盘引擎 (保留参考)
│   ├── verify.js               # 全链路验证测试
│   ├── package.json            # Node.js 依赖
│   └── .env.example            # 环境变量模板
├── docs/
│   ├── PRD.md                  # 产品需求文档
│   └── TRD.md                  # 技术需求文档
└── README.md                   # 项目说明
```

---

## 6. 部署说明

### 6.1 本地开发

```bash
cd backend
npm install
node server_unified.js
# 访问 http://127.0.0.1:3000
```

### 6.2 环境要求
- Node.js >= 18（推荐 22+）
- 无需 Python（v3.0 起完全 JS 化）
- 无需数据库安装（sql.js WASM 内置）
- 无需 API Key（Demo 模式完整可用）

### 6.3 配置项

| 变量 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `PORT` | 否 | `3000` | 服务器端口 |
| `HOST` | 否 | `127.0.0.1` | 绑定地址（部署时务必设 `0.0.0.0`） |
| `DEEPSEEK_API_KEY` | 否 | 空 | DeepSeek API Key |
| `STRIPE_SECRET_KEY` | 否 | 空 | Stripe 私钥 |

### 6.4 前端 API 地址设计 (v3.1.1 修复)

**原则**：前端不硬编码服务器地址和端口，使用相对路径自动适配。

```js
// ❌ 旧版（导致部署后 Demo 模式问题）
const API_BASE = 'http://127.0.0.1:3000';

// ✅ 新版（自动适配当前域名端口）
const API_BASE = '';
```

**理由**：前端由 Express `app.use(express.static(...))` 托管，与 API 天然同域。使用空字符串后，`/api/fortune` 等请求自动命中当前服务器的 API 路由，无论部署在哪个端口/域名下都不需要修改前端代码。

### 6.5 部署检查清单

| 检查项 | 本地开发 | 服务器部署 |
|--------|----------|------------|
| `.env` HOST | `127.0.0.1` | `0.0.0.0` |
| `.env` PORT | `3000` | 任意可用端口 |
| API_BASE（前端） | `''`（自动适配） | `''`（不用改） |
| 防火墙 | 无需额外配置 | 开放对应端口 |

---

## 7. 架构决策记录 (ADR)

### ADR-001: Zero-build 前端
- **决策**：使用 CDN 引入 Tailwind CSS + ECharts，不引入构建工具
- **理由**：MVP 阶段降低复杂度，前端仅一个 HTML 文件
- **影响**：未来如需组件化，需引入构建工具

### ADR-002: 单进程架构
- **决策**：Express + sql.js + 排盘引擎在同一 Node.js 进程中
- **理由**：简化部署，零外部服务依赖
- **影响**：不支持横向扩展（MVP 阶段可接受）

### ADR-003: 纯 JS 排盘引擎 (v3.0)
- **决策**：用 `lunar-typescript` 替换 Python `child_process` 调用
- **理由**：解决 WorkBuddy 沙箱环境中子进程调用受限问题；简化部署（无需 Python 环境）
- **影响**：排盘性能提升（无 IPC 开销）；降低环境依赖
- **替代方案**：保留 Python 引擎并通过 HTTP 微服务调用（复杂度高，不采用）

### ADR-004: 中国股市色系
- **决策**：运势曲线红涨绿跌（与欧美正相反）
- **理由**：目标用户为中国用户，遵循国内金融惯例
- **影响**：国际化时需提供颜色切换选项

### ADR-005: Demo 优先设计
- **决策**：所有付费功能在无 API Key 时自动启用 Demo 模式
- **理由**：降低使用门槛，任何人都可零配置体验完整功能
- **影响**：需在 UI 中明确标注 Demo 模式状态

### ADR-006: 缘分配对纯算法实现 (v3.1)
- **决策**：合盘计算完全基于排盘引擎输出的五行/十神/地支数据，不依赖 LLM
- **理由**：排盘引擎提供足够精确的结构化数据（干支五行十神），算法计算的确定性优于 LLM 的随机性
- **影响**：响应速度极快（<100ms），结果可复现；未来可通过 LLM 增强关系解读文案
- **关键组件**：五行生克映射表 (WX_RELATION)、地支六合六冲表、理想十神配对表

### ADR-007: 前端 API 地址相对路径 (v3.1.1)
- **决策**：前端 `API_BASE` 从硬编码 `http://127.0.0.1:3000` 改为空字符串（相对路径）
- **理由**：前端由 Express 同进程托管，使用相对路径后自动适配任意部署环境（不同端口/域名），无需每次部署手动修改前端代码
- **影响**：本地开发与生产部署无需切换配置；降低因端口不匹配进入 Demo 模式的风险

### ADR-008: 模块化路由组织 (v3.7)
- **决策**：8 大模块 API 全部内联在 `server_unified.js` 中，不拆分为独立 router 文件
- **理由**：单进程架构下，所有 handler 在同一闭包中可共享 `db` / `LLM` / `paipan` 等核心对象，无需额外导入；按模块顺序在文件中排列，便于阅读
- **影响**：文件较长（1500+ 行），但避免了跨文件 import 复杂度；如未来拆分可按模块 ID 切分
- **代码组织约定**：`// ────── {模块名} API ──────` 分隔符标记每个模块

### ADR-009: 算法回退一致性 (v3.3-v3.7)
- **决策**：所有调用 LLM 的接口都必须有对应的 `algorithmXxx()` 本地算法回退
- **理由**：Demo 模式可零配置使用所有功能；LLM 不稳定时服务仍可用
- **影响**：开发每个新模块需同步实现算法版本；前端通过 `ai_enhanced` 字段判断本次是否走 LLM

### ADR-010: 八字 → 虚拟人格映射 (v3.4)
- **决策**：灵境人格画像完全由八字结构化数据（日主/十神/五行）生成，不调用 LLM
- **理由**：八字数据本身已携带足够性格信息；算法生成的"人设"是稳定可复现的（同一八字 → 同一人格）
- **关键映射**：
  - 日主 → 五德（仁/礼/信/义/智）
  - 最强十神 → 主特质
  - 五行缺失 → 性格弱点
  - 性别 → 虚拟伴侣性别（默认异性）
- **对话部分**：才用 LLM（注入 system_prompt 后），无 LLM 时返回预设话术库

### ADR-011: 占卜随机性设计 (v3.5)
- **决策**：塔罗 / 杯筊 / 签文使用 `Math.random()` 而非 deterministic hash
- **理由**：占卜体验需"不确定性"和"惊喜感"；同一用户每次问卜可得到不同结果（除每日一签外）
- **例外**：每日一签用 `hash(date + user_id)` 保证每天稳定
- **影响**：占卜结果不可复现，符合神秘学体验

### ADR-012: 灵境市集 Demo 模式 (v3.7)
- **决策**：商品和活动仅展示，不实现真实下单 / 支付 / 库存逻辑
- **理由**：MVP 阶段聚焦"内容+AI"，电商非核心；商品数据硬编码在 `MARKET_DATA` 常量中
- **影响**：心愿单可正常增删，但点击"购买"显示"Demo 模式"提示

---

## 8. 测试策略

| 测试类型 | 工具 | 覆盖范围 |
|----------|------|----------|
| 单元测试 | `verify.js` | 排盘引擎 34 项全链路验证 |
| API 测试 | curl / Postman | `/api/fortune` 主接口 |
| 手动测试 | 浏览器 | 前端 UI 交互验证 |

---

## 9. 开源依赖清单

| 库名 | 许可证 | 用途 |
|------|--------|------|
| lunar-typescript | MIT | 八字排盘核心（前身 lunar-python） |
| express | MIT | Web 服务器 |
| cors | MIT | CORS 中间件 |
| dotenv | MIT | 环境变量 |
| sql.js | MIT | WASM SQLite 数据库 |
| stripe | MIT | 支付集成（可选） |
| ECharts | Apache 2.0 | 图表渲染（CDN） |
| Tailwind CSS | MIT | 样式框架（CDN） |
