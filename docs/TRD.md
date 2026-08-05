# Nexus Ora — 技术需求文档 (TRD)

> 版本：v6.1 | 更新日期：2026-08-03 | 9 大模块（v6.0 新增灵境数测）+ 微信小程序 v4.4.5 + 会员订阅 v5.0 + PayPal + 全站 SEO + 多语言 i18n + 钦天四化（北派飞星）v5.1 + 推演引擎 v5.2 + 产品策略升级 v6.0

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
│  ┌─────────────────────────────────────────────────┐ │
│  │    frontend/share_cards.html (分享主图生成器)     │ │
│  │    8 张 9:16 竖版主题卡片, 星空光晕+粒子          │ │
│  └──────────────────┬──────────────────────────────┘ │
└─────────────────────┼────────────────────────────────┘
                      │ HTTP POST
                      │ /api/fortune · /api/compatibility
                      ▼
┌─────────────────────────────────────────────────────┐
│              Node.js Express Server                   │
│              (server_unified.js — v3.9)               │
│  ┌─────────────┬──────────────┬────────────────────┐ │
│  │ Paipan Engine│  LLM Client  │  9 Module Handlers │ │
│  │ (纯 JS)      │ (DeepSeek)   │  K / Compat / Dream│ │
│  │ + Ziwei      │              │  / Persona / Oracle│ │
│  │              │              │  / Cultivation /   │ │
│  │              │              │  / Market / Number │ │
│  │ + Payments   │ + Membership │  + Admin Config   │ │
│  │ (Stripe +    │ (free/      │  (runtime hot     │ │
│  │  PayPal)     │  monthly/    │  config update)   │ │
│  │              │  annual)     │                   │ │
│  └─────────────┴──────────────┴────────────────────┘ │
│  ┌──────────────────────────────────────────────────┐ │
│  │              sql.js (WASM SQLite)                │ │
│  │  users / fortune_reports / orders / dreams /     │ │
│  │  persona_chat / divinations / checkins /         │ │
│  │  diary / wishlist / events / auth_users /        │ │
│  │  subscriptions / admin_config                   │ │
│  └──────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│           微信小程序 (v4.4.5 — 已完成)                 │
│  ┌─────────────────────────────────────────────────┐ │
│  │       miniapp/ (原生微信小程序)                   │ │
│  │   pages/: index/fortune/radar/compatibility/      │ │
│  │          ziwei/dream/persona/divination/          │ │
│  │          cultivation/market/mine                 │ │
│  │   components/: navbar/card/ring/chart             │ │
│  │   utils/: api.js i18n.js auth.js                 │ │
│  └──────────────────┬──────────────────────────────┘ │
└─────────────────────┼────────────────────────────────┘
                      │ HTTPS (同后端 API)
                      ▼
              复用现有 Express 后端
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
| 支付 | Stripe + PayPal | MIT / PayPal REST | 双通道收款（Web 端） |
| 配置热更新 | Admin 配置页 | — | 运行时热更新支付/LLM 配置 |

---

## 3. 模块设计

### 3.7 钦天四化引擎（`ziwei_engine.js` — v5.1 新增）

**背景**：在现有紫微斗数排盘引擎（v3.2，`ziwei()` 函数）基础上，新增北派飞星（钦天四化）分析。复用已有的排盘结果（十二宫星曜、四化表 `SI_HUA_TABLE`），不引入新依赖。

**核心算法**：

```
ziwei() 排盘完成（命宫/身宫/十二宫星曜/生年四化标注）
    ↓
computeQinTian(palaces, yearGan)
    ↓
┌── ① 安宫干（五虎遁） ─────────────────┐
│ getPalaceStems(yearGan):              │
│   寅宫天干 = WUHU_DUN[yearGan]         │
│   （甲己→丙 乙庚→戊 丙辛→庚            │
│    丁壬→壬 戊癸→甲，对应 GAN 下标）    │
│   各宫干 = GAN[(寅干Idx + (zhiIdx-2)  │
│              mod12) mod10]            │
│   写入 palace.gan                      │
└──────────────────────────────────────┘
    ↓
┌── ② 来因宫 ───────────────────────────┐
│ laiYin = 宫干 == yearGan 之宫          │
│ （五虎遁下每干唯一落宫，确定性）       │
└──────────────────────────────────────┘
    ↓
┌── ③ 生年四化落宫 ─────────────────────┐
│ SI_HUA_TABLE[yearGan] → 四星           │
│ 每星查 starToPalace 映射得落宫         │
└──────────────────────────────────────┘
    ↓
┌── ④ 十二宫宫干飞星（48 条） ──────────┐
│ 每宫宫干 g → SI_HUA_TABLE[g]           │
│ 四化 → 星 → 查落宫 → 记录 from/to      │
└──────────────────────────────────────┘
    ↓
┌── ⑤ 自化识别 ─────────────────────────┐
│ 离心自化：本宫 g 所化之星落本宫         │
│   （flyingStars 中 isSelf=true）       │
│ 向心自化：对宫 g 所化之星飞入本宫       │
└──────────────────────────────────────┘
    ↓
qinTian: { laiYin, shengNian, flyingStars,
           flyingByPalace, ziHua, xinHua, meaning }
```

