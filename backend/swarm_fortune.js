/**
 * Nexus Ora - 群体涌现式运势预测引擎 (Swarm Fortune Engine)
 * 借鉴 MiroFish 群体智能思想重写的算法回退模块：
 *   不再用单一公式生成曲线，而是让多个「因子代理」(Factor Agent)
 *   各自独立评估 0-100 岁每一年的运势，再通过加权共识聚合，
 *   叠加确定性涌现扰动，形成更符合命理逻辑的运势曲线。
 *
 * 因子代理：
 *   1. LifecycleAgent  生命周期代理 —— 人生阶段基础弧线
 *   2. WuxingAgent     五行流转代理 —— 流年天干五行 vs 日主（喜忌随身强弱翻转）
 *   3. DayunAgent      大运代理     —— 十年一运的宏观加持/压制
 *   4. LiunianAgent    流年代理     —— 六十甲子、地支六冲、本命年
 *   5. ShishenAgent    十神结构代理 —— 命局十神配置对不同人生阶段的偏置
 *   6. BalanceAgent    平衡度代理   —— 五行离散度惩罚/奖励
 *
 * 输出与旧版 algorithmFortune 完全兼容，并额外附带 breakdown（各代理贡献）
 * 与 consensus（逐岁分歧度），供前端「智能体视角」可视化。
 */

const GAN = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const ZHI = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const GAN_WX = { '甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水' };
const ZHI_WX = { '子':'水','丑':'土','寅':'木','卯':'木','辰':'土','巳':'火','午':'火','未':'土','申':'金','酉':'金','戌':'土','亥':'水' };

// 五行生克环
const WX_GEN = { '金':'水','水':'木','木':'火','火':'土','土':'金' };   // A 生 B
const WX_KE  = { '金':'木','木':'土','土':'水','水':'火','火':'金' };   // A 克 B

// 地支六冲
const ZHI_CHONG = { '子':'午','午':'子','丑':'未','未':'丑','寅':'申','申':'寅','卯':'酉','酉':'卯','辰':'戌','戌':'辰','巳':'亥','亥':'巳' };
// 地支六合
const ZHI_HE = { '子':'丑','丑':'子','寅':'亥','亥':'寅','卯':'戌','戌':'卯','辰':'酉','酉':'辰','巳':'申','申':'巳','午':'未','未':'午' };

const PHASES = [
    { start:0,  end:18,  name:'成长期', base:47 },
    { start:19, end:30,  name:'上升期', base:57 },
    { start:31, end:45,  name:'黄金期', base:64 },
    { start:46, end:60,  name:'稳固期', base:57 },
    { start:61, end:75,  name:'智慧期', base:59 },
    { start:76, end:100, name:'颐养期', base:49 }
];

const KEY_EVENTS = {
    6:'小学入学', 12:'初中升学', 15:'高中', 18:'成年/高考',
    22:'大学毕业', 25:'职场初期', 30:'而立之年',
    35:'事业上升期', 40:'不惑之年', 50:'知天命',
    60:'退休节点', 70:'古稀之年', 80:'耄耋之年'
};

// ───────────────────── 确定性随机（同一命盘结果稳定）─────────────────────

