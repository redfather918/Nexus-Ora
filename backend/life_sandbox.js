/**
 * Nexus Ora - 人生沙盘推演引擎 (Life Sandbox)
 * 借鉴 MiroFish「平行数字世界 + 上帝视角注入变量」思想：
 *
 *   以命盘为种子，孵化多个「平行人生智能体」(Parallel Life Agent)。
 *   每个智能体代表一种人生策略人格，在同一命盘约束下独立演化出
 *   自己的百年运势轨迹；用户还可注入干预变量（如"30岁裸辞创业"），
 *   观察轨迹分叉。
 *
 *   演化机制（离线可用，确定性）：
 *     基线轨迹 = swarm_fortune 群体涌现曲线
 *     每个平行智能体持有: 风险偏好 / 机会敏感度 / 抗压韧性 / 变量响应表
 *     逐年演化: score' = 基线 + 人格调制(顺境放大/逆境衰减) + 干预冲击波 + 路径依赖动量
 *
 *   LLM 增强（可选）：为每条平行人生生成叙事小传与关键抉择点评。
 *
 * API 输出：多轨迹曲线 + 分叉点 + 各世界线统计对比 + 叙事。
 */

const { swarmFortune, buildCtx, hashSeed, mulberry32 } = require('./swarm_fortune.js');
const llm = require('./agents/llm_client.js');

// ───────────────────── 平行人生人格库 ─────────────────────

const PERSONAS = {
    baseline: {
        id: 'baseline', name: '本我世界线', icon: '🌐', color: '#8b8b9e',
        desc: '不作干预、顺命而行的基准轨迹',
        riskAppetite: 0.0, opportunitySense: 0.0, resilience: 0.0
    },
    aggressive: {
        id: 'aggressive', name: '进取世界线', icon: '🔥', color: '#e74c5b',
        desc: '高风险高回报：主动跳槽、创业、加杠杆，顺境更顺、逆境更险',
        riskAppetite: 0.9, opportunitySense: 0.7, resilience: -0.3
    },
    steady: {
        id: 'steady', name: '稳健世界线', icon: '🛡️', color: '#3f9d6f',
        desc: '守成路线：体制内/大平台深耕、强储蓄，波动被压平但峰值受限',
        riskAppetite: -0.7, opportunitySense: -0.2, resilience: 0.8
    },
    pivot: {
        id: 'pivot', name: '转型世界线', icon: '🦋', color: '#6c5ce7',
        desc: '在低谷期主动转型换赛道：低谷更深但反弹更陡，大器晚成型',
        riskAppetite: 0.3, opportunitySense: 0.9, resilience: 0.4
    }
};

// 干预变量类型 → 冲击波参数（幅度、持续、后效）
const INTERVENTION_TYPES = {
    'career_change': { label: '转行/跳槽', shock: -6, recovery: 3, longGain: +4 },
    'startup':       { label: '创业',       shock: -12, recovery: 5, longGain: +9 },
    'marriage':      { label: '婚姻',       shock: +5,  recovery: 2, longGain: +2 },
    'relocation':    { label: '迁居/出国',  shock: -4,  recovery: 3, longGain: +3 },
    'study':         { label: '深造',       shock: -3,  recovery: 2, longGain: +5 },
    'invest':        { label: '重大投资',   shock: -8,  recovery: 4, longGain: +6 },
    'custom':        { label: '自定义事件', shock: -5,  recovery: 3, longGain: +3 }
};

// ───────────────────── 轨迹演化 ─────────────────────

/**
 * 单个平行智能体逐年演化
 * @param {Array} baseline 基线曲线 [{age,score,...}]
 * @param {object} persona 人格参数
 * @param {Array} interventions [{age, type, note}]
 * @param {function} rand 确定性随机源
 */