**关键映射表**：
- `WUHU_DUN`：年干 → 寅宫天干（五虎遁口诀），决定十二宫宫干分布
- `SI_HUA_TABLE`：年干/宫干 → 化禄/化权/化科/化忌 四星（已存在，复用）
- `SI_HUA_CODE`：四化代号 A/B/C/D（钦天派记法）
- `SI_HUA_MEANING`：四化象义（无吉凶，只分态度：禄多缘/权善变/科情份/忌亏欠）

**数据结构**：
```javascript
qinTian = {
  laiYin:       { name, zhi, zhiIdx, gan },          // 来因宫
  shengNian:    [ { hua, code, star, palaceName, zhi, zhiIdx, meaning } ],  // 4 项
  flyingStars:  [ { fromGong, fromZhi, fromGan, hua, code, star, isSelf, toGong, toZhi, toZhiIdx } ],  // 48 项
  flyingByPalace: [ { gong, zhi, gan, flies:[...] } ],  // 12 组，便于前端按宫查看
  ziHua:        [ { gong, zhi, gan, hua, code, star } ],   // 离心自化
  xinHua:       [ { gong, zhi, gan, hua, code, star, fromGong } ],  // 向心自化
  meaning:      SI_HUA_MEANING
}
```

**集成点**：
- `ziwei_engine.js`：`ziwei()` 末尾调用 `computeQinTian()`，结果挂入返回对象 `qinTian`
- `server_unified.js` `/api/ziwei`：已返回 `{ success, data: result }`，`qinTian` 随 `result` 透传（无需改路由）
- 前端 Web（`index.html`）：紫微结果区新增「钦天四化·北派飞星」卡片（来因宫/生年四化/自化/飞星轨迹 Tab）
- 小程序（`pages/ziwei`）：新增「钦天四化」Tab，复用 `qinTian` 字段

**测试要点**：
- 来因宫：甲年→戌宫、戊年→子宫、癸年→寅宫（五虎遁确定性校验）
- 生年四化落宫与主星落宫一致
- 飞星总数恒为 48（12 宫 × 4 化）
- 离心自化 ⊂ 飞星（isSelf=true），向心自化为对宫互映射
- 纯算法、无 LLM、可复现（同输入同输出）

### 3.8 灵境数测引擎（`server_unified.js` — v6.0 新增）

**背景**：v6.0 新增的「灵境数测」模块，用数字能量学（八星）对手机号 / 车牌号 / 电动车牌号做趣味测算。定位为**低门槛拉新与社交裂变入口**，因此采用**纯算法实现、零 LLM 依赖、可离线运行**，与 ADR-009（算法回退一致性）原则一致。

**核心算法（`computeNumberEnergy(raw, kind)`）**：

```
输入号码字符串（自动去非数字）
    ↓
digits = raw.replace(/\D/g, '')          // 仅保留数字
if (digits.length < 2) return { ok:false, error:'号码至少需要 2 位数字' }
    ↓
① 相邻两位配对（共 n = len-1 对）
   for i in 0..n-1:
     v = parseInt(digits.substr(i,2))
     star = NUMBER_STARS[v]              // 查八星映射表，未命中为 null
     pairs.push({ pair, star, level })   // level ∈ 吉/中/凶/—
    ↓
② 星统计 + 加权
   starCounts[star]++ ;  weightSum += STAR_WEIGHT[star]
    ↓
③ 评分（夹紧 1–99，沿用运势等级红涨绿跌）
   score = round(50 + (weightSum / n) * 2.6)
   score = clamp(score, 1, 99)
    ↓
④ 五行分布
   for d in digits: wuxing[WUXING_DIGIT[d]]++
    ↓
⑤ 等级 + 解读
   grade = 大吉(≥75)/小吉(≥60)/平稳(≥45)/小凶(≥30)/大凶(<30)
   interpretation = kindName + 主导星象 + 能量建议 + 免责声明
    ↓
返回 { ok, digits, pairs, starCounts, wuxing, score, grade, gradeColor, interpretation, kindName }
```

**关键映射表**：

