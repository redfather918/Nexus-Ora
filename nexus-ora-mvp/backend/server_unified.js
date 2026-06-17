/**
 * Nexus Ora MVP - Unified Server v3
 * LLM-first: DeepSeek 预测100年运势曲线 + 六维度深度解读
 * 算法回退保证离线可用
 */

require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');
const initSqlJs = require('sql.js');
const { paipan, getShishen } = require('./paipan_engine.js');
const { ziwei } = require('./ziwei_engine.js');

const app  = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';   // 本地用 127.0.0.1 避免防火墙弹窗；部署时设 HOST=0.0.0.0

// ───────────────────────── Config ─────────────────────────

const CFG = {
    deepseek: {
        apiKey:   process.env.DEEPSEEK_API_KEY || '',
        url:      'https://api.deepseek.com/v1/chat/completions',
        model:    'deepseek-chat',
        timeout:  90_000
    },
    prices: { report: 999, monthly: 2999 },
    db:     path.join(__dirname, 'nexus_ora.db')
};

// ───────────────────────── Middleware ─────────────────────

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ───────────────────────── Database ───────────────────────

let db = null;

async function initDatabase() {
    const SQL = await initSqlJs();
    if (fs.existsSync(CFG.db)) {
        try {
            db = new SQL.Database(fs.readFileSync(CFG.db));
            console.log('[DB] loaded');
        } catch { db = new SQL.Database(); }
    } else {
        db = new SQL.Database();
    }

    // ── Schema migration: ensure columns exist on old DB files ──
    const migrations = [
        { table: 'fortune_reports', col: 'llm_enhanced', sql: 'ALTER TABLE fortune_reports ADD COLUMN llm_enhanced INTEGER DEFAULT 0' },
        { table: 'dreams',       col: 'llm_enhanced', sql: 'ALTER TABLE dreams ADD COLUMN llm_enhanced INTEGER DEFAULT 0' },
        { table: 'divination_log',col:'llm_enhanced', sql: 'ALTER TABLE divination_log ADD COLUMN llm_enhanced INTEGER DEFAULT 0' },
    ];
    for (const m of migrations) {
        try {
            const cols = db.exec(`PRAGMA table_info(${m.table})`);
            const hasCol = cols[0]?.values?.some(c => c[1] === m.col);
            if (!hasCol) { db.run(m.sql); console.log(`[DB] migration: added ${m.col} to ${m.table}`); }
        } catch(e) { /* table may not exist yet */ }
    }

    db.run(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, gender TEXT, birth_date TEXT,
        created_at TEXT DEFAULT (datetime('now')))`);
    db.run(`CREATE TABLE IF NOT EXISTS fortune_reports (
        id TEXT PRIMARY KEY, user_id TEXT, report_data TEXT,
        llm_enhanced INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')))`);
    db.run(`CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY, report_id TEXT, plan TEXT,
        amount INTEGER, status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT (datetime('now')))`);
    db.run(`CREATE TABLE IF NOT EXISTS dreams (
        id TEXT PRIMARY KEY,
        title TEXT,
        description TEXT,
        mood TEXT,
        dream_date TEXT,
        symbols TEXT,
        east_analysis TEXT,
        west_analysis TEXT,
        summary TEXT,
        luck_score INTEGER,
        llm_enhanced INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')))`);

    // v3.4 灵境人格
    db.run(`CREATE TABLE IF NOT EXISTS persona (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        name TEXT,
        archetype TEXT,
        traits TEXT,
        speaking_style TEXT,
        system_prompt TEXT,
        dayun TEXT,
        created_at TEXT DEFAULT (datetime('now')))`);
    db.run(`CREATE TABLE IF NOT EXISTS persona_chat (
        id TEXT PRIMARY KEY,
        persona_id TEXT,
        role TEXT,
        content TEXT,
        created_at TEXT DEFAULT (datetime('now')))`);

    // v3.5 灵境占卜
    db.run(`CREATE TABLE IF NOT EXISTS divination_log (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        type TEXT,
        question TEXT,
        payload TEXT,
        result TEXT,
        llm_enhanced INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')))`);

    // v3.6 灵境修行
    db.run(`CREATE TABLE IF NOT EXISTS checkins (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        task_id TEXT,
        task_type TEXT,
        checkin_date TEXT,
        created_at TEXT DEFAULT (datetime('now')))`);
    db.run(`CREATE TABLE IF NOT EXISTS diary (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        mood INTEGER,
        energy INTEGER,
        gratitudes TEXT,
        reflection TEXT,
        diary_date TEXT,
        created_at TEXT DEFAULT (datetime('now')))`);

    // v3.7 灵境市集
    db.run(`CREATE TABLE IF NOT EXISTS wishlist (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        item_id TEXT,
        item_type TEXT,
        created_at TEXT DEFAULT (datetime('now')))`);

    saveDB();
    console.log('[DB] initialized');
}

function saveDB() {
    if (db) fs.writeFileSync(CFG.db, Buffer.from(db.export()));
}

// ───────────────────────── LLM ────────────────────────────

const SYSTEM_PROMPT = `你是拥有30年经验的东方命理大师，精通四柱八字、五行生克、大运流年。

根据用户八字排盘结果完成两项任务，严格输出 JSON（无多余文字）：

【任务一】预测0-100岁运势曲线
- 每岁一条记录，共101条
- score: 整数1-100（五行平衡度+大运流年+十神组合综合评分）
- level: 大吉(≥75) | 小吉(60-74) | 平稳(45-59) | 小凶(30-44) | 大凶(<30)
- phase: 成长期(0-18) | 上升期(19-30) | 黄金期(31-45) | 稳固期(46-60) | 智慧期(61-75) | 颐养期(76-100)
- event: 该年重要节点（如无则空字符串）

【任务二】六维度深度解读（每维度100-150字，附score分）

输出格式：
{
  "fortune_curve": [
    {"age":0,"score":42,"level":"平稳","phase":"成长期","event":""},
    ...共101条...
  ],
  "dimensions": {
    "career":        {"score":72,"summary":"事业运势一句话","advice":"详细建议"},
    "wealth":        {"score":68,"summary":"财运一句话",    "advice":"详细建议"},
    "relationships": {"score":65,"summary":"感情一句话",    "advice":"详细建议"},
    "health":        {"score":70,"summary":"健康一句话",    "advice":"详细建议"},
    "mentors":       {"score":75,"summary":"贵人运一句话",  "advice":"详细建议"},
    "challenges":    {"score":55,"summary":"挑战一句话",    "advice":"应对策略"}
  },
  "overview": "整体命理画像一句话（50字内）",
  "best_years":    [35,36,37,38,42],
  "caution_years": [24,25,50,51]
}`;

async function callLLM(paipan) {
    if (!CFG.deepseek.apiKey || CFG.deepseek.apiKey === 'sk-placeholder') return null;

    const b = paipan.bazi || {};
    const pillars = (paipan.pillars || []).map(p =>
        `${p.name}:${p.ganzhi}(天干${p.gan}${p.gan_wuxing||''} 地支${p.zhi}${p.zhi_wuxing||''} 十神${p.shishen||''})`
    ).join('；');

    const wx = paipan.wuxing_balance || {};
    const wxStr = Object.entries(wx).map(([k,v])=>`${k}${v}个`).join(' ');

    const userPrompt = `八字四柱：${pillars}
五行分布：${wxStr}
日主：${b.day_gan||''}（${b.day_wuxing||''}）身${b.body_strength||'中和'}
出生：${paipan.info?.birth_date||''} 性别：${paipan.info?.gender||''}
生肖：${paipan.info?.animal||''} 星座：${paipan.info?.zodiac||''}

请按系统要求，输出完整 JSON（fortune_curve 必须有 101 条）。`;

    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), CFG.deepseek.timeout);

    try {
        const res = await fetch(CFG.deepseek.url, {
            method:  'POST',
            headers: { 'Authorization': `Bearer ${CFG.deepseek.apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model:           CFG.deepseek.model,
                messages:        [{ role:'system', content: SYSTEM_PROMPT }, { role:'user', content: userPrompt }],
                temperature:     0.6,
                max_tokens:      8192,
                response_format: { type: 'json_object' }
            }),
            signal: ctrl.signal
        });
        clearTimeout(tid);

        if (!res.ok) { console.error('[LLM] HTTP', res.status); return null; }

        const data = await res.json();
        const raw  = data.choices?.[0]?.message?.content;
        if (!raw) return null;

        let parsed;
        try { parsed = JSON.parse(raw); }
        catch { const m = raw.match(/\{[\s\S]*\}/); if (m) parsed = JSON.parse(m[0]); else return null; }

        // 验证关键字段
        if (!Array.isArray(parsed.fortune_curve) || parsed.fortune_curve.length < 100) {
            console.error('[LLM] invalid fortune_curve length:', parsed.fortune_curve?.length);
            return null;
        }
        return parsed;

    } catch (e) {
        clearTimeout(tid);
        console.error('[LLM] error:', e.message);
        return null;
    }
}

// ───────────────────────── Algorithm Fallback ─────────────

// 五行相生相克权重表
const WX_CYCLE = {
    '金': { generate: '水', overcome: '木', generated: '土', overcome_by: '火' },
    '水': { generate: '木', overcome: '火', generated: '金', overcome_by: '土' },
    '木': { generate: '火', overcome: '土', generated: '水', overcome_by: '金' },
    '火': { generate: '土', overcome: '金', generated: '木', overcome_by: '水' },
    '土': { generate: '金', overcome: '水', generated: '火', overcome_by: '木' }
};

function algorithmFortune(paipan) {
    const dayWx = paipan.bazi?.day_wuxing || '金';
    const dayGan = paipan.bazi?.day_gan || '甲';
    const strength = paipan.bazi?.strength_score || 50;
    const wx = paipan.wuxing_balance || {};

    const cycle = WX_CYCLE[dayWx] || WX_CYCLE['金'];

    // 各岁五行流年权重（十天干循环）
    const GAN_LIST = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
    const GAN_WX   = ['木','木','火','火','土','土','金','金','水','水'];

    const phases = [
        { start:0,  end:18,  name:'成长期', base:46 },
        { start:19, end:30,  name:'上升期', base:58 },
        { start:31, end:45,  name:'黄金期', base:65 },
        { start:46, end:60,  name:'稳固期', base:56 },
        { start:61, end:75,  name:'智慧期', base:60 },
        { start:76, end:100, name:'颐养期', base:48 }
    ];

    const KEY_EVENTS = {
        6:'小学入学', 12:'初中升学', 15:'高中', 18:'成年/高考',
        22:'大学毕业', 25:'职场初期', 30:'而立之年',
        35:'事业上升期', 40:'不惑之年', 50:'知天命',
        60:'退休节点', 70:'古稀之年', 80:'耄耋之年'
    };

    return Array.from({length:101}, (_,age) => {
        const phase = phases.find(p => age >= p.start && age <= p.end) || phases[0];
        const ganWx = GAN_WX[age % 10];

        let bonus = 0;
        if (ganWx === dayWx)          bonus += 10;   // 比肩/劫财
        if (ganWx === cycle.generate) bonus += 7;    // 印绶
        if (ganWx === cycle.generated) bonus += 5;   // 食伤
        if (ganWx === cycle.overcome)  bonus -= 4;   // 财星
        if (ganWx === cycle.overcome_by) bonus -= 10;// 七杀/正官（中和则可用）

        // 五行平衡度修正
        const wxBalance = Object.values(wx).reduce((a,b)=>a+b,0) / 5;
        const wxVar = Math.sqrt(Object.values(wx).reduce((s,v)=>s+(v-wxBalance)**2,0)/5);
        const balanceBonus = Math.round((5 - Math.min(5, wxVar)) * 1.5);

        // 生命曲线自然弧度
        const sinWave = Math.sin((age - 10) * 0.11) * 8 + Math.cos(age * 0.23) * 4;

        let score = phase.base + bonus + balanceBonus + sinWave + (strength - 50) * 0.12;
        score = Math.round(Math.max(15, Math.min(96, score)));

        const level = score>=75?'大吉': score>=60?'小吉': score>=45?'平稳': score>=30?'小凶':'大凶';

        return { age, score, level, phase: phase.name, event: KEY_EVENTS[age] || '' };
    });
}

function algorithmDimensions(paipan, fortune) {
    const avg  = Math.round(fortune.reduce((s,f)=>s+f.score,0)/fortune.length);
    const dayWx = paipan.bazi?.day_wuxing || '金';
    const body  = paipan.bazi?.body_strength || '中和';
    const animal = paipan.info?.animal || '';

    const DIM_TEXTS = {
        '金': {
            career: { score:75, summary:'逻辑严谨，适合金融、法律、工程类精密行业', advice:`日主辛金/庚金，天性具备精密思维与执行力。建议朝需要严谨分析的行业深耕：金融投资、法务、IT架构、工程设计。${body==='强'?'身强可从事管理或创业':'建议先在大平台积累经验，厚积薄发'}。行水运（流年天干壬癸）时事业最为顺遂。` },
            wealth: { score:70, summary:'理财能力强，中年后财运亨通', advice:`金生水，偏财格局较好。建议做长线价值投资，避免短线博弈。${body==='强'?'身强可适度冒险，但仍需均衡配置':'身弱宜稳健，优先选择固定收益类资产'}。45岁后进入财富积累高峰期，40-50岁是人生财富转折点。` },
            relationships: { score:65, summary:'感情细腻但不善表达', advice:`辛/庚金对待感情严肃认真，但偏内敛。建议主动表达情感，减少控制欲。正官坐命局者，伴侣往往能力突出、个性强势，需学会欣赏差异。25-30岁感情变化最多，30岁后稳定性显著提升。` },
            health: { score:70, summary:'注意呼吸系统与皮肤', advice:`金主肺，日主金需特别关注呼吸道、肺、皮肤健康。秋季（金旺）是最佳调养时节。建议每日有氧运动30分钟（游泳、慢跑），避免过度熬夜。火旺流年（丙丁年）需防止上火、心肺问题。` }
        },
        '木': {
            career: { score:72, summary:'创意旺盛，适合文创、教育、设计', advice:`日主木，思维灵活富有创意，人际关系处理能力强。建议朝文化创意、教育培训、互联网产品、设计类方向发展。行火运（流年丙丁）时创业能量最强，33-43岁是最佳窗口期。` },
            wealth: { score:65, summary:'财来财去，需稳健理财', advice:`木克土，偏财来去较快。建议设立专属储蓄账户，每月强制储蓄20%以上收入。避免在金旺年（庚辛年）进行大额投资，该年财运易受阻。35-45岁收入峰值期，把握机会建立被动收入。` },
            relationships: { score:72, summary:'感情丰富，桃花旺盛', advice:`木主仁，感情细腻温柔，异性缘极佳。但木过旺易犯桃花，需注意感情专一。建议28-32岁稳定感情，过早定型或过晚都不佳。食伤透出者表达力强，恋爱期容易吸引人，需把握真心缘分。` },
            health: { score:68, summary:'注意肝胆与眼睛', advice:`木主肝，日主木命应特别保护肝脏健康。建议戒酒或控制饮酒，保持情绪稳定（怒伤肝）。适合瑜伽、冥想等舒缓运动。春季（木旺）养肝最佳，每天保证7-8小时睡眠。` }
        },
        '水': {
            career: { score:70, summary:'智慧超群，适合研究、咨询、金融', advice:`日主水，智慧灵动，适应力强。最适合研究分析、咨询顾问、金融量化、互联网等脑力密集型行业。行木运（流年甲乙）事业发展最顺。注意水过旺时容易散漫，需培养专注力和执行力。` },
            wealth: { score:68, summary:'财运起伏，贵人带财', advice:`水主智，财运往往与贵人相关。建议广结善缘，通过人脉开拓财富渠道。土旺年（戊己年）注意防止财务损失。40岁后随阅历增加，判断力提升，理财能力显著增强。` },
            relationships: { score:70, summary:'感情多变，需要稳定力量', advice:`水命感情较为复杂，情感丰富但难以专一。建议选择五行属土（稳重型）的伴侣，两者互补。28-35岁感情最为活跃，35岁后逐步稳定。婚姻需要双方都做好成熟准备才稳固。` },
            health: { score:65, summary:'注意肾脏与循环系统', advice:`水主肾，需重视肾脏、膀胱、生殖系统的保养。冬季是最需要注意的季节。建议多食黑色食物（黑豆、黑芝麻），规律作息，避免过度消耗精力。土旺流年注意水湿失调。` }
        },
        '火': {
            career: { score:74, summary:'热情领袖气质，适合销售、管理、演艺', advice:`日主火，热情外向，领袖魅力十足。最适合销售、市场、管理、演艺、教育等需要与人互动的行业。行土运（流年戊己）时事业运最旺。注意火旺时容易冲动决策，需修炼冷静思考的能力。` },
            wealth: { score:72, summary:'偏财运好，敢于冒险', advice:`火命偏财意识强，敢于投资与冒险。擅长把握市场机遇，适合短中期投资。建议35-45岁进行主要财富积累，避免50岁后大幅冒险。水旺年（壬癸年）是财运最稳定的时期。` },
            relationships: { score:68, summary:'热烈奔放，需学会细水长流', advice:`火主礼，感情热烈真诚，但容易三分钟热度。建议培养长期陪伴的意愿，学会在日常生活中持续投入感情。最佳配偶五行属木（包容型）。30岁之后感情趋于成熟稳定。` },
            health: { score:65, summary:'注意心脑血管与血压', advice:`火主心，需重视心脑血管健康。建议保持低盐饮食，规律检测血压。避免过度焦虑和情绪激动。夏季（火旺）需格外注意防暑降温。适合游泳、太极等柔和运动。` }
        },
        '土': {
            career: { score:70, summary:'脚踏实地，适合地产、农业、管理', advice:`日主土，稳重可靠，执行力强。最适合房地产、建筑、政府机关、农业、物流等脚踏实地的行业。行金运（流年庚辛）事业最顺。土命人往往大器晚成，40岁后事业才真正开花结果。` },
            wealth: { score:72, summary:'稳健致富，善于积累', advice:`土主信，财运稳健，善于长期积累。最适合固定资产投资、稳健型基金。建议将收入的30%用于长期储蓄，随时间积累成可观财富。木旺年（甲乙年）需防止财运受冲击。` },
            relationships: { score:68, summary:'忠诚可靠，感情稳定', advice:`土命感情踏实专一，是良好的伴侣类型。但偏内敛，不善主动追求。建议27-32岁把握感情良机。最佳配偶五行属火（活泼型），两者互相激活。婚后家庭稳定，是顾家型伴侣。` },
            health: { score:72, summary:'注意消化系统与脾胃', advice:`土主脾，需特别保养消化系统、脾胃。建议规律饮食，忌暴饮暴食，减少生冷食物摄入。适当户外运动补充阳气。长夏（夏末秋初）是脾胃最需要调养的季节。` }
        }
    };

    const base = DIM_TEXTS[dayWx] || DIM_TEXTS['金'];

    return {
        career:        { ...base.career,        score: Math.min(95, base.career.score        + Math.round((avg-50)*0.3)) },
        wealth:        { ...base.wealth,        score: Math.min(95, base.wealth.score        + Math.round((avg-50)*0.2)) },
        relationships: { ...base.relationships, score: Math.min(95, base.relationships.score + Math.round((avg-50)*0.15)) },
        health:        { ...base.health,        score: Math.min(95, base.health.score        + Math.round((avg-50)*0.1)) },
        mentors:       { score: Math.min(92, 62 + Math.round((avg-50)*0.25)),
                         summary: `贵人缘${avg>60?'旺盛':'一般'}，${body==='强'?'贵人引路作用显著':'需主动创造贵人机缘'}`,
                         advice: `${animal}年/月遇贵人概率最高。建议多参与行业圈子活动，广结善缘。贵人往往出现在正式场合，维护好职场关系网络。${avg>65?'30-45岁贵人运最旺，把握关键引荐机会。':'需耐心等待时机，积累才华是吸引贵人的根本。'}` },
        challenges:    { score: Math.min(90, 58 + Math.round((avg-50)*0.2)),
                         summary: `人生挑战主要集中在${fortune.filter(f=>f.score<40).slice(0,2).map(f=>f.age+'岁').join('、')||'早年'}前后`,
                         advice: `人生低谷期是积累蜕变的最佳时机，切忌在低谷期做重大冒险决策。建议提前2-3年规划应对策略：储备资金（至少6个月生活费）、深化专业技能、保持人脉关系。${body==='弱'?'身弱命需特别注意低谷年份（运势分<40）的健康与财务状况。':'身强命具备较强抗压能力，挑战往往成为跳板。'}` }
    };
}

function buildSummary(fortune, paipan, dimensions) {
    const avg  = Math.round(fortune.reduce((s,f)=>s+f.score,0)/fortune.length);
    const peak = fortune.reduce((a,b)=>a.score>b.score?a:b);
    const valley = fortune.reduce((a,b)=>a.score<b.score?a:b);
    const bestYears = [...fortune].sort((a,b)=>b.score-a.score).slice(0,5).map(f=>f.age);
    const cautionYears = [...fortune].sort((a,b)=>a.score-b.score).slice(0,3).map(f=>f.age);

    const dayWx = paipan.bazi?.day_wuxing||'金';
    const body  = paipan.bazi?.body_strength||'中和';
    const OVERVIEW_MAP = {
        '金强': '金刚之命，意志坚定，中年后事业大成，贵在修炼刚中带柔。',
        '金弱': '金水相生之命，智慧超群，厚积薄发，35岁后大运来临。',
        '木强': '参天大木之命，创意旺盛，领袖潜质，需水滋养方能长久。',
        '木弱': '木逢春生之命，韧性十足，越挫越勇，贵人在35岁后出现。',
        '水强': '智慧流动之命，适应力极强，多才多艺，需土稳固方能聚财。',
        '水弱': '润物无声之命，低调而有内涵，40岁后才华大放，水到渠成。',
        '火强': '旭日东升之命，热情领袖，光芒四射，需水调和避免过极。',
        '火弱': '星火燎原之命，意志坚韧，越打越强，木运来时一飞冲天。',
        '土强': '厚德载物之命，信义为本，大器晚成，45岁后财富厚积薄发。',
        '土弱': '沃土养生之命，默默耕耘，40岁后收获丰厚，晚年安康。'
    };
    const strengthKey = body.includes('强')||body==='偏强'?'强':'弱';
    const overview = OVERVIEW_MAP[dayWx+strengthKey] || `日主${dayWx}身${body}之命，人生K线均分${avg}，峰值在${peak.age}岁，顺势而为则大吉。`;

    return { body_strength:body, day_master: paipan.bazi?.day_gan||'--', day_wuxing:dayWx,
             animal: paipan.info?.animal||'--', average_score:avg,
             peak_age:peak.age, peak_score:peak.score,
             valley_age:valley.age, valley_score:valley.score,
             best_ages: bestYears, caution_ages: cautionYears, overview };
}

// ───────────────────────── Routes ─────────────────────────

// ════════════════════════════════════════════════════════════
//  认证模块（v1.0 - 简化版，用随机 token + 内存 Map）
//  TODO: 后续可替换为 JWT
// ════════════════════════════════════════════════════════════
const tokenStore = new Map();   // token -> { userId, phone, createdAt }
const smsStore   = new Map();   // phone -> { code, expiresAt, sendCount, lastSendAt }

function genToken() {
    return 'tk_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function getSession(req) {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    return token ? tokenStore.get(token) : null;
}

// 初始化 auth_users 表（必须在 db 初始化之后执行）
async function initAuthTable() {
    if (!db) await initDatabase();
    db.run(`CREATE TABLE IF NOT EXISTS auth_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT UNIQUE,
        openid TEXT UNIQUE,
        nickname TEXT,
        avatar TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    )`);
    console.log('[AUTH] auth_users table ready');
}

// 1) 发送验证码（开发模式：直接返回 code）
app.post('/api/auth/send-sms', (req, res) => {
    const { phone } = req.body || {};
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
        return res.status(400).json({ code: 1, msg: '手机号格式错误' });
    }
    // 防刷：60s 内同号只能发一次
    const now = Date.now();
    const prev = smsStore.get(phone);
    if (prev && now - prev.lastSendAt < 60_000) {
        return res.status(429).json({ code: 1, msg: '请稍后再试' });
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    smsStore.set(phone, { code, expiresAt: now + 5 * 60_000, lastSendAt: now });
    console.log(`[SMS] → ${phone} : ${code}`);
    res.json({ code: 0, msg: '发送成功', debugCode: code });   // 开发模式返回
});

// 2) 手机号 + 验证码登录
app.post('/api/auth/phone-login', (req, res) => {
    const { phone, code } = req.body || {};
    if (!phone || !code) return res.status(400).json({ code: 1, msg: '参数缺失' });
    const rec = smsStore.get(phone);
    if (!rec || rec.expiresAt < Date.now()) {
        return res.status(400).json({ code: 1, msg: '验证码已过期，请重新获取' });
    }
    if (rec.code !== code) return res.status(400).json({ code: 1, msg: '验证码错误' });
    smsStore.delete(phone);  // 一次性使用

    // 查/建用户
    let rows = db.exec(`SELECT id, phone, nickname, avatar FROM auth_users WHERE phone='${phone}'`);
    let user;
    if (rows[0]) {
        user = { id: rows[0].values[0][0], phone: rows[0].values[0][1], nickname: rows[0].values[0][2], avatar: rows[0].values[0][3] };
    } else {
        db.run(`INSERT INTO auth_users (phone, nickname) VALUES ('${phone}', '用户${phone.slice(-4)}')`);
        const lastId = db.exec(`SELECT last_insert_rowid()`)[0].values[0][0];
        user = { id: lastId, phone, nickname: `用户${phone.slice(-4)}`, avatar: '' };
    }
    const token = genToken();
    tokenStore.set(token, { userId: user.id, phone: user.phone, createdAt: Date.now() });
    res.json({ code: 0, token, user });
});

// 3) 获取当前用户信息
app.get('/api/auth/me', (req, res) => {
    const s = getSession(req);
    if (!s) return res.status(401).json({ code: 1, msg: '未登录' });
    const rows = db.exec(`SELECT id, phone, nickname, avatar FROM auth_users WHERE id=${s.userId}`);
    if (!rows[0]) return res.status(404).json({ code: 1, msg: '用户不存在' });
    const [id, phone, nickname, avatar] = rows[0].values[0];
    res.json({ code: 0, user: { id, phone, nickname, avatar } });
});

// 4) 退出登录
app.post('/api/auth/logout', (req, res) => {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (token) tokenStore.delete(token);
    res.json({ code: 0, msg: '已退出' });
});

// 健康检查
app.get('/api/health', (_req, res) => {
    res.json({ status:'ok', version:'3.7.0', llm: !!CFG.deepseek.apiKey, db: !!db });
});

// 主接口：排盘 → LLM → 报告
app.post('/api/fortune', async (req, res) => {
    console.log('[API] /api/fortune body:', JSON.stringify(req.body));
    const { year, month, day, hour=12, minute=0, gender='男' } = req.body;
    console.log('[API] parsed:', {year:+year,month:+month,day:+day,hour:+hour,minute:+minute,gender});
    if (!year||!month||!day) return res.status(400).json({success:false,error:'Missing year/month/day'});

    // 1. JS 纯引擎排盘（不再依赖 Python child_process）
    let paipanResult;
    try { paipanResult = paipan({year:+year,month:+month,day:+day,hour:+hour,minute:+minute,gender}); }
    catch(e) { return res.status(500).json({success:false,error:'Paipan: '+e.message}); }
    if (!paipanResult.success) return res.status(500).json(paipanResult);

    // 2. LLM 运势曲线
    let fortune, dimensions, overview = '', bestYears = [], cautionYears = [], llmOk = false;

    const llmResult = await callLLM(paipanResult);
    if (llmResult?.fortune_curve?.length >= 100) {
        fortune      = llmResult.fortune_curve.slice(0,101);
        dimensions   = llmResult.dimensions;
        overview     = llmResult.overview || '';
        bestYears    = llmResult.best_years || [];
        cautionYears = llmResult.caution_years || [];
        llmOk = true;
        console.log('[LLM] fortune curve generated ✓');
    } else {
        fortune    = algorithmFortune(paipanResult);
        dimensions = algorithmDimensions(paipanResult, fortune);
        console.log('[ALG] fallback algorithm used');
    }

    const summary = buildSummary(fortune, paipanResult, dimensions);
    if (overview) summary.overview = overview;
    if (bestYears.length)    summary.best_ages    = bestYears;
    if (cautionYears.length) summary.caution_ages = cautionYears;

    const report = { bazi: paipanResult, fortune, dimensions, summary, ai_enhanced: llmOk };

    // 3. 存库
    const rid = 'R'+ Date.now().toString(36).toUpperCase();
    const uid = 'U'+ Date.now().toString(36).toUpperCase();
    if (db) {
        try {
            db.run('INSERT OR REPLACE INTO users(id,gender,birth_date) VALUES(?,?,?)',
                   [uid, gender, `${year}-${month}-${day}`]);
            db.run('INSERT INTO fortune_reports(id,user_id,report_data,llm_enhanced) VALUES(?,?,?,?)',
                   [rid, uid, JSON.stringify(report), llmOk?1:0]);
            saveDB();
        } catch(e) { console.error('[DB] save error:', e.message); }
    }

    res.json({ success:true, report_id:rid, data:report });
});

// 读取报告
app.get('/api/report/:id', (req, res) => {
    if (!db) return res.status(500).json({success:false,error:'db not ready'});
    const r = db.exec('SELECT report_data FROM fortune_reports WHERE id=?', [req.params.id]);
    if (!r.length||!r[0].values.length) return res.status(404).json({success:false,error:'not found'});
    res.json({ success:true, data: JSON.parse(r[0].values[0][0]) });
});

// 支付
app.post('/api/payment/create-checkout', async (req, res) => {
    const { reportId, plan } = req.body;
    const demoMode = !process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_placeholder';

    if (demoMode) {
        if (db) {
            try {
                db.run('INSERT INTO orders(id,report_id,plan,amount,status) VALUES(?,?,?,?,?)',
                       ['O'+Date.now().toString(36).toUpperCase(), reportId||'demo', plan||'report', 0, 'demo_completed']);
                saveDB();
            } catch {}
        }
        return res.json({ success:true, demo:true, report_id: reportId });
    }

    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const priceMap = { monthly: { amt:CFG.prices.monthly, name:'Nexus Ora Premium Monthly' },
                       report:  { amt:CFG.prices.report,  name:'Nexus Ora Full Report' } };
    const pc = priceMap[plan] || priceMap.report;

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{ price_data: { currency:'cny', product_data:{name:pc.name},
                unit_amount: pc.amt }, quantity:1 }],
            mode: plan==='monthly'?'subscription':'payment',
            success_url: `${process.env.APP_URL || `http://${HOST}:${PORT}`}/?paid=true&report=${reportId||''}`,
            cancel_url:  `${process.env.APP_URL || `http://${HOST}:${PORT}`}/`
        });
        if (db) {
            db.run('INSERT INTO orders(id,report_id,plan,amount,status) VALUES(?,?,?,?,?)',
                   ['O'+Date.now().toString(36).toUpperCase(), reportId, plan, pc.amt, 'pending']);
            saveDB();
        }
        res.json({ success:true, session_url: session.url });
    } catch(e) {
        res.status(500).json({ success:false, error:e.message });
    }
});

app.post('/api/payment/verify', (_req, res) => res.json({ success:true, unlocked:true }));

// ══════════════════ 缘分配对 API ══════════════════

// 五行相生相克映射
const WX_RELATION = {
    '木': { sheng:'火', ke:'土', beiSheng:'水', beiKe:'金' },
    '火': { sheng:'土', ke:'金', beiSheng:'木', beiKe:'水' },
    '土': { sheng:'金', ke:'水', beiSheng:'火', beiKe:'木' },
    '金': { sheng:'水', ke:'木', beiSheng:'土', beiKe:'火' },
    '水': { sheng:'木', ke:'火', beiSheng:'金', beiKe:'土' }
};

function calcCompatibility(a, b) {
    const aWx = a.bazi.day_wuxing;
    const bWx = b.bazi.day_wuxing;
    const aGan = a.bazi.day_gan;
    const bGan = b.bazi.day_gan;

    // 五行匹配度
    let wxScore = 0;
    const rel = WX_RELATION[aWx];
    if (!rel) { wxScore = 50; }
    else if (aWx === bWx) { wxScore = 75; }           // 同五行：志趣相投
    else if (rel.sheng === bWx) { wxScore = 85; }       // A生B：A滋养B
    else if (rel.beiSheng === bWx) { wxScore = 90; }    // A被B生：A受益
    else if (rel.ke === bWx) { wxScore = 45; }           // A克B：轻微冲突
    else if (rel.beiKe === bWx) { wxScore = 40; }        // A被B克：受压
    else { wxScore = 50; }

    const wxLabel = aWx === bWx ? `${aWx}${bWx}同气` :
        rel?.sheng === bWx ? `${aWx}生${bWx}` :
        rel?.beiSheng === bWx ? `${bWx}生${aWx}` :
        rel?.ke === bWx ? `${aWx}克${bWx}` :
        rel?.beiKe === bWx ? `${bWx}克${aWx}` : '--';

    // 十神关系
    const ssAtoB = getShishen(aGan, bGan);
    const ssBtoA = getShishen(bGan, aGan);

    // 十神相合理想配对
    const GOOD_SS_PAIRS = [
        ['正官','正印'],['正官','正财'],['七杀','正印'],['食神','正财'],
        ['比肩','劫财'],['正印','偏印'],['食神','伤官']
    ];
    let ssBonus = 0;
    const sorted = [ssAtoB, ssBtoA].sort().join(',');
    for (const [x,y] of GOOD_SS_PAIRS) {
        if (sorted.includes(x) && sorted.includes(y)) { ssBonus = 15; break; }
    }

    // 日柱地支关系（夫妻宫）
    const aDayZhi = a.pillars[2]?.zhi || '';
    const bDayZhi = b.pillars[2]?.zhi || '';
    const ZHI_HE = { '子丑':'合','寅亥':'合','卯戌':'合','辰酉':'合','巳申':'合','午未':'合' };
    const ZHI_CHONG = { '子午':'冲','丑未':'冲','寅申':'冲','卯酉':'冲','辰戌':'冲','巳亥':'冲' };
    const pair = [aDayZhi,bDayZhi].sort().join('');
    let zhiScore = 50;
    let zhiLabel = '普通';
    if (ZHI_HE[pair]) { zhiScore = 90; zhiLabel = '六合（绝配）'; }
    else if (ZHI_CHONG[pair]) { zhiScore = 30; zhiLabel = '六冲（需磨合）'; }

    // 多维度计算
    // 性格互补：五行相生 + 十神加分
    const personality = Math.round(Math.min(95, wxScore * 0.6 + ssBonus * 1.2 + 20));
    // 事业合作：十神关系为主
    const career     = Math.round(Math.min(95, (ssBonus > 0 ? 60 + ssBonus * 1.5 : 40 + Math.random() * 20)));
    // 感情契合：日柱地支 + 五行
    const romance    = Math.round(Math.min(95, zhiScore * 0.55 + wxScore * 0.3 + 10));
    // 沟通默契：五行相生
    const commun     = Math.round(Math.min(95, wxScore * 0.7 + (aDayZhi && bDayZhi ? 15 : 0)));
    // 长期发展：综合评分
    const longTerm   = Math.round((personality + career + romance + commun) / 4);

    // 五行对比雷达
    const aBalance = a.wuxing_balance || {};
    const bBalance = b.wuxing_balance || {};
    const elements = ['金','木','水','火','土'];
    const radarData = elements.map(e => ({
        element: e,
        personA: aBalance[e] || 0,
        personB: bBalance[e] || 0
    }));

    // 关系解读
    let relationType, relationIcon, relationDesc;
    if (zhiScore >= 80) { relationType = '天作之合'; relationIcon = '✨'; relationDesc = '日柱六合，前世渊源深厚。两人相遇即感亲切，很可能是命中注定的伴侣或最佳拍档。'; }
    else if (wxScore >= 80) { relationType = '五行相生'; relationIcon = '💫'; relationDesc = `五行${wxLabel}，能量流通顺畅。${aWx}命与${bWx}命天然互补，一方滋养另一方成长。`; }
    else if (ssBonus >= 10) { relationType = '十神相合'; relationIcon = '🤝'; relationDesc = `十神搭配理想，${ssAtoB}与${ssBtoA}互为良配。在事业上可以形成互补，沟通效率高于常人。`; }
    else if (zhiScore <= 35) { relationType = '欢喜冤家'; relationIcon = '⚡'; relationDesc = '日柱六冲，初见或有不和，但冲并非不好——冲则动，适当距离反而产生吸引力，需要更多耐心磨合。'; }
    else if (wxScore <= 45) { relationType = '五行相克'; relationIcon = '🔥'; relationDesc = `五行${wxLabel}，一方克制另一方。初期可能感到压迫，但若能化克为用（如借助第三方元素调和），反能激发彼此成长。`; }
    else { relationType = '平常之缘'; relationIcon = '🌸'; relationDesc = '不在最合的配置也不在最冲，中正平和。这类关系最考验双方真实付出，平淡中见真情。'; }

    return {
        success: true,
        personA: { bazi: a.bazi, info: a.info, pillars: a.pillars, wuxing_balance: a.wuxing_balance },
        personB: { bazi: b.bazi, info: b.info, pillars: b.pillars, wuxing_balance: b.wuxing_balance },
        compatibility: {
            relation_type:   relationType,
            relation_icon:   relationIcon,
            relation_desc:   relationDesc,
            wx_relation:     wxLabel,
            wx_score:        wxScore,
            ss_a_to_b:       ssAtoB,
            ss_b_to_a:       ssBtoA,
            zhi_relation:    zhiLabel,
            zhi_score:       zhiScore,
            dimensions: {
                personality:  { score: personality,  label: '性格互补' },
                career:       { score: career,       label: '事业合作' },
                romance:      { score: romance,      label: '感情契合' },
                communicaton: { score: commun,       label: '沟通默契' },
                long_term:    { score: longTerm,     label: '长期发展' }
            },
            overall_score:   longTerm,
            radar_data:      radarData,
            advice:          generateAdvice(wxScore, zhiScore, ssBonus, aWx, bWx, aGan, bGan)
        }
    };
}

function generateAdvice(wxScore, zhiScore, ssBonus, aWx, bWx, aGan, bGan) {
    const tips = [];
    if (wxScore >= 80) tips.push(`五行相生（${aWx}→${bWx}），多一起做创造性的事，能量会自然流动。`);
    if (wxScore <= 45) tips.push(`五行相克（${aWx}↘${bWx}），建议在关系中引入第三方元素（如共同朋友/兴趣爱好）来调和。`);
    if (zhiScore >= 80) tips.push('日柱六合是天赐良缘，前世今生的缘分，珍惜彼此。');
    if (zhiScore <= 35) tips.push('日柱六冲需要各自保留独立空间，适当的距离让关系更持久。');
    if (ssBonus >= 10) tips.push('十神搭配理想，在事业上可以成为最强拍档，沟通效率高。');
    tips.push(`关键提醒：${aWx}命与${bWx}命的组合，${aWx === bWx ? '同类相求，理解彼此最深，但也容易因太像而产生摩擦。' : '互补性强，你的短板恰好是对方的优势，这是天然的搭档关系。'}`);
    return tips;
}

app.post('/api/compatibility', (req, res) => {
    console.log('[API] /api/compatibility body:', JSON.stringify(req.body));
    const { personA, personB } = req.body;
    if (!personA || !personB) return res.status(400).json({ success: false, error: '需要双方出生信息' });
    if (!personA.year || !personA.month || !personA.day) return res.status(400).json({ success: false, error: '甲方缺少出生日期' });
    if (!personB.year || !personB.month || !personB.day) return res.status(400).json({ success: false, error: '乙方缺少出生日期' });

    try {
        const aResult = paipan({
            year: +personA.year, month: +personA.month, day: +personA.day,
            hour: personA.hour || 12, minute: personA.minute || 0, gender: personA.gender || '未知'
        });
        const bResult = paipan({
            year: +personB.year, month: +personB.month, day: +personB.day,
            hour: personB.hour || 12, minute: personB.minute || 0, gender: personB.gender || '未知'
        });
        if (!aResult.success || !bResult.success) {
            return res.status(500).json({ success: false, error: '排盘失败' });
        }
        const result = calcCompatibility(aResult, bResult);
        res.json(result);
    } catch (e) {
        console.error('[Compatibility] error:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// ───────────────────────── 紫微斗数 API ────────────────────

app.post('/api/ziwei', (req, res) => {
    console.log('[API] /api/ziwei body:', JSON.stringify(req.body));
    const b = req.body;
    if (!b.year || !b.month || !b.day) {
        return res.status(400).json({ success: false, error: '缺少出生日期' });
    }
    try {
        const result = ziwei({
            year:   +b.year,
            month:  +b.month,
            day:    +b.day,
            hour:   b.hour !== undefined ? +b.hour : 12,
            minute: b.minute !== undefined ? +b.minute : 0,
            gender: b.gender || '未知'
        });
        res.json({ success: true, data: result });
    } catch (e) {
        console.error('[Ziwei] error:', e.message, e.stack);
        res.status(500).json({ success: false, error: e.message });
    }
});

// ───────────────────────── 梦境回廊 API ────────────────────

const DREAM_SYSTEM_PROMPT = `你是一位融汇中西方梦境解析的大师，同时精通周公解梦传统和弗洛伊德/荣格心理学。

用户会描述一个梦境，请从两个视角完成解析，严格输出 JSON（无多余文字）：

【东方视角 — 周公解梦】
基于中国传统解梦文化，分析梦境吉凶、五行属性、对应现实预兆。
引用周公解梦中的经典对应关系。

【西方视角 — 心理学解析】
基于弗洛伊德（潜意识欲望）和荣格（原型意象）理论分析。
识别梦境中的心理投射和情绪映射。

输出格式：
{
  "mood": "情绪基调（焦虑/平静/恐惧/喜悦/困惑/悲伤）",
  "symbols": ["关键意象1", "关键意象2", "关键意象3", "关键意象4", "关键意象5"],
  "east_analysis": {
    "title": "周公解梦标题（8字内）",
    "interpretation": "东方解梦详细解读（150-200字）",
    "five_element": "关联五行（金/木/水/火/土）",
    "omen": "吉兆/凶兆/平兆",
    "classic_ref": "相关周公解梦经典条目"
  },
  "west_analysis": {
    "title": "心理学解析标题（8字内）",
    "freudian": "弗洛伊德视角解读（100-150字）",
    "jungian": "荣格原型视角解读（100-150字）",
    "archetype": "关联荣格原型（如英雄/智者/阴影/阿尼玛/阿尼姆斯等）"
  },
  "summary": "综合建议（80-120字，结合东西方给出行动指引）",
  "luck_score": 75
}

luck_score 说明：
- 90-100：大吉之梦，好运将至
- 70-89：小吉之梦，近期顺利
- 50-69：平梦，平稳无波
- 30-49：小凶，注意防范
- 0-29：大凶，谨慎行事`;

async function callDreamLLM(description, mood) {
    if (!CFG.deepseek.apiKey || CFG.deepseek.apiKey === 'sk-placeholder') return null;

    const userPrompt = `梦境描述：${description}
用户当前情绪感知：${mood || '未指定'}

请按系统要求，输出完整 JSON。`;

    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), 60000);

    try {
        const res = await fetch(CFG.deepseek.url, {
            method:  'POST',
            headers: { 'Authorization': `Bearer ${CFG.deepseek.apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model:           CFG.deepseek.model,
                messages:        [{ role:'system', content: DREAM_SYSTEM_PROMPT }, { role:'user', content: userPrompt }],
                temperature:     0.7,
                max_tokens:      4096,
                response_format: { type: 'json_object' }
            }),
            signal: ctrl.signal
        });
        clearTimeout(tid);

        if (!res.ok) { console.error('[Dream LLM] HTTP', res.status); return null; }

        const data = await res.json();
        const raw  = data.choices?.[0]?.message?.content;
        if (!raw) return null;

        let parsed;
        try { parsed = JSON.parse(raw); }
        catch { const m = raw.match(/\{[\s\S]*\}/); if (m) parsed = JSON.parse(m[0]); else return null; }

        if (!parsed.east_analysis || !parsed.west_analysis) return null;
        console.log('[Dream LLM] analysis generated ✓');
        return parsed;

    } catch (e) {
        clearTimeout(tid);
        console.error('[Dream LLM] error:', e.message);
        return null;
    }
}