function hashSeed(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// ───────────────────── 工具 ─────────────────────

/** 流年干支相对日主的十神类别（粗粒度：同我/生我/我生/我克/克我） */
function relationToDay(wx, dayWx) {
    if (wx === dayWx)          return 'peer';    // 比劫
    if (WX_GEN[wx] === dayWx)  return 'support'; // 印星（生我）
    if (WX_GEN[dayWx] === wx)  return 'output';  // 食伤（我生）
    if (WX_KE[dayWx] === wx)   return 'wealth';  // 财星（我克）
    if (WX_KE[wx] === dayWx)   return 'officer'; // 官杀（克我）
    return 'peer';
}

/** 身强身弱决定五行关系的喜忌得分 */
function relationScore(rel, isStrong) {
    // 身强：喜 我生(泄)、我克(财)、克我(官杀可任)；忌 生我、同我
    // 身弱：喜 生我(印)、同我(比劫)；忌 克我、我克、我生
    const table = isStrong
        ? { peer:-4, support:-3, output:+8, wealth:+7, officer:+4 }
        : { peer:+6, support:+8, output:-3, wealth:-4, officer:-9 };
    return table[rel] || 0;
}

function ganzhiOfAge(yearGanIdx, yearZhiIdx, age) {
    return {
        gan: GAN[(yearGanIdx + age) % 10],
        zhi: ZHI[(yearZhiIdx + age) % 12]
    };
}

function smooth(arr, win = 2) {
    const out = new Array(arr.length);
    for (let i = 0; i < arr.length; i++) {
        let s = 0, n = 0;
        for (let j = Math.max(0, i - win); j <= Math.min(arr.length - 1, i + win); j++) { s += arr[j]; n++; }
        out[i] = s / n;
    }
    return out;
}

// ───────────────────── 因子代理 ─────────────────────

function lifecycleAgent(ctx) {
    const scores = [];
    for (let age = 0; age <= 100; age++) {
        const p = PHASES.find(x => age >= x.start && age <= x.end) || PHASES[0];
        // 阶段内平滑过渡：抛物线鼓形，阶段边缘略低
        const span = p.end - p.start || 1;
        const t = (age - p.start) / span;                 // 0..1
        const arc = Math.sin(Math.PI * t) * 4;            // 阶段中部 +4
        scores.push(p.base + arc);
    }
    return { id:'lifecycle', name:'生命周期代理', weight: 1.0, scores,
             note:'以六大人生阶段为基础弧线，阶段中部能量最盛。' };
}

function wuxingAgent(ctx) {
    const scores = [];
    for (let age = 0; age <= 100; age++) {
        const { gan } = ganzhiOfAge(ctx.yearGanIdx, ctx.yearZhiIdx, age);
        const rel = relationToDay(GAN_WX[gan], ctx.dayWx);
        scores.push(50 + relationScore(rel, ctx.isStrong) * 1.6);
    }
    return { id:'wuxing', name:'五行流转代理', weight: 1.2, scores,
             note:`日主${ctx.dayGan}${ctx.dayWx}，${ctx.isStrong ? '身强喜泄耗（食伤/财星年走高）' : '身弱喜生扶（印星/比劫年走高）'}。` };
}

function dayunAgent(ctx) {
    const scores = new Array(101).fill(50);
    const dayunNotes = [];
    for (let i = 0; i < 10; i++) {
        const gan = GAN[(ctx.monthGanIdx + i + 1) % 10];
        const zhi = ZHI[(ctx.monthZhiIdx + i + 1) % 12];
        const startAge = ctx.qiyunAge + i * 10;
        const relG = relationToDay(GAN_WX[gan], ctx.dayWx);
        const relZ = relationToDay(ZHI_WX[zhi], ctx.dayWx);
        const s = 50 + relationScore(relG, ctx.isStrong) * 1.2 + relationScore(relZ, ctx.isStrong) * 0.9;
        for (let a = startAge; a < startAge + 10 && a <= 100; a++) scores[a] = s;
        if (startAge <= 100) dayunNotes.push({ start_age:startAge, ganzhi:gan+zhi, score:Math.round(s) });
    }
    return { id:'dayun', name:'大运代理', weight: 1.5, scores: smooth(scores, 3),
             note:`自${ctx.qiyunAge}岁起每十年一运，大运干支与日主喜忌决定十年宏观趋势。`,
             dayun: dayunNotes };
}

function liunianAgent(ctx) {
    const scores = [];
    for (let age = 0; age <= 100; age++) {
        const { zhi } = ganzhiOfAge(ctx.yearGanIdx, ctx.yearZhiIdx, age);
        let s = 50;
        if (zhi === ctx.dayZhi)               s -= 3;   // 伏吟
        if (ZHI_CHONG[zhi] === ctx.dayZhi)    s -= 8;   // 冲日支
        if (ZHI_HE[zhi]    === ctx.dayZhi)    s += 6;   // 合日支
        if (age > 0 && age % 12 === 0)        s -= 5;   // 本命年（值太岁）
        if (ZHI_CHONG[zhi] === ctx.yearZhi0)  s -= 4;   // 冲太岁
        scores.push(s);
    }
    return { id:'liunian', name:'流年代理', weight: 1.0, scores,
             note:'逐年地支与日支的冲合、本命年值太岁、冲太岁效应。' };
}

function shishenAgent(ctx) {
    const c = ctx.shishenCount;
    const scores = [];
    for (let age = 0; age <= 100; age++) {
        let s = 50;
        // 印星旺 → 早年学业顺
        if (age <= 22) s += Math.min(3, c.yin) * 3 - Math.min(2, c.shang) * 2;
        // 官杀+财星 → 中年事业财富
        if (age >= 28 && age <= 55) s += Math.min(3, c.guan + c.cai) * 2.5;
        // 食伤 → 创造力，青年-中年加成
        if (age >= 20 && age <= 45) s += Math.min(2, c.shi) * 2;
        // 比劫过重 → 中年破财风险
        if (age >= 35 && age <= 50 && c.bi >= 3) s -= 4;
        // 印星 → 晚年安稳
        if (age >= 60) s += Math.min(2, c.yin) * 2.5;
        scores.push(s);
    }
    return { id:'shishen', name:'十神结构代理', weight: 1.1, scores,
             note:`命局十神：印${c.yin} 官杀${c.guan} 财${c.cai} 食伤${c.shi + c.shang} 比劫${c.bi}，不同人生阶段权重不同。` };
}

function balanceAgent(ctx) {
    const vals = Object.values(ctx.wuxingBalance);
    const mean = vals.reduce((a,b)=>a+b,0) / (vals.length || 1);
    const variance = vals.reduce((s,v)=>s+(v-mean)**2,0) / (vals.length || 1);
    const sd = Math.sqrt(variance);
    const flat = 50 + (2.2 - Math.min(2.2, sd)) * 5 - 4;   // 越均衡越高，约 46~57
    const missing = Object.entries(ctx.wuxingBalance).filter(([,v]) => v === 0).map(([k]) => k);
    return { id:'balance', name:'平衡度代理', weight: 0.8, scores: new Array(101).fill(flat),
             note: missing.length ? `五行缺${missing.join('、')}，离散度 ${sd.toFixed(2)}，全程小幅承压。`
                                  : `五行齐全，离散度 ${sd.toFixed(2)}，命局底盘${sd < 1.2 ? '稳固' : '有偏'}。` };
}

// ───────────────────── 上下文构建 ─────────────────────

function buildCtx(paipan) {
    const b = paipan.bazi || {};
    const dayGan = b.day_gan || '甲';
    const dayWx = b.day_wuxing || GAN_WX[dayGan] || '木';
    const dayZhi = (b.day || '甲子')[1] || '子';
    const yearGz = b.year || '甲子';
    const monthGz = b.month || '甲子';
    const isStrong = (b.body_strength || '中和').includes('强');

    // 十神计数（天干精确 + 地支按五行近似）
    const count = { bi:0, yin:0, guan:0, cai:0, shi:0, shang:0 };
    for (const p of paipan.pillars || []) {
        for (const wx of [p.gan_wuxing, p.zhi_wuxing]) {
            const rel = relationToDay(wx, dayWx);
            if (rel === 'peer') count.bi++;
            else if (rel === 'support') count.yin++;
            else if (rel === 'officer') count.guan++;
            else if (rel === 'wealth') count.cai++;
            else if (rel === 'output') count.shi++;
        }
    }
    // 日柱本身算一个比肩，扣除
    count.bi = Math.max(0, count.bi - 1);

    // 起运岁数：用年干阴阳 + 性别的简化规则（3-8 岁之间，确定性）
    const yearGanIdx = Math.max(0, GAN.indexOf(yearGz[0]));
    const male = (paipan.info?.gender || '男') === '男';
    const yangYear = yearGanIdx % 2 === 0;
    const qiyunAge = ((yangYear === male) ? 3 : 6) + (ZHI.indexOf(yearGz[1] || '子') % 3);

    return {
        dayGan, dayWx, dayZhi, isStrong,
        yearGz, yearZhi0: yearGz[1] || '子',
        yearGanIdx,
        yearZhiIdx: Math.max(0, ZHI.indexOf(yearGz[1] || '子')),
        monthGanIdx: Math.max(0, GAN.indexOf(monthGz[0])),
        monthZhiIdx: Math.max(0, ZHI.indexOf(monthGz[1] || '子')),
        qiyunAge,
        wuxingBalance: paipan.wuxing_balance || { '金':1,'木':2,'水':2,'火':2,'土':1 },
        shishenCount: count,
        seedStr: `${b.year}|${b.month}|${b.day}|${b.hour}|${paipan.info?.gender || ''}`
    };
}

// ───────────────────── 聚合 ─────────────────────

/**
 * 群体共识聚合：加权平均 + 分歧度 + 涌现扰动
 */
function swarmFortune(paipan) {
    const ctx = buildCtx(paipan);
    const agents = [
        lifecycleAgent(ctx),
        wuxingAgent(ctx),
        dayunAgent(ctx),
        liunianAgent(ctx),
        shishenAgent(ctx),
        balanceAgent(ctx)
    ];

    const rand = mulberry32(hashSeed(ctx.seedStr));
    const totalW = agents.reduce((s,a)=>s+a.weight,0);

    const raw = [];
    const consensus = [];
    for (let age = 0; age <= 100; age++) {
        let acc = 0;
        const votes = [];
        for (const a of agents) {
            acc += a.scores[age] * a.weight;
            votes.push(a.scores[age]);
        }
        const mean = acc / totalW;
        // 分歧度（标准差）：代理意见越分裂，该年越动荡
        const vMean = votes.reduce((s,v)=>s+v,0)/votes.length;
        const sd = Math.sqrt(votes.reduce((s,v)=>s+(v-vMean)**2,0)/votes.length);
        // 涌现扰动：确定性噪声，幅度随分歧度放大
        const noise = (rand() - 0.5) * 2 * (2 + Math.min(6, sd * 0.4));
        raw.push(mean + noise);
        consensus.push(Number(sd.toFixed(1)));
    }

    const smoothed = smooth(raw, 1);
    const fortune = smoothed.map((v, age) => {
        const score = Math.round(Math.max(15, Math.min(96, v)));
        const level = score>=75?'大吉': score>=60?'小吉': score>=45?'平稳': score>=30?'小凶':'大凶';
        const phase = (PHASES.find(p => age >= p.start && age <= p.end) || PHASES[0]).name;
        return { age, score, level, phase, event: KEY_EVENTS[age] || '' };
    });

    const breakdown = agents.map(a => ({
        id: a.id, name: a.name, weight: a.weight, note: a.note,
        scores: a.scores.map(v => Math.round(v)),
        ...(a.dayun ? { dayun: a.dayun } : {})
    }));

    return { fortune, breakdown, consensus, ctx };
}

// ───────────────────── 六维度（因子投票版）─────────────────────

function swarmDimensions(paipan, fortune, ctxIn) {
    const ctx = ctxIn || buildCtx(paipan);
    const c = ctx.shishenCount;
    const avg = Math.round(fortune.reduce((s,f)=>s+f.score,0)/fortune.length);
    const clamp = (v) => Math.round(Math.max(35, Math.min(95, v)));

    const strengthTxt = ctx.isStrong ? '身强' : '身弱';
    const favor = ctx.isStrong ? '食伤、财星' : '印星、比劫';

    const careerScore = clamp(55 + (c.guan + c.cai) * 4 + (ctx.isStrong ? 5 : -2) + (avg - 55) * 0.3);
    const wealthScore = clamp(52 + c.cai * 6 + (ctx.isStrong ? 6 : -4) + (avg - 55) * 0.25);
    const loveScore   = clamp(56 + Math.min(2, c.cai + c.guan) * 3 - Math.max(0, c.bi - 2) * 3 + (avg - 55) * 0.2);
    const vals = Object.values(ctx.wuxingBalance);
    const mean = vals.reduce((a,b)=>a+b,0)/(vals.length||1);
    const sd = Math.sqrt(vals.reduce((s,v)=>s+(v-mean)**2,0)/(vals.length||1));
    const healthScore = clamp(72 - sd * 6 + (avg - 55) * 0.15);
    const mentorScore = clamp(54 + c.yin * 6 + (avg - 55) * 0.25);
    const lows = fortune.filter(f => f.score < 42).map(f => f.age);
    const challengeScore = clamp(75 - lows.length * 1.5);

    return {
        career: {
            score: careerScore,
            summary: `官杀财星共${c.guan + c.cai}见，${strengthTxt}格局下事业${careerScore >= 70 ? '可担重任' : careerScore >= 55 ? '稳中有进' : '宜厚积薄发'}`,
            advice: `日主${ctx.dayGan}${ctx.dayWx}${strengthTxt}，喜${favor}。${ctx.isStrong ? '身强能任财官，可主动争取管理职责或独立开拓，' : '身弱宜借势平台与贵人，先深耕专业再图突破，'}大运走${favor}之地时（详见大运表）事业推进最省力。命局官杀${c.guan}见${c.guan >= 2 ? '，责任压力并存，注意劳逸平衡' : c.guan === 0 ? '，体制约束少，适合自由度高的领域' : '，恰到好处，利于稳定晋升'}。`
        },
        wealth: {
            score: wealthScore,
            summary: `财星${c.cai}见，${ctx.isStrong ? '身强担财' : '身弱财多反累'}，财富${wealthScore >= 70 ? '积累潜力强' : '宜稳健规划'}`,
            advice: `${ctx.isStrong ? `身强喜财，${c.cai >= 2 ? '命局财星有力，主动型收入与投资皆可为，' : '命局财星偏少，财富更多来自专业能力变现，'}财星流年（我克之年）进账机会最多。` : `身弱不宜重仓冒险，${c.cai >= 3 ? '财多身弱，最忌盲目扩张与替人担保，' : ''}建议以强制储蓄+稳健配置为主，印星流年适合提升自己，财自随之。`}低谷年份（运势分<42）避免大额投入。`
        },
        relationships: {
            score: loveScore,
            summary: `感情${loveScore >= 70 ? '缘分顺遂' : loveScore >= 55 ? '平稳中需经营' : '需主动破局'}，${c.bi >= 3 ? '比劫偏重防竞争' : '桃花随大运起伏'}`,
            advice: `${c.bi >= 3 ? '命局比劫偏旺，感情中易遇竞争者或因朋友生变，择偶宜避开三角关系期。' : ''}合日支之年（六合流年）姻缘信号最强，冲日支之年感情易动荡、不宜仓促决定。${ctx.isStrong ? '身强者个性主导欲强，学会让渡决定权是长久之道。' : '身弱者易在感情中过度迁就，保持自我边界感情反而更稳。'}`
        },
        health: {
            score: healthScore,
            summary: `五行离散度${sd.toFixed(1)}，${sd < 1.2 ? '体质底盘均衡' : '注意偏枯五行对应脏腑'}`,
            advice: `${(() => {
                const organ = { '金':'肺与呼吸道','木':'肝胆与情绪','水':'肾与循环','火':'心脑血管','土':'脾胃消化' };
                const weak = Object.entries(ctx.wuxingBalance).sort((a,b)=>a[1]-b[1])[0];
                return `五行以${weak[0]}最弱（${weak[1]}个），重点养护${organ[weak[0]] || '整体'}。`;
            })()}冲日支与本命年流年身体易出小状况，提前体检。规律作息+适度有氧是最普适的改运方式。`
        },
        mentors: {
            score: mentorScore,
            summary: `印星${c.yin}见，贵人${mentorScore >= 68 ? '缘分深厚' : '需主动结缘'}`,
            advice: `${c.yin >= 2 ? '命局印星有力，天生易得长辈、师长、领导提携，关键节点多听前辈意见。' : '印星偏弱，贵人不会自动出现，需要用实力与口碑吸引——把作品放到台面上，机会随之而来。'}印星流年（生我之年）是拜师、进修、结识关键人物的最佳窗口。`
        },
        challenges: {
            score: challengeScore,
            summary: `全程低谷约${lows.length}年，集中在${lows.slice(0,3).join('、') || '少数'}岁前后`,
            advice: `低谷年份多为${ctx.isStrong ? '印比过重、气势壅塞之年，宜以输出（学习成果、项目落地）疏导' : '官杀克身、财多耗身之年，宜守不宜攻，保存实力'}。提前 2-3 年布局：留足 6 个月现金流、维持核心人脉、低谷期只做减法不做加法。挑战年往往紧邻转机年，撑过即是拐点。`
        }
    };
}

module.exports = { swarmFortune, swarmDimensions, buildCtx, hashSeed, mulberry32, GAN, ZHI, GAN_WX, ZHI_WX };