| 表名 | 内容 |
|------|------|
| `NUMBER_STARS` | 两位数 → 八星：天医(13/31/68/86)、延年(19/91/78/87)、生气(14/41/67/76)、伏位(11/22/33/44/66/77/88/99)、六煞(16/61/47/74)、祸害(17/71/89/98)、五鬼(18/81/79/97)、绝命(12/21/69/96) |
| `STAR_LEVEL` | 天医/延年/生气=吉，伏位=中，六煞/祸害/五鬼/绝命=凶 |
| `STAR_WEIGHT` | 天医 18 / 延年 15 / 生气 12 / 伏位 4 / 六煞 −12 / 祸害 −14 / 五鬼 −16 / 绝命 −20 |
| `WUXING_DIGIT` | 1/6 水、2/7 火、3/8 木、4/9 金、5/0 土 |
| `STAR_DESC` | 八星象义（天医主财姻、延年主事业健康、生气主人缘、伏位主平稳、六煞主感情波折、祸害主口舌、五鬼主变动、绝命主大耗） |

**集成点**：
- `server_unified.js` `POST /api/number-fortune`：解析 `{ number, kind }`，调用 `computeNumberEnergy`，成功返回 `{ success:true, ...r }`，失败返回 `{ success:false, message }`。
- 前端 `index.html`：灵境数测模块（`switchModule('number')`）调用该接口渲染分数环、八星分布、五行条与解读；红涨绿跌。
- `kind` 仅影响 `kindName` 文案（手机号/车牌号/电动车牌号），不改变算法。

**测试要点**：
- 边界：数字 < 2 位返回 `ok:false`（如单数字 "1" 返回错误）。
- 可复现：同号码同 `kind` 恒得同分（无随机性）。
- 等级阈值与 §2.4 运势等级一致；`gradeColor` 红涨绿跌（大吉=红 #ef4444，大凶=绿 #16a34a）。
- 零外部依赖：不调用 LLM、不读写数据库、不依赖网络。

### 3.9 命理分值与后天精进引擎（`server_unified.js` — v6.2 新增）

**背景**：采纳专家 Wilson review 五项建议，新增一组**纯算法、零 LLM、可离线**的命理量化能力：先天三分数、后天精进多维加权、加权综合、命理画像具象化、服务分层白名单与四层阶梯配置。与 ADR-009（算法回退一致性）一脉相承。

**历法常量**（模块级，`server_unified.js` 顶部）：

```
GAN  = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸']
ZHI  = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥']
GAN_WX = { 甲/乙:木, 丙/丁:火, 戊/己:土, 庚/辛:金, 壬/癸:水 }
ZHI_WX = { 寅/卯:木, 巳/午:火, 辰/戌/丑/未:土, 申/酉:金, 亥/子:水 }
WX_SHENG = { 木:'火', 火:'土', 土:'金', 金:'水', 水:'木' }   // 我生
WX_KE    = { 木:'土', 土:'水', 水:'火', 火:'金', 金:'木' }   // 我克
```

**五行关系打分 `wxRelationScore(dayWx, otherWx)`**（以日主五行 `dayWx` 为基准）：

| 关系 | 条件 | 分值 |
|------|------|------|
| 生我（印） | `WX_SHENG[other] === day` | +0.8 |
| 我生（食伤） | `WX_SHENG[day] === other` | −0.2 |
| 克我（官杀） | `WX_KE[other] === day` | −0.6 |
| 我克（财） | `WX_KE[day] === other` | +0.1 |
| 同我（比劫） | `other === day` | +0.3 |
| 其他 | — | 0 |

**大运干支 `computeDayunGanZhi(yearGan, monthGZ, gender, age)`**：从月柱起，阳年男/阴年女顺排（`dir=+1`），反之逆排（`dir=−1`）；按 `floor(age/10)` 步向前/后推算（简化模型，忽略起运岁数）。

**先天气运三分数 `computeInnateScores(birth)`**（基于八字 + 大运 + 流年 12 字，简化可复现模型）：

| 分数 | 公式 | 含义 |
|------|------|------|
| 生命禀赋值 `life_endowment` | `clamp(0.5·身强分 + 0.3·五行平衡分 + 0.2·吉神占比×100, 1, 99)` | 先天命格底盘 |
| 大运生命值 `dayun_value` | `clamp(50 + wxRelationScore(日主五行, 大运五行)·40, 1, 99)` | 当前十年大运与日主契合度 |
| 今年生命力活跃度 `year_vitality` | `clamp(50 + wxRelationScore(日主五行, 流年五行)·40, 1, 99)` | 当年度气运活跃度 |
| 综合 `overall` | `clamp((三者和)/3, 1, 99)` | 先天均分（用于加权） |

其中：身强分取自 `paipan` 的 `bazi.strength_score`；五行平衡分 = `(1 − (max−min)/total)·100`；吉神占比 = 十神中 正印/正官/食神/正财/比肩 占比。

**后天精进单日评分 `computeCultivationScore(e)`**（仿蚂蚁信用多维加权）：

- 正向：`(reading_min/30)·3 + sleepScore + (exercise_min/30)·2 + (charity_min/30)·2`
  - `sleepScore`：睡眠 7–8h = 5；6–<7 或 8–≤9 = 3；其余 = 1