// 算法回退：基于关键词的本地梦境解析
function algorithmDreamAnalysis(description, mood) {
    const desc = description.toLowerCase();

    // 关键意象关键词库
    const SYMBOL_KEYWORDS = {
        '水': ['水','河','海','湖','雨','游泳','溺水','洪','泉','瀑布','船'],
        '火': ['火','燃烧','太阳','光','热','火焰','烟','火山','灯','红'],
        '飞行': ['飞','翅膀','天空','云','鸟','漂浮','升空','降落'],
        '坠落': ['掉','坠落','摔','跌','深渊','悬崖','下坠','失控'],
        '追逐': ['追','跑','逃跑','追逐','追赶','被追','逃跑'],
        '考试': ['考试','考场','答题','试卷','迟到','忘带'],
        '牙齿': ['牙','牙齿','掉牙','拔牙','刷牙'],
        '蛇': ['蛇','蟒','龙'],
        '房屋': ['房子','家','门','房间','窗','楼','搬家'],
        '死亡': ['死','去世','葬礼','棺材','鬼','灵'],
        '恋爱': ['恋爱','情人','亲吻','拥抱','结婚','婚礼'],
        '动物': ['猫','狗','鱼','马','蝴蝶','兔子','鹿'],
        '自然': ['花','树','山','森林','草','田','花园'],
        '旅途': ['路','旅行','迷路','地图','车','火车'],
        '食物': ['吃','饭','食物','水果','甜','饥饿']
    };

    const detectedSymbols = [];
    for (const [symbol, keywords] of Object.entries(SYMBOL_KEYWORDS)) {
        if (keywords.some(kw => desc.includes(kw))) {
            detectedSymbols.push(symbol);
        }
    }

    // 周公解梦规则（简化版）
    const ZHOU_GONG = {
        '水':   { omen:'吉兆', wx:'水', title:'水润万物', classic_ref:'周公曰：梦见大水，主财帛丰足' },
        '火':   { omen:'吉兆', wx:'火', title:'火旺运通', classic_ref:'周公曰：梦见火焰，主事业兴旺' },
        '飞行': { omen:'大吉', wx:'风', title:'飞黄腾达', classic_ref:'周公曰：梦见飞翔，主志向得伸' },
        '坠落': { omen:'凶兆', wx:'土', title:'失足之忧', classic_ref:'周公曰：梦见坠落，主小心谨慎' },
        '追逐': { omen:'小凶', wx:'金', title:'压力之影', classic_ref:'周公曰：梦见被追，主小人当道' },
        '考试': { omen:'平兆', wx:'水', title:'验才之梦', classic_ref:'周公曰：梦见考试，主能力受验' },
        '牙齿': { omen:'小凶', wx:'金', title:'骨肉之忧', classic_ref:'周公曰：梦见掉牙，主亲人有恙' },
        '蛇':   { omen:'吉兆', wx:'火', title:'龙蛇呈祥', classic_ref:'周公曰：梦见蛇，主贵人将至' },
        '房屋': { omen:'平兆', wx:'土', title:'安身之所', classic_ref:'周公曰：梦见房子，主家宅平安' },
        '死亡': { omen:'凶兆', wx:'水', title:'终始之兆', classic_ref:'周公曰：梦见死亡，主旧事终结新生将至' },
        '恋爱': { omen:'大吉', wx:'火', title:'桃花入梦', classic_ref:'周公曰：梦见婚恋，主姻缘将至' },
        '动物': { omen:'吉兆', wx:'木', title:'灵兽伴行', classic_ref:'周公曰：梦见动物，主生机勃勃' },
        '自然': { omen:'平兆', wx:'木', title:'天人感应', classic_ref:'周公曰：梦见山水，主心境自然' },
        '旅途': { omen:'平兆', wx:'土', title:'行者无疆', classic_ref:'周公曰：梦见旅途，主前途未知' },
        '食物': { omen:'吉兆', wx:'土', title:'口福之兆', classic_ref:'周公曰：梦见食物，主生活富足' }
    };

    // 心理学解析规则（简化版）
    const JUNG_ARCHETYPES = {
        '水': '阿尼玛（内在女性面）', '火': '自性（Self）', '飞行': '英雄原型',
        '坠落': '阴影（Shadow）', '追逐': '阴影追逐', '考试': '智者与愚者',
        '牙齿': '变形与更新', '蛇': '转化与智慧', '房屋': '自我（Self）',
        '死亡': '重生原型', '恋爱': '阿尼玛/阿尼姆斯', '动物': '自然精灵',
        '自然': '大地母亲', '旅途': '探索者', '食物': '滋养原型'
    };

    const MOOD_SCORE_MAP = { '喜悦':80, '平静':65, '困惑':50, '焦虑':35, '悲伤':30, '恐惧':25 };
    const baseScore = MOOD_SCORE_MAP[mood] || 55;

    let luckScore = baseScore;
    let eastTitle = '寻常之梦';
    let eastOmen = '平兆';
    let eastWx = '木';
    let eastRef = '周公曰：寻常梦境，无特殊预兆。';
    let mainSymbol = detectedSymbols[0] || '自然';

    for (const sym of detectedSymbols) {
        const zg = ZHOU_GONG[sym];
        if (zg) {
            eastTitle = zg.title;
            eastOmen  = zg.omen;
            eastWx    = zg.wx;
            eastRef   = zg.classic_ref;
            if (zg.omen === '大吉') luckScore = Math.min(100, luckScore + 20);
            else if (zg.omen === '吉兆') luckScore = Math.min(100, luckScore + 12);
            else if (zg.omen === '小凶') luckScore = Math.max(0, luckScore - 10);
            else if (zg.omen === '凶兆') luckScore = Math.max(0, luckScore - 18);
        }
    }

    const archetype = JUNG_ARCHETYPES[mainSymbol] || '未定型';

    return {
        mood: mood || '困惑',
        symbols: detectedSymbols.length > 0 ? detectedSymbols : ['未识别'],
        east_analysis: {
            title: eastTitle,
            interpretation: `此梦涉及${detectedSymbols.join('、') || '寻常'}等意象。${eastRef}从五行角度看，此梦与${eastWx}行相关。建议关注${eastWx === '水' ? '财运和人际关系' : eastWx === '火' ? '事业和激情' : eastWx === '木' ? '成长和健康' : eastWx === '金' ? '竞争和决断' : '安稳和积累'}方面的变化。`,
            five_element: eastWx,
            omen: eastOmen,
            classic_ref: eastRef
        },
        west_analysis: {
            title: '潜意识映射',
            freudian: `梦境中的${mainSymbol || '意象'}反映了潜意识中的某种渴望或压抑。弗洛伊德认为梦境是"通往潜意识的皇家大道"，${mood === '恐惧' || mood === '焦虑' ? '当前的情绪可能来源于现实中的压力投射' : '此梦可能暗示内在需求的满足或补偿'}。`,
            jungian: `从荣格的视角看，${mainSymbol || '意象'}关联着"${archetype}"原型。这种原型在集体无意识中具有普遍意义，暗示你当前可能正经历一个与${mainSymbol === '坠落' ? '控制感和安全感' : mainSymbol === '追逐' ? '逃避和面对' : mainSymbol === '飞行' ? '自由和超越' : '内在成长'}相关的心理转化过程。`,
            archetype: archetype
        },
        summary: `此梦${eastOmen === '大吉' ? '为大吉之兆' : eastOmen === '凶兆' ? '需要留意' : '无特殊吉凶'}。东方解梦指向${eastWx}行能量的${eastOmen === '吉兆' || eastOmen === '大吉' ? '正向' : '需关注'}变化，西方心理学建议你${mood === '焦虑' || mood === '恐惧' ? '正视内心的不安，必要时寻求支持' : '保持当下的良好状态，注意情绪的周期性变化'}。`,
        luck_score: luckScore
    };
}