function evolveTrajectory(baseline, persona, interventions, rand) {
    const n = baseline.length;
    const scores = new Array(n);
    let momentum = 0;                       // 路径依赖动量
    const events = [];

    // 预计算干预冲击时间表
    const shockMap = new Array(n).fill(0);
    for (const iv of interventions) {
        const cfgIv = INTERVENTION_TYPES[iv.type] || INTERVENTION_TYPES.custom;
        const age = Math.max(0, Math.min(100, iv.age | 0));
        // 冲击期：即刻震荡（受风险偏好调制：激进人格冲击略缓、韧性人格恢复更快）
        const shock = cfgIv.shock * (1 - persona.resilience * 0.35);
        const recovery = Math.max(1, Math.round(cfgIv.recovery * (1 - persona.resilience * 0.3)));
        const longGain = cfgIv.longGain * (1 + persona.opportunitySense * 0.5);
        for (let a = age; a < Math.min(n, age + recovery); a++) {
            shockMap[a] += shock * (1 - (a - age) / recovery);
        }
        // 长期收益：恢复期后逐渐兑现，10年内线性爬坡后维持
        for (let a = age + recovery; a < n; a++) {
            const t = Math.min(1, (a - age - recovery) / 10);
            shockMap[a] += longGain * t;
        }
        events.push({ age, label: cfgIv.label, note: iv.note || '' });
    }

    for (let i = 0; i < n; i++) {
        const base = baseline[i].score;
        const dev = base - 55;                                    // 相对中枢偏离
        // 人格调制：风险偏好放大顺境与逆境；韧性抬升谷底
        let mod = 0;
        if (dev > 0) mod += dev * persona.riskAppetite * 0.45;
        else         mod += dev * (persona.riskAppetite * 0.55 - persona.resilience * 0.5);
        // 机会敏感度：在基线拐点年额外捕获收益
        if (i >= 2 && baseline[i].score - baseline[i - 2].score >= 6) {
            mod += persona.opportunitySense * 5;
        }
        // 韧性：低谷托底
        if (base < 40) mod += persona.resilience * 6;
        // 动量：上一年表现带来的路径依赖（成功惯性/挫折惯性）
        momentum = momentum * 0.6 + mod * 0.15;
        // 确定性微扰
        const noise = (rand() - 0.5) * 3 * (1 + Math.abs(persona.riskAppetite));

        const v = base + mod + momentum + shockMap[i] + noise;
        scores[i] = Math.round(Math.max(10, Math.min(98, v)));
    }
    return { scores, events };
}

/** 找两条轨迹的显著分叉点 */
function findDivergences(a, b, threshold = 12) {
    const out = [];
    let inZone = false;
    for (let i = 0; i < a.length; i++) {
        const gap = Math.abs(a[i] - b[i]);
        if (gap >= threshold && !inZone) { out.push({ age: i, gap }); inZone = true; }
        if (gap < threshold * 0.6) inZone = false;
    }
    return out.slice(0, 6);
}

function trajectoryStats(scores) {
    const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
    let peak = 0, valley = 0;
    scores.forEach((v, i) => { if (v > scores[peak]) peak = i; if (v < scores[valley]) valley = i; });
    // 波动率
    let vol = 0;
    for (let i = 1; i < scores.length; i++) vol += Math.abs(scores[i] - scores[i - 1]);
    // 黄金年份数（>=75）与低谷年份数（<40）
    const golden = scores.filter(v => v >= 75).length;
    const dark = scores.filter(v => v < 40).length;
    return {
        average: Math.round(avg * 10) / 10,
        peak_age: peak, peak_score: scores[peak],
        valley_age: valley, valley_score: scores[valley],
        volatility: Math.round(vol / (scores.length - 1) * 10) / 10,
        golden_years: golden, dark_years: dark
    };
}

// ───────────────────── LLM 叙事增强 ─────────────────────

const NARRATOR_SYSTEM = `你是「平行世界观察者」，负责为人生沙盘推演撰写世界线叙事。
输入：一个人的命盘概要 + 多条平行世界线的轨迹统计与干预事件。
要求：叙事有画面感但克制，像纪录片旁白；每条世界线 60-90 字；不重复数字，写"命运的质感"。
严格输出 JSON：
{
  "narratives": { "<世界线id>": "60-90字叙事", ... },
  "verdict": "对比所有世界线后给当事人的洞见（60字内，不替用户做决定，点出取舍本质）"
}`;

async function enhanceNarratives(paipan, worlds) {
    if (!llm.available()) return null;
    const b = paipan.bazi || {};
    const brief = `日主${b.day_gan || ''}${b.day_wuxing || ''} 身${b.body_strength || '中和'}，生肖${paipan.info?.animal || ''}，性别${paipan.info?.gender || ''}`;
    const lines = worlds.map(w =>
        `${w.id}(${w.name})：均分${w.stats.average}，峰值${w.stats.peak_score}分@${w.stats.peak_age}岁，谷底${w.stats.valley_score}分@${w.stats.valley_age}岁，波动率${w.stats.volatility}，黄金年${w.stats.golden_years}年，低谷年${w.stats.dark_years}年${w.events.length ? '，干预：' + w.events.map(e => `${e.age}岁${e.label}`).join('、') : ''}`
    ).join('\n');
    return await llm.callJSON(NARRATOR_SYSTEM, `命盘：${brief}\n\n世界线数据：\n${lines}`, { temperature: 0.8, maxTokens: 2048 });
}

// ───────────────────── 主入口 ─────────────────────

/**
 * 运行人生沙盘推演
 * @param {object} paipan 排盘结果
 * @param {object} options {
 *     personas: ['aggressive','steady','pivot'],   // 选用的平行人格（baseline 恒定包含）
 *     interventions: [{ age: 30, type: 'startup', note: '裸辞创业', targets: ['aggressive'] }],
 *     narrative: true                              // 是否 LLM 叙事增强
 * }
 */