- 负向（penalty）：`anger·2 + lack_sleep·3 + drinking·4 + sugar·3 + coffee·1 + smoking·6`
- 单日分 = `clamp(round(60 + 正向 − 负向), 1, 99)`；7 日滚动均值 = **后天精进值**

**加权综合**：`综合 = clamp(round(先天均分 × 0.55 + 后天精进值 × 0.45), 1, 99)`，体现「先天为基，后天为用」。

**命理画像具象化 `buildPersonaAvatar(persona)`**：按 `day_wuxing` 映射 `PERSONA_AVATAR`（木🌳绿 / 火🔥红 / 土⛰️黄 / 金⚔️灰 / 水🌊蓝），返回 `{ element, emoji, color, celeb_tag, archetype, main_shishen, name }`；`celeb_tag` 给出古今名人风格标签（如金 →「如·辛弃疾之风（刚健雄烈）」）。在 `POST /api/persona/generate` 响应中注入 `persona.avatar`。

**服务分层与四层阶梯常量**：

```
FREE_MODULES = ['kline', 'divination', 'number']   // 免费白名单
LADDER_4 = [
  { id:'life',      title:'生命赋能',        modules:['kline'] },
  { id:'cognition', title:'生活认知',        modules:['divination','number','dream'] },
  { id:'highdim',   title:'生命力高维解析',  modules:['ziwei','persona','compat'] },
  { id:'cause',     title:'推演因果平行人生', modules:['sandbox','council','qintian'] },
]
```

**实现位置**：全部置于 `server_unified.js`（v6.2 新增块，位于 `// Start` 之前）；数据持久化依赖 `cultivation_daily` 表（§3.6）。

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
| `cultivation_daily` | id, user_id, entry_date, reading_min, sleep_hours, exercise_min, charity_min, anger, lack_sleep, drinking, sugar, coffee, smoking, score, UNIQUE(user_id,entry_date) | 后天精进每日打卡 (v6.2) |

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

### 4.4 支付相关（Stripe + PayPal v4.5）
```
POST /api/payment/create-checkout   # 创建支付会话 (Stripe)
POST /api/payment/verify            # 验证支付状态 (Stripe)
POST /api/paypal/create-order      # 创建 PayPal 订单 (v2 REST API)
POST /api/paypal/capture-order      # 确认捕获 PayPal 支付
POST /api/paypal/subscription/*    # 月度/年度订阅 + Webhook 通知
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

### 4.6 紫微斗数 (v3.2) + 钦天四化 (v5.1)
```
POST /api/ziwei
Body: { year, month, day, hour?, minute?, gender? }
Response: {
  success,
  data: {
    命宫, 身宫, 十二宫, 主星, 辅星, 四化,
    qinTian: {
      laiYin:        { name, zhi, zhiIdx, gan },                 // 来因宫（宫干==年干）
      shengNian:     [ { hua, code, star, palaceName, zhi, zhiIdx, meaning } x4 ],  // 生年四化落宫
      flyingStars:   [ { fromGong, fromZhi, fromGan, hua, code, star, isSelf, toGong, toZhi, toZhiIdx } x48 ],
      flyingByPalace:[ { gong, zhi, gan, flies:[...] } x12 ],     // 按来源宫分组的飞星轨迹
      ziHua:         [ { gong, zhi, gan, hua, code, star } ],     // 离心自化
      xinHua:        [ { gong, zhi, gan, hua, code, star, fromGong } ], // 向心自化
      meaning:       { 化禄/化权/化科/化忌: { code, title, desc, color } }
    }
  }
}
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

### 4.12 会员订阅系统 (v5.0)
```
GET  /api/membership/status        # 查询当前会员等级/过期时间
POST /api/membership/subscribe     # 发起订阅（Stripe / PayPal）
POST /api/membership/cancel        # 取消订阅
```
- 数据模型：`auth_users`(`membership_tier`, `expires`, `started`) + `subscriptions` 表
- `checkMembership(uid)` 过期检查；付费接口以会员等级做权限校验
- 所有 SQL 查询参数化（修复早期字符串拼接的 SQL 注入风险）

### 4.13 Admin 配置 (v4.6)
```
GET  /api/admin/config             # 读取运行时配置（PayPal/Stripe/DeepSeek）
POST /api/admin/config             # 热更新配置（无需重启服务）
```
- 配置存储于服务端内存或 `admin_config` 表，避免明文落 `.env`

---

### 4.14 灵境数测 (v6.0)

