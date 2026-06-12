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
const { paipan } = require('./paipan_engine.js');

const app  = express();
const PORT = process.env.PORT || 3000;
const HOST = '127.0.0.1';   // bind 本地，避免 Windows 防火墙弹窗

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
            return;
        } catch { db = new SQL.Database(); }
    } else {
        db = new SQL.Database();
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

app.get('/api/health', (_req, res) => {
    res.json({ status:'ok', version:'3.0.0', llm: !!CFG.deepseek.apiKey, db: !!db });
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
            success_url: `http://127.0.0.1:${PORT}/?paid=true&report=${reportId||''}`,
            cancel_url:  `http://127.0.0.1:${PORT}/`
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

// ───────────────────────── Start ──────────────────────────

async function start() {
    await initDatabase();
    app.listen(PORT, HOST, () => {
        console.log('');
        console.log('╔══════════════════════════════════════╗');
        console.log('║     Nexus Ora  v3.0  │  Running      ║');
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