async function runSandbox(paipan, options = {}) {
    const personaIds = (options.personas && options.personas.length
        ? options.personas : ['aggressive', 'steady', 'pivot'])
        .filter(id => PERSONAS[id] && id !== 'baseline');

    const interventions = Array.isArray(options.interventions) ? options.interventions : [];

    // 1. 基线（群体涌现引擎）
    const { fortune, ctx } = swarmFortune(paipan);
    const baselineScores = fortune.map(f => f.score);

    // 2. 平行世界演化
    const worlds = [];
    worlds.push({
        ...metaOf(PERSONAS.baseline),
        scores: baselineScores,
        events: [],
        stats: trajectoryStats(baselineScores)
    });

    for (const pid of personaIds) {
        const persona = PERSONAS[pid];
        const rand = mulberry32(hashSeed(ctx.seedStr + '::' + pid));
        // 该世界线生效的干预 = 未指定 targets 的全局干预 + 指定包含此线的干预
        const ivs = interventions.filter(iv => !iv.targets || !iv.targets.length || iv.targets.includes(pid));
        const { scores, events } = evolveTrajectory(fortune, persona, ivs, rand);
        worlds.push({ ...metaOf(persona), scores, events, stats: trajectoryStats(scores) });
    }

    // 3. 分叉点（各平行线 vs 基线）
    const divergences = {};
    for (const w of worlds) {
        if (w.id === 'baseline') continue;
        divergences[w.id] = findDivergences(baselineScores, w.scores);
    }

    // 4. 推荐世界线（均分 * 0.5 + 黄金年 * 0.8 - 低谷年 * 0.6 - 波动惩罚）
    let best = worlds[0], bestVal = -Infinity;
    for (const w of worlds) {
        const v = w.stats.average * 0.5 + w.stats.golden_years * 0.8 - w.stats.dark_years * 0.6 - w.stats.volatility * 1.2;
        if (v > bestVal) { bestVal = v; best = w; }
    }

    // 5. LLM 叙事（可选，失败不影响主结果）
    let narratives = null, verdict = '';
    if (options.narrative !== false) {
        try {
            const nr = await enhanceNarratives(paipan, worlds);
            if (nr) { narratives = nr.narratives || null; verdict = nr.verdict || ''; }
        } catch (e) { console.error('[Sandbox] narrative error:', e.message); }
    }
    // 离线叙事兜底
    if (!narratives) {
        narratives = {};
        for (const w of worlds) {
            narratives[w.id] = offlineNarrative(w);
        }
        verdict = `${best.name}综合质量最高，但沙盘只展示概率分布——波动率${worlds.find(w=>w.id!=='baseline')?.stats.volatility ?? '—'}的差异，本质是「确定性」与「可能性」的交换。`;
    }
    for (const w of worlds) w.narrative = narratives[w.id] || '';

    return {
        seed: { day_master: (paipan.bazi?.day_gan || '') + (paipan.bazi?.day_wuxing || ''), body: paipan.bazi?.body_strength || '中和' },
        worlds,
        divergences,
        recommended: best.id,
        verdict,
        ai_enhanced: !!llm.available(),
        personas_available: Object.values(PERSONAS).map(metaOf),
        intervention_types: Object.entries(INTERVENTION_TYPES).map(([k, v]) => ({ type: k, label: v.label }))
    };
}

function metaOf(p) {
    return { id: p.id, name: p.name, icon: p.icon, color: p.color, desc: p.desc };
}

function offlineNarrative(w) {
    const s = w.stats;
    if (w.id === 'baseline')  return `顺命而行的底稿。${s.peak_age}岁登顶，${s.valley_age}岁探底，${s.golden_years}个黄金年份平铺在一条不疾不徐的曲线上。`;
    if (w.id === 'aggressive') return `每一次波峰都被放大，每一次波谷也是。这条线上的人把人生当作头寸，${s.peak_age}岁的高光与${s.valley_age}岁的深渊只隔几次决定。`;
    if (w.id === 'steady')     return `曲线被磨平了棱角。少了${s.golden_years < 10 ? '一些' : ''}惊艳的年份，也躲过了最深的坑，${s.dark_years}个低谷年是四条线里最温柔的。`;
    if (w.id === 'pivot')      return `低谷被主动踩深，换来后半程更陡的爬升。${s.valley_age}岁的转身决定了${s.peak_age}岁的高度，是一条典型的后发曲线。`;
    return `一条均分${s.average}的世界线，峰值${s.peak_score}，谷底${s.valley_score}。`;
}

module.exports = { runSandbox, PERSONAS, INTERVENTION_TYPES };