```
POST /api/number-fortune
Body: { number: string, kind?: 'phone' | 'plate' | 'bike' }
Response (success):
{
  success: true,
  ok: true,
  digits: string,                 // 仅数字串
  pairs:  [ { pair, star, level } ],      // 相邻两位的八星映射
  starCounts: { [star]: count },          // 八星分布
  wuxing: { [wuxing]: count },            // 数字五行分布
  score: number,                 // 1–99
  grade: '大吉'|'小吉'|'平稳'|'小凶'|'大凶',
  gradeColor: '#ef4444'|...,     // 红涨绿跌
  interpretation: string,        // 含免责声明
  kindName: '手机号'|'车牌号'|'电动车牌号'|'号码',
  starDesc: { [star]: desc }     // 八星象义
}
Response (fail):
{ success: false, message: '号码至少需要 2 位数字' }
```

- 纯算法：不调用 LLM、不读写 DB、可不联网。
- `kind` 缺省按 `phone` 处理，仅影响 `kindName` 与解读文案。
- 前端对应模块：`switchModule('number')`，结果渲染分数环 + 八星分布 + 五行条 + 解读，红涨绿跌。

---

### 4.15 命理分值与后天精进 (v6.2)

```
POST /api/scores/innate
Body:      { year, month, day, hour?, minute?, gender? }
Response:  { success:true,  data:{ ok, life_endowment, dayun_value, year_vitality, overall,
                                    detail:{ day_wuxing, body_strength, wuxing_balance, benign_ratio, dayun_ganzhi, year_ganzhi } } }
           { success:false, message }
// 排盘失败返回 { success:false, message:'排盘失败' }

POST /api/scores/combined
Body:      { birth?:{year,month,day,...}, cultivation?:number }   // birth 缺省取顶层字段
Response:  { success:true, data:{ innate:{...}, cultivation, combined } }
// combined = clamp(round(innate.overall*0.55 + cultivation*0.45),1,99)；cultivation 缺省为 0 时 combined=overall

POST /api/cultivation/submit
Body:      { user_id?, entry_date?, reading_min?, sleep_hours?, exercise_min?, charity_min?,
             anger?, lack_sleep?, drinking?, sugar?, coffee?, smoking? }
Response:  { success:true, score, breakdown:{ reading, sleep, exercise, charity, penalty }, stored }
// stored=false 表示无 DB（Demo 模式）；ON CONFLICT(user_id,entry_date) DO UPDATE 幂等 upsert

GET /api/cultivation/score?user_id=guest&days=7
Response:  { success:true, cultivation:number(7日滚动均值), entries:[{ date, score }] }

GET /api/platform/config
Response:  { success:true, free_modules:['kline','divination','number'], ladder:[...4层...], avatar_tags:[木,火,土,金,水] }
```

- 上述接口均为纯算法 / 轻 DB，不调用 LLM（既有的 `/api/persona/generate` 仍走 LLM，但在 v6.2 额外注入 `persona.avatar` 字段，结构见 §3.9）。
- `/api/platform/config` 是前端 `FREE_MODULES` 与四层阶梯渲染的**唯一数据源**；非白名单模块前端带 🔒 角标，点击触发 `openMembershipModal()` 且不切换模块。
- 前端对应：首页分值面板（`section-scorepanel`）调用 `/api/scores/innate` 与 `/api/cultivation/score` 渲染三分数环 + 后天精进热力图；修习阶梯四列来自 `LADDER_4`；命理画像卡片渲染 `persona.avatar`。

---

## 5. 文件结构