// 记录并分析梦境
app.post('/api/dream', async (req, res) => {
    console.log('[API] /api/dream body keys:', Object.keys(req.body));
    const { description, mood = '未指定', dream_date, title } = req.body;

    if (!description || description.trim().length < 5) {
        return res.status(400).json({ success: false, error: '梦境描述至少需要5个字' });
    }

    // LLM 解析
    let analysis = await callDreamLLM(description, mood);
    let llmOk = false;

    if (analysis) {
        llmOk = true;
    } else {
        analysis = algorithmDreamAnalysis(description, mood);
        console.log('[Dream] algorithm fallback used');
    }

    // 存库
    const did = 'D' + Date.now().toString(36).toUpperCase();
    if (db) {
        try {
            db.run(`INSERT INTO dreams(id,title,description,mood,dream_date,symbols,east_analysis,west_analysis,summary,luck_score,llm_enhanced)
                    VALUES(?,?,?,?,?,?,?,?,?,?,?)`, [
                did,
                title || description.slice(0, 20),
                description,
                mood,
                dream_date || new Date().toISOString().slice(0, 10),
                JSON.stringify(analysis.symbols || []),
                JSON.stringify(analysis.east_analysis),
                JSON.stringify(analysis.west_analysis),
                analysis.summary || '',
                analysis.luck_score || 50,
                llmOk ? 1 : 0
            ]);
            saveDB();
        } catch (e) { console.error('[Dream DB] save error:', e.message); }
    }

    res.json({ success: true, dream_id: did, ai_enhanced: llmOk, data: analysis });
});