```
nexus-ora-mvp/
├── frontend/
│   ├── index.html              # 单页应用 (SPA, 含 SEO 注入)
│   ├── share_cards.html        # 8 大模块分享主图 (v3.9)
│   ├── robots.txt              # SEO 爬虫规则 (v4.3)
│   ├── sitemap.xml             # SEO 站点地图（含多语 hreflang）(v4.3)
│   └── llms.txt                # LLM 友好索引 (v4.4)
├── backend/
│   ├── server_unified.js       # Express 服务器（API + 排盘 + DB + 会员 + 支付）
│   ├── paipan_engine.js        # JS 排盘引擎 (v3.0)
│   ├── paipan_engine.py        # Python 排盘引擎 (保留参考)
│   ├── ziwei_engine.js         # 紫微斗数引擎 (v3.2)
│   ├── paypal.js               # PayPal REST API 封装 (v4.5)
│   ├── paypal_routes.js        # PayPal 路由 (v4.5)
│   ├── admin_routes.js         # Admin 配置路由 (v4.6)
│   ├── membership.js            # 会员订阅逻辑 (v5.0)
│   ├── verify.js               # 全链路验证测试
│   ├── package.json            # Node.js 依赖
│   └── .env.example            # 环境变量模板（不得提交真实 .env）
├── miniapp/                    # 微信小程序 (v4.4)
│   ├── project.config.json     # 小程序项目配置
│   ├── app.js / app.json / app.wxss
│   ├── pages/
│   │   ├── index/              # 首页（8模块入口）
│   │   ├── fortune/            # 灵境预言（八字排盘）
│   │   ├── radar/              # 灵境图谱（六维分析）
│   │   ├── compatibility/      # 缘分配对
│   │   ├── ziwei/              # 紫微命盘
│   │   ├── dream/              # 梦境回廊
│   │   ├── persona/            # 灵境人格
│   │   ├── divination/         # 灵境占卜
│   │   ├── cultivation/        # 灵境修行
│   │   ├── market/             # 灵境市集
│   │   └── mine/              # 个人中心
│   └── utils/
│       └── api.js              # API 请求封装
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
| `SHARE_URL` | 否 | 空 | 分享卡扫码链接（留空则自动抓取当前域名） |
| `PAYPAL_CLIENT_ID` | 否 | 空 | PayPal 客户端 ID (v4.5) |
| `PAYPAL_CLIENT_SECRET` | 否 | 空 | PayPal 密钥 (v4.5) |
| `PAYPAL_MODE` | 否 | `sandbox` | `sandbox` / `live`（上线需切 live 并替换为 Live 凭证） |

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

> ⚠️ **安全**：`.env` 严禁提交进仓库（曾因推送脚本不读 `.gitignore` 导致密钥泄露，需密钥轮换 + git 历史清理）。生产凭证通过环境变量或 Admin 配置页注入，不在明文文件中留存。

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
- **决策**：9 大模块（v6.0 起含灵境数测）API 全部内联在 `server_unified.js` 中，不拆分为独立 router 文件
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

### ADR-013: 分享主图独立页面 (v3.9)
- **决策**：8 大模块分享主图放在独立 `share_cards.html`，不嵌入主 SPA
- **理由**：分享页是静态展示卡片（360×640 竖版），独立文件可单独截图/部署，不影响主 SPA 性能
- **影响**：用户通过导航栏"分享"入口跳转到独立页面；未来小程序端用 Canvas 绘制等效卡片

### ADR-014: 微信小程序技术选型 (v4.0)
- **决策**：采用**微信原生小程序**框架开发，不使用 Taro/uni-app 等跨端框架
- **理由**：
  - 目标用户 100% 在微信生态，无需跨端
  - 原生框架性能最优（尤其 ECharts 图表渲染）
  - 生态成熟：微信登录、支付、订阅消息、分享等 API 原生支持
  - 包体更小，审核更顺畅
- **影响**：无法复用 Web 端 HTML/CSS 代码，但后端 API 完全复用

### ADR-015: 小程序后端复用 (v4.0)
- **决策**：小程序前端直接调用现有 Express 后端 API，不新建服务
- **理由**：8 大模块 API 已完善且稳定（v3.1-v3.7 迭代验证），增加小程序端仅需：
  1. 后端增加微信登录接口 (`/api/auth/wx-login`)
  2. 后端增加微信支付回调接口
  3. 后端配置 `HOST=0.0.0.0` 对外服务 + HTTPS
- **影响**：小程序与 Web 端共享同一后端，数据互通

### ADR-016: 前端 JS 全局作用域管理 (v4.0.1)
- **决策**：所有 `onclick` 处理函数必须定义在全局作用域（不能在 `DOMContentLoaded` 回调内）
- **理由**：HTML 中的 `onclick="functionName()"` 只能在全局 `window` 对象上查找函数。若将函数定义在 `DOMContentLoaded` 回调内，函数变为局部变量，导致运行时 `functionName is not defined` 错误。
- **正确模式**：
  ```javascript
  // ✅ 正确：函数在全局作用域
  function openShareCard() { ... }
  
  // ✅ 正确：需要 DOM 元素的初始化代码用 IIFE + null 检查
  (function() {
    const el = document.getElementById('profile-modal');
    if (el) el.addEventListener('click', ...);
  })();
  
  // ❌ 错误：函数在 DOMContentLoaded 内，onclick 找不到
  document.addEventListener('DOMContentLoaded', () => {
    function openShareCard() { ... }  // 局部变量！
  });
  ```
- **影响**：未来新增功能时需注意函数作用域；建议使用 ESLint 规则检查 `onclick` 引用的函数是否在全局作用域

### ADR-017: 分享卡双模式生成 (v4.0.1)
- **决策**：分享卡支持两种生成方式：(1) `share_cards.html` 独立静态页面；(2) `index.html` 内嵌 `generateShareCardHTML()` 动态生成
- **理由**：独立页面适合静态展示和截图，内嵌生成适合用户交互（点击"生成分享图"按钮后弹出 Modal 展示）
- **实现**：`generateShareCardHTML()` 函数根据 `currentModule` 动态生成对应模块的 360×640 v2.0 分享卡 HTML 字符串，插入 `#share-card-canvas` 元素后由 `html2canvas` 截图或用户长按保存
- **v2.0 升级**：360×640 尺寸、情感洞察块、人生海拔 SVG 路径、四級 URL 降级