// 获取梦境列表
app.get('/api/dreams', (_req, res) => {
    if (!db) return res.status(500).json({ success: false, error: 'db not ready' });
    try {
        const r = db.exec('SELECT id, title, mood, dream_date, symbols, luck_score, summary, created_at FROM dreams ORDER BY created_at DESC LIMIT 50');
        if (!r.length) return res.json({ success: true, dreams: [] });
        const dreams = r[0].values.map(row => ({
            id: row[0], title: row[1], mood: row[2], dream_date: row[3],
            symbols: JSON.parse(row[4] || '[]'), luck_score: row[5],
            summary: row[6], created_at: row[7]
        }));
        res.json({ success: true, dreams });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 获取梦境趋势数据
app.get('/api/dream/trend', (_req, res) => {
    if (!db) return res.status(500).json({ success: false, error: 'db not ready' });
    try {
        const r = db.exec(`SELECT dream_date, mood, luck_score, symbols FROM dreams ORDER BY dream_date ASC`);
        if (!r.length) return res.json({ success: true, trend: [], mood_stats: {} });

        const trend = r[0].values.map(row => ({
            date: row[0], mood: row[1], score: row[2], symbols: JSON.parse(row[3] || '[]')
        }));

        // 情绪统计
        const moodStats = {};
        const symbolStats = {};
        for (const t of trend) {
            moodStats[t.mood] = (moodStats[t.mood] || 0) + 1;
            for (const s of t.symbols) {
                symbolStats[s] = (symbolStats[s] || 0) + 1;
            }
        }

        res.json({ success: true, trend, mood_stats: moodStats, symbol_stats: symbolStats });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 删除梦境
app.delete('/api/dream/:id', (req, res) => {
    if (!db) return res.status(500).json({ success: false, error: 'db not ready' });
    try {
        db.run('DELETE FROM dreams WHERE id=?', [req.params.id]);
        saveDB();
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// ════════════════════════════════════════════════════════════
//  v3.4  灵境人格 (Persona)
// ════════════════════════════════════════════════════════════

const WUXING_DE = { '金':'义者','木':'仁者','水':'智者','火':'礼者','土':'信者' };
const SHISHEN_DESC = {
    '正官':{ tag:'责任', desc:'守规矩、重承诺、有担当' },
    '七杀':{ tag:'魄力', desc:'果敢刚毅、领导力强、不畏强权' },
    '正印':{ tag:'慈爱', desc:'仁慈宽厚、关怀他人、富有学识' },
    '偏印':{ tag:'神秘', desc:'直觉敏锐、思维独特、爱好玄学' },
    '比肩':{ tag:'独立', desc:'自尊自强、不喜依附、特立独行' },
    '劫财':{ tag:'豪爽', desc:'慷慨大方、人缘极佳、勇于冒险' },
    '食神':{ tag:'优雅', desc:'温文尔雅、品味独到、追求美感' },
    '伤官':{ tag:'才华', desc:'才华横溢、表现欲强、敢于突破' },
    '正财':{ tag:'务实', desc:'脚踏实地、勤俭持家、稳健理财' },
    '偏财':{ tag:'灵动', desc:'灵活机敏、善抓机遇、人脉广泛' }
};
const GENDERS_BY_USER = { '男':'女','女':'男','未知':'女' };

function buildPersona({ year, month, day, hour, gender }) {
    const p = paipan({ year:+year, month:+month, day:+day, hour:hour||12, minute:0, gender:gender||'未知' });
    if (!p.success) return null;
    const dayGan = p.bazi.day_gan;
    const dayWx  = p.bazi.day_wuxing;
    const arch   = WUXING_DE[dayWx] || '行者';
    // 取最显著十神
    const pillarSS = p.pillars.map(x=>x.shishen).filter(s=>s && s !== '日主');
    const ssCount = {};
    pillarSS.forEach(s => { ssCount[s] = (ssCount[s]||0)+1; });
    const sortedSS = Object.entries(ssCount).sort((a,b)=>b[1]-a[1]);
    const mainSS = sortedSS[0] ? sortedSS[0][0] : '比肩';
    const ssInfo = SHISHEN_DESC[mainSS] || { tag:arch, desc:'性格独特' };

    // 五行缺失 → 性格弱点
    const missing = Object.entries(p.bazi.wuxing_balance || {}).filter(([_,v])=>v===0).map(([k])=>k);
    const weakness = missing.length ? `容易在${missing.join('、')}相关情境中感到不安` : '五行俱全，心性圆融';

    const virtualGender = GENDERS_BY_USER[gender] || '女';
    const namePool = { '金':['金辉','素心'], '木':['青林','若兰'], '水':['沧澜','雪见'], '火':['炎君','朱颜'], '土':['厚朴','暖玉'] };
    const name = namePool[dayWx][virtualGender==='女'?1:0] + (virtualGender==='女'?'·灵':'·行');
    const traits = [ssInfo.tag, arch, ...(missing.length?missing.map(m=>`补${m}`):['中庸'])];

    const styleMap = {
        '正官':'温婉而坚定，称呼你"吾友"',
        '七杀':'直接利落，偶尔"切"字开句',
        '正印':'温和包容，惯用"孩子/亲爱的"',
        '偏印':'神秘莫测，惯用暗示和隐喻',
        '比肩':'平等对话，常说"我懂"',
        '劫财':'热情豪爽，活泼跳跃',
        '食神':'从容优雅，诗意表达',
        '伤官':'犀利灵动，偶有毒舌',
        '正财':'务实稳重，循循善诱',
        '偏财':'机敏幽默，金句频出'
    };
    const speakingStyle = styleMap[mainSS] || '平和亲切';

    const systemPrompt = `你是一位名为"${name}"的虚拟伴侣人格。\n` +
        `基础原型：${arch}（${dayGan}日主 / ${dayWx}行）\n` +
        `主要特质：${ssInfo.tag}（${ssInfo.desc}）\n` +
        `性格弱点：${weakness}\n` +
        `说话风格：${speakingStyle}\n` +
        `用户性别：${gender || '未指定'}，你应作为互补的伴侣角色与其对话。\n` +
        `请保持角色一致性，避免现代网络用语，多用古雅或诗意的表达。\n` +
        `回应应简短（80-150字），有温度，必要时引用八字/五行/玄学元素。`;

    return {
        persona_id: 'P' + Date.now().toString(36).toUpperCase(),
        name, virtual_gender: virtualGender, day_gan: dayGan, day_wuxing: dayWx,
        archetype: arch, main_shishen: mainSS, ss_info: ssInfo,
        missing_elements: missing, weakness,
        traits, speaking_style: speakingStyle,
        system_prompt: systemPrompt
    };
}

// 生成人格画像
app.post('/api/persona/generate', (req, res) => {
    const b = req.body || {};
    if (!b.year || !b.month || !b.day) return res.status(400).json({ success:false, error:'缺少出生日期' });
    try {
        const persona = buildPersona(b);
        if (!persona) return res.status(500).json({ success:false, error:'排盘失败' });
        if (db) {
            try {
                db.run(`INSERT INTO persona(id,user_id,name,archetype,traits,speaking_style,system_prompt) VALUES(?,?,?,?,?,?,?)`, [
                    persona.persona_id, 'guest', persona.name, persona.archetype,
                    JSON.stringify(persona.traits), persona.speaking_style, persona.system_prompt
                ]);
                saveDB();
            } catch(e) { console.error('[Persona DB]', e.message); }
        }
        res.json({ success: true, data: persona });
    } catch(e) {
        res.status(500).json({ success:false, error: e.message });
    }
});

// 对话
app.post('/api/persona/chat', async (req, res) => {
    const { persona_id, message } = req.body || {};
    if (!persona_id || !message) return res.status(400).json({ success:false, error:'缺少参数' });
    let persona = null;
    if (db) {
        try {
            const r = db.exec('SELECT name, archetype, traits, speaking_style, system_prompt FROM persona WHERE id=?', [persona_id]);
            if (r.length && r[0].values.length) {
                const v = r[0].values[0];
                persona = { name:v[0], archetype:v[1], traits:JSON.parse(v[2]||'[]'), speaking_style:v[3], system_prompt:v[4] };
            }
        } catch(e) { console.error('[Persona Chat DB]', e.message); }
    }
    // 算法回退
    const fallbackReplies = {
        '金':['金气肃杀，但也有清越之音。你今日心中可有金石之声？','义者不忧不惧。你若问前程，我以诚信相告。'],
        '木':['木曰曲直，能屈能伸。','春日之木，生机勃发。有什么心愿想要萌芽？'],
        '水':['水利万物而不争。你的心是否如止水？','智者乐水。你问的这个问题，我想静静听。'],
        '火':['火曰炎上，礼之光华。','热烈如火，亦需节制。你可愿与我共度此时？'],
        '土':['土爱稼穑，信者不疑。','厚德载物。你已经做得很好。']
    };
    const fallback = (persona && fallbackReplies[persona.archetype.replace('者','')] || ['我在听。'])[Math.floor(Math.random()*2)];

    let reply = fallback;
    let ai_enhanced = false;
    if (persona && CFG.deepseek.apiKey) {
        const messages = [{ role:'system', content: persona.system_prompt }];
        // 拉取最近 10 条历史
        if (db) {
            try {
                const r = db.exec('SELECT role, content FROM persona_chat WHERE persona_id=? ORDER BY created_at DESC LIMIT 10', [persona_id]);
                if (r.length) {
                    const hist = r[0].values.reverse();
                    for (const h of hist) messages.push({ role: h[0], content: h[1] });
                }
            } catch(e) {}
        }
        messages.push({ role:'user', content: message });
        const llm = await callLLMGeneric(messages, 600);
        if (llm) { reply = llm; ai_enhanced = true; }
    }

    // 存历史
    if (db) {
        try {
            db.run('INSERT INTO persona_chat(id,persona_id,role,content) VALUES(?,?,?,?)', ['C'+Date.now().toString(36), persona_id, 'user', message]);
            db.run('INSERT INTO persona_chat(id,persona_id,role,content) VALUES(?,?,?,?)', ['C'+(Date.now()+1).toString(36), persona_id, 'assistant', reply]);
            saveDB();
        } catch(e) { console.error('[Persona Chat Save]', e.message); }
    }
    res.json({ success: true, reply, ai_enhanced });
});

app.get('/api/persona/history', (req, res) => {
    if (!db) return res.status(500).json({ success:false });
    const persona_id = req.query.persona_id;
    if (!persona_id) return res.status(400).json({ success:false, error:'缺少 persona_id' });
    try {
        const r = db.exec('SELECT id, role, content, created_at FROM persona_chat WHERE persona_id=? ORDER BY created_at ASC', [persona_id]);
        if (!r.length) return res.json({ success:true, history:[] });
        const history = r[0].values.map(v => ({ id:v[0], role:v[1], content:v[2], created_at:v[3] }));
        res.json({ success:true, history });
    } catch(e) { res.status(500).json({ success:false, error:e.message }); }
});

app.post('/api/persona/reset', (req, res) => {
    if (!db) return res.status(500).json({ success:false });
    const persona_id = req.body && req.body.persona_id;
    if (!persona_id) return res.status(400).json({ success:false, error:'缺少 persona_id' });
    try {
        db.run('DELETE FROM persona_chat WHERE persona_id=?', [persona_id]);
        db.run('DELETE FROM persona WHERE id=?', [persona_id]);
        saveDB();
        res.json({ success:true });
    } catch(e) { res.status(500).json({ success:false, error:e.message }); }
});

// 通用 LLM（无强 prompt 约束）
async function callLLMGeneric(messages, maxTokens=600) {
    if (!CFG.deepseek.apiKey) return null;
    try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), CFG.deepseek.timeout);
        const r = await fetch(CFG.deepseek.url, {
            method:'POST',
            headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${CFG.deepseek.apiKey}` },
            body: JSON.stringify({ model: CFG.deepseek.model, messages, max_tokens: maxTokens, temperature: 0.8 }),
            signal: ctrl.signal
        });
        clearTimeout(t);
        if (!r.ok) return null;
        const j = await r.json();
        return j.choices?.[0]?.message?.content || null;
    } catch(e) { return null; }
}

// ════════════════════════════════════════════════════════════
//  v3.5  灵境占卜 (Divination)
// ════════════════════════════════════════════════════════════

// 78 张韦特塔罗（精简）
const TAROT_DECK = [
    // 大阿尔克那 0-21
    { name:'愚者', upright:'新的开始、纯真、自由', reversed:'鲁莽、犹豫不决、错失良机' },
    { name:'魔术师', upright:'创造力、行动力、专注', reversed:'欺骗、优柔寡断、才能浪费' },
    { name:'女祭司', upright:'直觉、潜意识、神秘', reversed:'秘密泄露、忽视直觉' },
    { name:'皇后', upright:'丰盛、母性、滋养', reversed:'过度保护、忽视、停滞' },
    { name:'皇帝', upright:'权威、稳定、父性', reversed:'专制、固执、失去控制' },
    { name:'教皇', upright:'传统、信仰、指引', reversed:'教条、叛逆、缺乏信仰' },
    { name:'恋人', upright:'爱情、和谐、选择', reversed:'失衡、错误选择、价值观冲突' },
    { name:'战车', upright:'胜利、意志、前进', reversed:'失去方向、强行推进' },
    { name:'力量', upright:'勇气、耐心、内在力量', reversed:'软弱、自我怀疑' },
    { name:'隐者', upright:'内省、孤独、智慧', reversed:'孤立、拒绝建议' },
    { name:'命运之轮', upright:'转变、循环、机遇', reversed:'厄运、抗拒改变' },
    { name:'正义', upright:'公正、真相、因果', reversed:'不公、逃避责任' },
    { name:'倒吊人', upright:'放下、新视角、牺牲', reversed:'抗拒、徒劳、停滞' },
    { name:'死神', upright:'结束、转变、蜕变', reversed:'抗拒改变、停滞不前' },
    { name:'节制', upright:'平衡、耐心、中庸', reversed:'失衡、过度、缺乏协调' },
    { name:'恶魔', upright:'束缚、欲望、执着', reversed:'解脱、打破枷锁' },
    { name:'塔', upright:'突变、崩溃、觉醒', reversed:'逃避灾难、抗拒改变' },
    { name:'星星', upright:'希望、灵感、宁静', reversed:'绝望、迷失、信心动摇' },
    { name:'月亮', upright:'幻象、潜意识、直觉', reversed:'释放恐惧、真相浮现' },
    { name:'太阳', upright:'成功、活力、喜悦', reversed:'短暂低潮、过度乐观' },
    { name:'审判', upright:'觉醒、重生、召唤', reversed:'自我怀疑、错失机会' },
    { name:'世界', upright:'圆满、完成、成就', reversed:'未完成、缺乏闭环' },
    // 小阿尔克那（权杖 1-Ace, 圣杯 1-Ace, 宝剑 1-Ace, 星币 1-Ace）
    { name:'权杖一', upright:'灵感、新行动、潜能', reversed:'延迟、缺乏方向' },
    { name:'权杖二', upright:'规划、决策、远见', reversed:'犹豫、害怕离开' },
    { name:'权杖三', upright:'拓展、远见、领导力', reversed:'延迟、缺乏远见' },
    { name:'权杖四', upright:'稳定、家庭、庆祝', reversed:'不稳定、过渡期' },
    { name:'权杖五', upright:'冲突、竞争、分歧', reversed:'冲突解决、内在冲突' },
    { name:'权杖六', upright:'胜利、认可、进步', reversed:'失败、延迟认可' },
    { name:'权杖七', upright:'坚持、防御、立场', reversed:'投降、压力过大' },
    { name:'权杖八', upright:'快速行动、消息、动力', reversed:'延迟、仓促决定' },
    { name:'权杖九', upright:'防御、坚韧、警惕', reversed:'偏执、耗竭' },
    { name:'权杖十', upright:'负担、责任、压力', reversed:'卸下重担、坚持不下去' },
    { name:'权杖侍者', upright:'热情、探索、消息', reversed:'鲁莽、延迟消息' },
    { name:'权杖骑士', upright:'行动、冒险、冲动', reversed:'鲁莽、傲慢、延迟' },
    { name:'权杖皇后', upright:'独立、自信、魅力', reversed:'占有欲、过度强势' },
    { name:'权杖国王', upright:'领导、远见、权威', reversed:'专制、暴躁、独断' },
    { name:'圣杯一', upright:'新感情、直觉、感情萌动', reversed:'情感封闭、拒绝爱' },
    { name:'圣杯二', upright:'伙伴、和谐、连接', reversed:'失衡、关系破裂' },
    { name:'圣杯三', upright:'友谊、庆祝、群体', reversed:'孤立、过度社交' },
    { name:'圣杯四', upright:'冷漠、沉思、错失', reversed:'接受、新机会' },
    { name:'圣杯五', upright:'失落、悲伤、遗憾', reversed:'恢复、释怀' },
    { name:'圣杯六', upright:'怀旧、童年、纯真', reversed:'被困过去、不愿成长' },
    { name:'圣杯七', upright:'幻想、选择、诱惑', reversed:'看清真相、聚焦' },
    { name:'圣杯八', upright:'离开、寻找、真理', reversed:'害怕离开、逃避' },
    { name:'圣杯九', upright:'满足、情感实现、愿望成真', reversed:'欲望未满、自欺' },
    { name:'圣杯十', upright:'幸福、家庭、情感圆满', reversed:'家庭矛盾、不和' },
    { name:'圣杯侍者', upright:'敏感、直觉、创意', reversed:'情绪化、不成熟' },
    { name:'圣杯骑士', upright:'浪漫、魅力、追求', reversed:'情绪化、不切实际' },
    { name:'圣杯皇后', upright:'慈悲、直觉、情感丰沛', reversed:'过度依赖、情绪化' },
    { name:'圣杯国王', upright:'情感成熟、包容、智慧', reversed:'情绪操控、情感压抑' },
    { name:'宝剑一', upright:'清晰、突破、新思路', reversed:'混乱、思维不清' },
    { name:'宝剑二', upright:'僵局、选择、平衡', reversed:'打破僵局、做决定' },
    { name:'宝剑三', upright:'心碎、伤痛、泪水', reversed:'释怀、疗愈' },
    { name:'宝剑四', upright:'休息、恢复、独处', reversed:'焦虑、失眠' },
    { name:'宝剑五', upright:'冲突、失败、争执', reversed:'和解、释怀' },
    { name:'宝剑六', upright:'过渡、疗愈、远行', reversed:'无法释怀、困在过去' },
    { name:'宝剑七', upright:'策略、偷窃、隐藏', reversed:'坦白、被揭穿' },
    { name:'宝剑八', upright:'束缚、限制、自我设限', reversed:'解脱、看清真相' },
    { name:'宝剑九', upright:'焦虑、恐惧、噩梦', reversed:'希望、走出阴影' },
    { name:'宝剑十', upright:'结束、低谷、崩溃', reversed:'恢复、慢慢爬升' },
    { name:'宝剑侍者', upright:'好奇、警觉、新想法', reversed:'八卦、鲁莽言行' },
    { name:'宝剑骑士', upright:'行动、雄心、勇往直前', reversed:'鲁莽、缺乏规划' },
    { name:'宝剑皇后', upright:'独立、清晰、理性', reversed:'冷漠、孤立' },
    { name:'宝剑国王', upright:'权威、真理、决断', reversed:'专制、滥用权力' },
    { name:'星币一', upright:'机会、繁荣、新财务', reversed:'错失、缺乏规划' },
    { name:'星币二', upright:'平衡、适应、灵活', reversed:'失衡、信息过载' },
    { name:'星币三', upright:'团队、合作、学习', reversed:'缺乏团队、不协调' },
    { name:'星币四', upright:'安全、保守、占有', reversed:'吝啬、过度保守' },
    { name:'星币五', upright:'困境、孤立、贫困', reversed:'恢复、走出困境' },
    { name:'星币六', upright:'慷慨、分享、公平', reversed:'自私、不公' },
    { name:'星币七', upright:'耐心、评估、长远眼光', reversed:'怀疑、缺乏耐心' },
    { name:'星币八', upright:'勤奋、专注、精进', reversed:'缺乏热情、机械' },
    { name:'星币九', upright:'富足、独立、成就', reversed:'过度依赖、外在认可' },
    { name:'星币十', upright:'财富、家族、长期保障', reversed:'家庭矛盾、不稳定' },
    { name:'星币侍者', upright:'勤奋、新机会、学习', reversed:'懒散、拖延' },
    { name:'星币骑士', upright:'勤奋、可靠、稳健', reversed:'停滞、缺乏野心' },
    { name:'星币皇后', upright:'务实、丰盛、滋养', reversed:'过度关注物质' },
    { name:'星币国王', upright:'成功、可靠、富裕', reversed:'贪婪、物质主义' }
];

function drawTarot(spread) {
    const pool = [...TAROT_DECK];
    const positions = spread === 'single' ? ['指引']
                    : spread === 'three' ? ['过去', '现在', '未来']
                    : ['当下','挑战','过去','现在','未来','近期','自我','环境','希望/恐惧','最终结果']; // 凯尔特十字 10 张
    const drawn = [];
    for (let i=0; i<positions.length; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        const card = pool.splice(idx, 1)[0];
        const reversed = Math.random() < 0.3;
        drawn.push({
            position: positions[i],
            name: card.name,
            reversed,
            meaning: reversed ? card.reversed : card.upright
        });
    }
    return drawn;
}

app.post('/api/divination/tarot', async (req, res) => {
    const { spread='three', question='' } = req.body || {};
    const cards = drawTarot(spread);
    let interpretation = '';
    let ai_enhanced = false;

    // 简洁本地解读
    interpretation = cards.map(c => `【${c.position}】${c.name}${c.reversed?'（逆位）':''}：${c.meaning}`).join('\n');
    if (question) interpretation = `问题：${question}\n\n` + interpretation;

    if (CFG.deepseek.apiKey && question) {
        const prompt = `你是一位资深塔罗解读师。用户问题："${question}"。\n牌阵：${spread}，抽到的牌：\n${cards.map(c=>`${c.position}: ${c.name}${c.reversed?'(逆)':''} — ${c.meaning}`).join('\n')}\n\n请用 200-300 字给出整体解读，指出核心讯息和行动建议。语气温暖而有智慧。`;
        const r = await callLLMGeneric([{role:'user', content: prompt}], 800);
        if (r) { interpretation += '\n\n【AI 深度解读】\n' + r; ai_enhanced = true; }
    }

    // 存日志
    if (db) {
        try {
            const id = 'T' + Date.now().toString(36).toUpperCase();
            db.run('INSERT INTO divination_log(id,user_id,type,question,payload,result,llm_enhanced) VALUES(?,?,?,?,?,?,?)',
                [id, 'guest', 'tarot', question||'', JSON.stringify({spread}), JSON.stringify({cards, interpretation}), ai_enhanced?1:0]);
            saveDB();
        } catch(e) { console.error('[Divination DB]', e.message); }
    }
    res.json({ success: true, cards, interpretation, ai_enhanced });
});

// 摇杯筊
app.post('/api/divination/jiaobei', async (req, res) => {
    const { question='' } = req.body || {};
    const throws_ = [Math.random()<0.5, Math.random()<0.5];
    let result;
    if (throws_[0] && !throws_[1]) result = '圣杯';
    else if (!throws_[0] && !throws_[1]) result = '阴杯';
    else if (throws_[0] && throws_[1]) result = '阳杯';
    else result = '笑杯';
    const meanings = {
        '圣杯':'一阴一阳，阴阳调和。所求之事可行。',
        '阴杯':'双阴，阴阳不协。所求未合天时，建议再请示或改日。',
        '阳杯':'双阳，阴阳未谐。需多祈求，或事未至。',
        '笑杯':'神明微笑，问题或许过于执念，可放宽心。'
    };
    let interpretation = meanings[result];
    if (question) interpretation = `问题：${question}\n结果：${result}\n${meanings[result]}`;

    if (CFG.deepseek.apiKey && question) {
        const prompt = `用户以杯筊请示："${question}"。投掷结果：${result}（两筊：${throws_.map(t=>t?'阳':'阴').join('、')}）。\n请以庙宇解签师的语气，用 80-120 字解读此结果。`;
        const r = await callLLMGeneric([{role:'user', content: prompt}], 400);
        if (r) { interpretation += '\n\n【庙祝解曰】\n' + r; }
    }
    res.json({ success:true, result, throws: throws_, interpretation });
});

// 每日一签
const QIAN_LIBRARY = [
    { level:'上上', poem:'日出东边照晚霞，万里鹏程路不差。\n莫道前途多险阻，拨开云雾见仙家。', story:'出自《牡丹亭》：杜丽娘梦中遇柳梦梅。', advice:'大吉之象，事业姻缘皆可成就。但需持盈保泰，不可骄纵。' },
    { level:'上',   poem:'云中月出月初圆，恰遇嫦娥舞翩跹。\n莫道此时光景好，前头更有艳阳天。', story:'出自《西厢记》：张生月下会莺莺。', advice:'小吉，当前顺遂。把握当下，宜守宜进。' },
    { level:'中上', poem:'枯木逢春再发芽，门庭改换旧时花。\n虽然未得风云会，渐次亨通自足夸。', story:'出自《琵琶记》：蔡伯喈衣锦还乡。', advice:'渐入佳境，稳扎稳打可期大成。' },
    { level:'中',   poem:'身在樊笼志在林，浮云遮月未分明。\n忽然一阵东风起，散尽浮云月再明。', story:'出自《桃花扇》：侯方域与李香君离合。', advice:'暂时受阻，耐心等待时机。半年内将转机。' },
    { level:'中下', poem:'春花落尽夏花开，转换之间气数催。\n莫怨时乖兼命蹇，且将心事付瑶台。', story:'出自《长生殿》：唐明皇与杨贵妃。', advice:'运势平平，宜守不宜攻。多行善事可化解。' },
    { level:'下',   poem:'独坐寒江钓雪鱼，蓑衣斗笠耐清孤。\n不辞冰霜相持久，待到春来水自舒。', story:'出自《水浒》：林冲风雪山神庙。', advice:'低谷之时，需内修。不可强求，转念即安。' },
    { level:'下下', poem:'黑云压顶雨倾盆，进退维艰路不分。\n劝君且把心扉闭，守得云开见月明。', story:'出自《窦娥冤》：冤屈待昭雪。', advice:'大凶之象，宜静守退避。等待转机，切勿冒进。' }
];

app.get('/api/divination/daily', (req, res) => {
    const userKey = req.query.user_id || 'guest';
    const today = new Date().toISOString().slice(0, 10);
    // 用 date+userKey 做稳定 hash
    let hash = 0;
    const seed = today + '|' + userKey;
    for (let i=0; i<seed.length; i++) hash = ((hash<<5) - hash + seed.charCodeAt(i)) | 0;
    hash = Math.abs(hash);
    const idx = hash % 100; // 100 签
    const qian = QIAN_LIBRARY[hash % QIAN_LIBRARY.length];
    const qianId = String((hash % 100) + 1).padStart(3, '0');
    res.json({
        success: true,
        date: today,
        qian_id: qianId,
        level: qian.level,
        poem: qian.poem,
        story: qian.story,
        advice: qian.advice
    });
});

// ════════════════════════════════════════════════════════════
//  v3.6  灵境修行 (Cultivation)
// ════════════════════════════════════════════════════════════

const TASKS_TEMPLATES = [
    { id:'kindness',   type:'日行一善',   icon:'🌸', desc:'今日做一件善事，助人即是助己' },
    { id:'scripture',  type:'诵读经典',   icon:'📜', desc:'诵读一段经典：《心经》《清静经》或任意一篇' },
    { id:'meditation', type:'静坐冥想',   icon:'🧘', desc:'静坐 5-10 分钟，观呼吸' },
    { id:'gratitude',  type:'感恩反思',   icon:'🙏', desc:'记录今日三件值得感恩的事' }
];

app.get('/api/cultivation/today', (req, res) => {
    const userId = req.query.user_id || 'guest';
    const today = new Date().toISOString().slice(0,10);
    let done = [];
    if (db) {
        try {
            const r = db.exec('SELECT task_id FROM checkins WHERE user_id=? AND checkin_date=?', [userId, today]);
            if (r.length) done = r[0].values.map(v=>v[0]);
        } catch(e) {}
    }
    const tasks = TASKS_TEMPLATES.map(t => ({ ...t, completed: done.includes(t.id) }));
    res.json({ success: true, date: today, tasks });
});

app.post('/api/cultivation/checkin', (req, res) => {
    const { user_id='guest', task_id } = req.body || {};
    if (!task_id) return res.status(400).json({ success:false, error:'缺少 task_id' });
    const task = TASKS_TEMPLATES.find(t => t.id === task_id);
    if (!task) return res.status(400).json({ success:false, error:'未知任务' });
    const today = new Date().toISOString().slice(0,10);
    if (!db) return res.status(500).json({ success:false });
    try {
        const r = db.exec('SELECT id FROM checkins WHERE user_id=? AND task_id=? AND checkin_date=?', [user_id, task_id, today]);
        if (r.length && r[0].values.length) {
            // 取消打卡（toggle）
            db.run('DELETE FROM checkins WHERE id=?', [r[0].values[0][0]]);
            saveDB();
            return res.json({ success:true, action:'unchecked' });
        }
        const id = 'K' + Date.now().toString(36).toUpperCase();
        db.run('INSERT INTO checkins(id,user_id,task_id,task_type,checkin_date) VALUES(?,?,?,?,?)', [id, user_id, task_id, task.type, today]);
        saveDB();
        res.json({ success:true, action:'checked', task_id, value: 1 });
    } catch(e) { res.status(500).json({ success:false, error:e.message }); }
});

app.get('/api/cultivation/stats', (req, res) => {
    const userId = req.query.user_id || 'guest';
    if (!db) return res.status(500).json({ success:false });
    try {
        const r = db.exec('SELECT checkin_date, COUNT(*) FROM checkins WHERE user_id=? GROUP BY checkin_date ORDER BY checkin_date DESC', [userId]);
        if (!r.length) return res.json({ success:true, total:0, streak:0, level:'初学者', recent:[] });
        const dates = r[0].values.map(v=>v[0]);
        const total = r[0].values.reduce((s,v)=>s+v[1], 0);
        // streak
        let streak = 0;
        const today = new Date();
        for (let i=0; i<365; i++) {
            const d = new Date(today); d.setDate(today.getDate()-i);
            const ds = d.toISOString().slice(0,10);
            if (dates.includes(ds)) streak++;
            else break;
        }
        const level = total<8?'初学者' : total<31?'行者' : total<101?'居士' : total<366?'真人' : '仙人';
        res.json({ success:true, total, streak, level, recent: dates.slice(0, 7) });
    } catch(e) { res.status(500).json({ success:false, error:e.message }); }
});

const MEDITATION_SCENES = [
    { id:'forest', name:'森林晨曦', icon:'🌲', desc:'漫步于晨雾森林，鸟鸣与溪流相伴', script:'请闭上眼睛。\n想象你走入一片清晨的森林。\n树叶间洒下斑驳的金色阳光。\n\n深呼吸。感受脚下松软的泥土。\n\n远处的鸟鸣此起彼伏。\n近处有溪水流过卵石，淙淙作响。\n\n你不必去任何地方。\n你只是在这里。\n\n让所有思绪如同落叶，\n轻轻飘落，化为大地的养分。\n\n你安住于此刻。' },
    { id:'sea', name:'海边日落', icon:'🌊', desc:'夕阳西下，海浪轻抚脚踝', script:'请闭上眼睛。\n想象你赤足站在海边。\n\n海浪轻柔地漫过你的脚踝，\n又缓缓退去，留下一片湿润的沙。\n\n天空是一片金红色的画布，\n夕阳正慢慢沉入海平线。\n\n深呼吸。\n闻见海风带来的咸涩气息。\n\n让所有烦恼随着海浪远去。\n你站在天地之间，无比辽阔。' },
    { id:'stars', name:'星空之夜', icon:'✨', desc:'仰望银河，星辰如瀑', script:'请闭上眼睛。\n想象你躺在柔软的草地上。\n\n头顶是深邃的夜空，\n亿万颗星辰静静闪烁。\n\n银河如一条流动的光带，\n从你头顶缓缓流过。\n\n深呼吸。\n你胸口的起伏，\n正与宇宙的呼吸同频。\n\n你是一粒微尘，\n也是整个宇宙。' },
    { id:'temple', name:'古寺钟声', icon:'🏯', desc:'禅寺钟声回响，檀香袅袅', script:'请闭上眼睛。\n想象你走入一座古朴的禅寺。\n\n青石板上苔痕点点，\n空气中弥漫着淡淡的檀香。\n\n远处的钟声响起，\n一声，又一声。\n\n你在一尊佛像前驻足。\n合掌，低眉，\n让所有纷扰沉淀下去。\n\n此刻你心中，\n只有钟声与你。' },
    { id:'snow', name:'雪山极境', icon:'🏔️', desc:'雪峰巍峨，万籁俱寂', script:'请闭上眼睛。\n想象你站在雪山的山腰。\n\n四周是连绵的雪峰，\n天空是一种极致的蓝。\n\n空气稀薄而纯净，\n每一次呼吸都清晰可见。\n\n你感觉万籁俱寂。\n只有风，轻轻拂过雪面，\n扬起一缕细雪。\n\n你安住于这片宁静。\n一切本已圆满。' }
];

app.get('/api/cultivation/meditation', (_req, res) => {
    res.json({ success:true, scenes: MEDITATION_SCENES.map(s => ({ id:s.id, name:s.name, icon:s.icon, desc:s.desc })) });
});
app.get('/api/cultivation/meditation/:id', (req, res) => {
    const s = MEDITATION_SCENES.find(x => x.id === req.params.id);
    if (!s) return res.status(404).json({ success:false, error:'未知场景' });
    res.json({ success:true, data: s });
});

app.post('/api/cultivation/diary', (req, res) => {
    const { user_id='guest', mood, energy, gratitudes, reflection, diary_date } = req.body || {};
    if (mood==null || energy==null) return res.status(400).json({ success:false, error:'mood 和 energy 必填' });
    const date = diary_date || new Date().toISOString().slice(0,10);
    if (!db) return res.status(500).json({ success:false });
    try {
        const r = db.exec('SELECT id FROM diary WHERE user_id=? AND diary_date=?', [user_id, date]);
        if (r.length && r[0].values.length) {
            db.run('UPDATE diary SET mood=?, energy=?, gratitudes=?, reflection=? WHERE id=?', [
                +mood, +energy, JSON.stringify(gratitudes||[]), reflection||'', r[0].values[0][0]
            ]);
            saveDB();
            return res.json({ success:true, action:'updated' });
        }
        const id = 'D' + Date.now().toString(36).toUpperCase();
        db.run('INSERT INTO diary(id,user_id,mood,energy,gratitudes,reflection,diary_date) VALUES(?,?,?,?,?,?,?)', [
            id, user_id, +mood, +energy, JSON.stringify(gratitudes||[]), reflection||'', date
        ]);
        saveDB();
        res.json({ success:true, action:'created', id });
    } catch(e) { res.status(500).json({ success:false, error:e.message }); }
});

app.get('/api/cultivation/diary', (req, res) => {
    const userId = req.query.user_id || 'guest';
    if (!db) return res.status(500).json({ success:false });
    try {
        const r = db.exec('SELECT id, mood, energy, gratitudes, reflection, diary_date FROM diary WHERE user_id=? ORDER BY diary_date DESC LIMIT 90', [userId]);
        if (!r.length) return res.json({ success:true, entries:[] });
        const entries = r[0].values.map(v => ({
            id:v[0], mood:v[1], energy:v[2], gratitudes:JSON.parse(v[3]||'[]'), reflection:v[4], diary_date:v[5]
        }));
        res.json({ success:true, entries });
    } catch(e) { res.status(500).json({ success:false, error:e.message }); }
});

app.get('/api/cultivation/diary/trend', (req, res) => {
    const userId = req.query.user_id || 'guest';
    const days = +(req.query.days || 30);
    if (!db) return res.status(500).json({ success:false });
    try {
        const r = db.exec(`SELECT diary_date, mood, energy FROM diary WHERE user_id=? ORDER BY diary_date DESC LIMIT ?`, [userId, days]);
        if (!r.length) return res.json({ success:true, trend:[] });
        const trend = r[0].values.reverse().map(v => ({ date:v[0], mood:v[1], energy:v[2] }));
        res.json({ success:true, trend });
    } catch(e) { res.status(500).json({ success:false, error:e.message }); }
});

// ════════════════════════════════════════════════════════════
//  v3.7  灵境市集 (Market)
// ════════════════════════════════════════════════════════════

const MARKET_DIGITAL = [
    { id:'d-fortune-pdf', name:'完整命理报告 (PDF)', icon:'📄', price: 999, desc:'包含 100 年运势曲线 + 六维度深度解读' },
    { id:'d-bazi-card',   name:'八字排盘海报 (PNG)', icon:'🖼️', price: 199, desc:'精美海报，适合分享朋友圈' },
    { id:'d-tarot-long',  name:'塔罗牌阵长图', icon:'🃏', price: 299, desc:'凯尔特十字 10 张牌完整解读' },
    { id:'d-dream-pdf',   name:'梦境解析报告', icon:'🌙', price: 399, desc:'周公+心理学双维度专业分析' },
    { id:'d-daily-qian',  name:'今日一签海报', icon:'🎴', price: 99,  desc:'每日专属签文 + 精美排版' }
];

const MARKET_CRYSTALS = [
    { id:'c-amethyst',  name:'紫水晶',  wx:'火', price: 188, desc:'智慧之石，安神助眠，适合水命人' },
    { id:'c-citrine',   name:'黄水晶',  wx:'土', price: 168, desc:'财富之石，招财纳福，适合金命人' },
    { id:'c-rose',      name:'粉水晶',  wx:'木', price: 158, desc:'爱情之石，催旺桃花，适合火命人' },
    { id:'c-obsidian',  name:'黑曜石',  wx:'水', price: 128, desc:'辟邪化煞，吸纳负能量，适合火命人' },
    { id:'c-jade',      name:'翡翠',    wx:'木', price: 999, desc:'君子之石，五行平衡，适合所有人' },
    { id:'c-hetian',    name:'和田玉',  wx:'土', price: 1299,desc:'温润养人，厚重安稳，适合火命人' },
    { id:'c-clear',     name:'白水晶',  wx:'金', price: 138, desc:'万能之石，强化能量场' },
    { id:'c-tiger',     name:'虎眼石',  wx:'木', price: 158, desc:'勇气之石，强化事业运' },
    { id:'c-moonstone', name:'月光石',  wx:'水', price: 188, desc:'柔和能量，助眠安神' },
    { id:'c-garnet',    name:'石榴石',  wx:'火', price: 198, desc:'活力之石，催旺事业' }
];

const MARKET_EVENTS = [
    { id:'e-tea-2026-07', name:'夏日玄学茶会', date:'2026-07-15', location:'上海·静安寺', slots: 30, price: 99, desc:'品茗论道，与命理师面对面' },
    { id:'e-meditation-2026-08', name:'三日禅修营', date:'2026-08-10', location:'杭州·灵隐寺', slots: 20, price: 999, desc:'深度禅修 + 八字解读 + 一对一咨询' },
    { id:'e-crystal-2026-09', name:'水晶品鉴沙龙', date:'2026-09-20', location:'北京·国子监', slots: 50, price: 199, desc:'水晶能量场体验 + 个人适配推荐' }
];

app.get('/api/market/digital',  (_req, res) => res.json({ success:true, items: MARKET_DIGITAL }));
app.get('/api/market/crystals', (_req, res) => res.json({ success:true, items: MARKET_CRYSTALS }));
app.get('/api/market/events',   (_req, res) => res.json({ success:true, items: MARKET_EVENTS }));

app.post('/api/market/wishlist', (req, res) => {
    const { user_id='guest', item_id, item_type } = req.body || {};
    if (!item_id || !item_type) return res.status(400).json({ success:false, error:'缺少参数' });
    if (!db) return res.status(500).json({ success:false });
    try {
        const r = db.exec('SELECT id FROM wishlist WHERE user_id=? AND item_id=?', [user_id, item_id]);
        if (r.length && r[0].values.length) {
            db.run('DELETE FROM wishlist WHERE id=?', [r[0].values[0][0]]);
            saveDB();
            return res.json({ success:true, action:'removed' });
        }
        const id = 'W' + Date.now().toString(36).toUpperCase();
        db.run('INSERT INTO wishlist(id,user_id,item_id,item_type) VALUES(?,?,?,?)', [id, user_id, item_id, item_type]);
        saveDB();
        res.json({ success:true, action:'added' });
    } catch(e) { res.status(500).json({ success:false, error:e.message }); }
});

app.get('/api/market/wishlist', (req, res) => {
    const userId = req.query.user_id || 'guest';
    if (!db) return res.status(500).json({ success:false });
    try {
        const r = db.exec('SELECT id, item_id, item_type, created_at FROM wishlist WHERE user_id=? ORDER BY created_at DESC', [userId]);
        if (!r.length) return res.json({ success:true, items:[] });
        const items = r[0].values.map(v => {
            const id=v[0], itemId=v[1], itemType=v[2], createdAt=v[3];
            const all = [...MARKET_DIGITAL, ...MARKET_CRYSTALS, ...MARKET_EVENTS];
            const found = all.find(x => x.id === itemId);
            return { id, item: found, item_type:itemType, created_at:createdAt };
        }).filter(x => x.item);
        res.json({ success:true, items });
    } catch(e) { res.status(500).json({ success:false, error:e.message }); }
});

// ───────────────────────── Start ──────────────────────────

async function start() {
    await initDatabase();
    await initAuthTable();
    app.listen(PORT, HOST, () => {
        console.log('');
        console.log('╔══════════════════════════════════════╗');
        console.log('║     Nexus Ora  v3.7  │  Running      ║');
        console.log('╠══════════════════════════════════════╣');
        console.log(`║  URL : http://${HOST}:${PORT}          ║`);
        console.log(`║  LLM : ${CFG.deepseek.apiKey && CFG.deepseek.apiKey !== 'sk-placeholder' ? 'DeepSeek ✓            ' : 'Algorithm fallback    '}  ║`);
        console.log(`║  DB  : SQLite ✓                      ║`);
        console.log('╚══════════════════════════════════════╝');
        console.log('  Press Ctrl+C to stop');
        console.log('');
    }).on('error', e => {
        if (e.code === 'EADDRINUSE') console.error(`[ERROR] Port ${PORT} in use. Set PORT= in .env`);
        else console.error('[ERROR]', e.message);
        process.exit(1);
    });
}

start();