### ADR-018: PayPal 双通道收款 (v4.5)
- **决策**：新增 PayPal 收款通道，与 Stripe 并行
- **理由**：PayPal 覆盖全球用户（尤其海外版 v6.0 规划），Web 端订阅场景成熟
- **实现**：`paypal.js`（自封装 PayPal REST API v2 订单/捕获）+ `paypal_routes.js`（v2 路由：create-order / capture-order / subscription）
- **影响**：前端新增 PayPal 按钮（黄色 #FFC439），`handleUnlock('paypal')`；Demo 模式无 Key 时自动解锁

### ADR-019: 会员订阅系统 (v5.0)
- **决策**：引入四档会员（free / premium_monthly $9.99 / premium_annual $59.99 / report_only $9.99）
- **理由**：从"单次报告付费"升级为"订阅制 + 单次解锁"混合变现，提升 LTV
- **数据模型**：`auth_users` 新增 `membership_tier` / `expires` / `started`；新增 `subscriptions` 表
- **权限**：`checkMembership(uid)` 过期检查；付费接口以会员等级做权限校验
- **安全**：所有 SQL 查询参数化（修复早期字符串拼接的 SQL 注入风险）

### ADR-020: 全站 SEO 与多语言发现 (v4.3 / v4.4)
- **决策**：补充 title/描述/meta/OG/Twitter Card/JSON-LD（canonical + hreflang + FAQPage），新增 robots.txt / sitemap.xml（多语 hreflang）/ llms.txt
- **理由**：提升搜索引擎与 LLM 爬虫可发现性（AI 原生产品需被 llms.txt 索引）
- **实现**：Express 动态注入 `<script>window.__APP_URL</script>`；H1 唯一含核心关键词；页面底部语义化 SEO 内容区

### ADR-021: 全局命运档案 Profile (v4.2)
- **决策**：引入跨模块共享的"命运档案"（昵称/出生/性别/城市），localStorage 持久化
- **理由**：避免用户在每个模块重复输入出生信息；缘分配对 A 方自动预填档案
- **实现**：顶部 Nav 档案 chip；`readBirth()` 优先读档案再 fallback 表单；有档案时模块显示"已读取档案"横幅

### ADR-022: 密钥与配置安全 (v5.1 进行中)
- **决策**：`.env` 不得进入 git 仓库；Admin 配置支持运行时热更新，不再依赖 .env 明文
- **理由**：曾因推送脚本不读 `.gitignore` 导致 `backend/.env` 泄露至公开仓库（含 Stripe/PayPal/DeepSeek 密钥），需密钥轮换并清理 git 历史
- **影响**：部署改用环境变量或 Admin 配置页；CI 启用 GitHub secret scanning

---

### ADR-023: 灵境数测纯算法实现 (v6.0)
- **决策**：「灵境数测」模块（手机号/车牌号/电动车牌号）采用数字能量学八星**纯算法**，不调用 LLM、不读写数据库、可离线运行。
- **理由**：
  - 定位为低门槛拉新与社交裂变入口，需极快响应（<10ms）与零成本（不消耗 LLM 额度）；
  - 数字能量学本身是确定性规则，算法结果可复现、便于测试与传播一致性；
  - 与 ADR-009（算法回退一致性）一脉相承——核心功能不依赖外部服务。
- **实现**：`computeNumberEnergy(raw, kind)` 置于 `server_unified.js`；评分 `score = 50 + (∑星权重 / 相邻对数) × 2.6` 夹紧 1–99；`kind` 仅影响文案。
- **影响**：结果需明确标注「仅供娱乐与自我探索参考」；未来若需更个性化解读可叠加可选 LLM 润色（保持算法为默认）。

### ADR-024: v6.0 产品策略升级（定位与信息架构）
- **决策**：基于用户反馈做六项策略采纳——① 对外去「AI 算命」话术化，统一为「东方命理 · 算法可视化平台」；② 明确定位主轴为「可验证计算 + 垂直建议为核，娱乐/社区为翼」；③ 新增「修习阶梯」将九大模块按认知深度分 启蒙/进阶/宗师 三层（非并列）；④ 新增「灵境启蒙」新手村（八字/五行/十神/K线 科普 + AI 角色声明 + 免责）；⑤ 新增「灵境数测」纯算法传播模块；⑥ 市集新增「灵境·线下」O2O 闭环（活动报名留资 + 凭报告享专属解读）。
- **理由**：命理/玄学领域提 AI 是双刃剑，过度强调「AI 算命」既引发伦理顾虑，又诱导用户转向通用 ChatBot；分层递进的信息架构体现专业度与差异化高级感；新手铺垫与线上线下生态提升信任与粘性。
- **影响**：所有对外文案（tagline/hero/badge/声明）须遵循新口径；AI 角色被明确定义为「后台推演引擎」而非算命主体；详见 PRD §1.4 与 §2.16。

### ADR-025: v6.2 命理量化与产品分层（采纳专家 review）
- **决策**：采纳专家 Wilson 五项建议——① 命理分值面板（先天三分数 + 后天精进值 + 加权综合）② 后天精进体系（仿蚂蚁信用多维加权 + 7 日热力图）③ 服务分层（免费白名单：图谱/占卜/数测）④ 修行之路四层重分类（生命赋能/生活认知/生命力高维解析/推演因果平行人生）⑤ 命理画像具象化（五行原型 avatar + 名人标签）。
- **理由**：先天气运三分数将「命」量化为可比、可追踪的数字，配合后天精进（用户每日行为打分）形成「算命 → 行动 → 看到变化」的复用闭环，是该赛道的市场空白点；服务分层用三个轻量模块做免费钩子降低首访门槛、其余转化为付费点；四层阶梯替代原 启蒙/进阶/宗师 三层，更贴合「生命赋能 → 生活认知 → 高维解析 → 推演因果」的认知递进；命理画像具象化用五行 emoji + 名人标签快速建立辨识度与情感连接。
- **实现**：纯算法常量与函数置于 `server_unified.js`（零 LLM、可离线）；`cultivation_daily` 表持久化（§3.6）；5 个新 API（§4.15）；`FREE_MODULES` / `LADDER_4` 由 `/api/platform/config` 下发。
- **影响**：先天三分数采用简化可复现模型（大运忽略起运岁数、流年按年干支五行），仅供自我探索参考，UI 须标注免责；命理画像名人标签为风格类比、非真实命盘断言。

---

## 9. 小程序技术方案 (v4.4.5)

### 9.1 技术栈

| 层级 | 技术 | 选型理由 |
|------|------|----------|
| 框架 | 微信原生小程序 | 性能最优，生态完善 |
| 图表 | ec-canvas (ECharts 小程序版) | 与 Web 端图表一致 |
| 样式 | WXSS + rpx 响应式 | 原生支持，无额外构建 |
| 请求 | wx.request + Promise 封装 | 原生网络请求 |
| 登录 | wx.login + code2session | 微信一键授权 |
| 支付 | wx.requestPayment | 微信支付 |
| 分享 | onShareAppMessage + Canvas 海报 | 小程序卡片 + 图片分享 |

### 9.2 页面结构（11 页面，v4.4.5）

```
pages/
├── index/          # 首页 - 8 模块入口网格 + 命运档案 chip
├── fortune/        # 灵境预言 - 八字排盘 + K线
├── radar/          # 灵境图谱 - 六维分析
├── compatibility/  # 缘分配对 - 双人信息 + 雷达图
├── ziwei/          # 紫微命盘 - 十二宫展示
├── dream/          # 梦境回廊 - 录入 + 双维解析 + 趋势
├── persona/        # 灵境人格 - 画像 + AI 对话
├── divination/     # 灵境占卜 - 塔罗/杯筊/签
├── cultivation/    # 灵境修行 - 打卡/冥想/日记
├── market/         # 灵境市集 - 商品/心愿单
└── mine/           # 个人中心 - 档案/会员/设置
```
> 注：旧 `miniprogram/` 目录已删除，由 `miniapp/` 完全替代；生产域名统一 `https://life.p1web.site`；`app.js` 含 `DEBUG` 开关（本地指向 `http://127.0.0.1:3000`）。

### 9.3 后端新增接口

```
POST /api/auth/wx-login          # 微信登录
Body: { code: string }           # wx.login 获取的 code
Response: { token, openid, user }

POST /api/payment/wx-pay         # 微信支付下单
Body: { plan, report_id }
Response: { timeStamp, nonceStr, package, signType, paySign }

POST /api/payment/wx-notify      # 微信支付回调（微信服务器调用）
```

### 9.4 小程序与 Web 端差异

| 功能 | Web 端实现 | 小程序端实现 |
|------|-----------|-------------|
| 图表 | ECharts (CDN) | ec-canvas 组件 |
| 分享 | 截图/URL | 小程序卡片 + Canvas 海报 |
| 登录 | 无 | wx.login + code2session |
| 支付 | Stripe Checkout | wx.requestPayment |
| 推送 | 无 | 订阅消息 (wx.requestSubscribeMessage) |
| 样式 | Tailwind CSS | WXSS + rpx |
| 路由 | SPA hash 路由 | 小程序页面栈 |

---

## 8. 测试策略

| 测试类型 | 工具 | 覆盖范围 |
|----------|------|----------|
| 单元测试 | `verify.js` | 排盘引擎 34 项全链路验证 |
| API 测试 | curl / Postman | `/api/fortune` 主接口 |
| 手动测试 | 浏览器 | 前端 UI 交互验证 |

---

## 10. 开源依赖清单

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
| PayPal REST API | 自有协议 | 支付集成（paypal.js 自封装，v4.5） |
