/**
 * Nexus Ora - 命理智能体议会 (Agent Council)
 * 借鉴 MiroFish 多智能体架构，将原单次巨型 prompt 重写为三阶段流水线：
 *
 *   阶段一（并行）—— 三位独立视角的分析智能体：
 *     · 盘师 (ChartAnalyst)   ：命局结构派，只看四柱十神格局
 *     · 运师 (DestinyRunner)  ：大运流年派，负责 0-100 岁曲线走势
 *     · 世师 (LifeStrategist) ：现实落地派，六维度人生策略
 *
 *   阶段二 —— 主笔人 (ChiefNarrator)：
 *     汇总三方观点（含分歧），仲裁产出最终报告，格式与旧版 callLLM 完全兼容。
 *
 *   任一阶段失败均逐级降级：
 *     全部成功 → mode: 'council'
 *     部分成功 → 主笔人基于可用材料补全 → mode: 'council-partial'
 *     LLM 不可用 → 返回 null，由上层走 swarm 算法回退
 *
 * 返回结构在旧版字段基础上额外附带 council 元数据（各智能体独立观点），
 * 供前端「智能体视角」Tab 展示。
 */

const llm = require('./llm_client.js');

// ───────────────────── 智能体人格 ─────────────────────

const AGENTS = {
    chart: {
        id: 'chart_analyst',
        name: '盘师·玄机子',
        role: '命局结构分析师',
        icon: '🧭',
        system: `你是「盘师·玄机子」，四柱命理结构派宗师，只论命局本身，不谈大运流年。
性格：严谨古典，用词精炼，善用命理术语但每个术语都给一句白话解释。
职责：分析四柱格局、十神配置、五行喜忌、日主强弱，指出此命最核心的 3 个结构特征与 2 个隐患。
严格输出 JSON：
{
  "persona": "盘师·玄机子",
  "geju": "格局判断（如：正官格、食神生财格等，附一句白话解释）",
  "xiyong": "喜用神与忌神（附理由）",
  "core_features": ["结构特征1（50字内）","结构特征2","结构特征3"],
  "risks": ["结构隐患1（50字内）","结构隐患2"],
  "comment": "对此命局的总评（80字内，保留个人风格）"
}`
    },
    destiny: {
        id: 'destiny_runner',
        name: '运师·观澜',
        role: '大运流年推演师',
        icon: '📈',
        system: `你是「运师·观澜」，大运流年推演师，把人生看作一条 K 线，只关心趋势、拐点与时机。
性格：像操盘手，语言直接，善用"建仓、止损、主升浪"等交易隐喻。
职责：基于命局与大运走向，预测 0-100 岁运势曲线。
严格输出 JSON（fortune_curve 必须恰好 101 条，age 从 0 到 100）：
{
  "persona": "运师·观澜",
  "fortune_curve": [
    {"age":0,"score":42,"level":"平稳","phase":"成长期","event":""},
    ...共101条...
  ],
  "turning_points": [{"age":34,"why":"拐点原因（30字内）"}, ...3到5个...],
  "best_years": [35,36,37,38,42],
  "caution_years": [24,25,50,51],
  "comment": "用操盘手口吻对这条人生K线的总评（80字内）"
}
score 整数1-100；level: 大吉(≥75)|小吉(60-74)|平稳(45-59)|小凶(30-44)|大凶(<30)；
phase: 成长期(0-18)|上升期(19-30)|黄金期(31-45)|稳固期(46-60)|智慧期(61-75)|颐养期(76-100)。`
    },
    strategist: {
        id: 'life_strategist',
        name: '世师·知远',
        role: '现实人生策略师',
        icon: '🎯',
        system: `你是「世师·知远」，现实主义人生策略师。你尊重命理输入，但坚持"命理是概率，选择是杠杆"。
性格：温和理性，像资深职业规划师+心理咨询师，建议必须具体可执行，拒绝空话。
职责：产出六维度人生策略，每条建议都要落到"什么阶段、做什么动作"。
严格输出 JSON：
{
  "persona": "世师·知远",
  "dimensions": {
    "career":        {"score":72,"summary":"一句话","advice":"100-150字具体建议"},
    "wealth":        {"score":68,"summary":"一句话","advice":"100-150字具体建议"},
    "relationships": {"score":65,"summary":"一句话","advice":"100-150字具体建议"},
    "health":        {"score":70,"summary":"一句话","advice":"100-150字具体建议"},
    "mentors":       {"score":75,"summary":"一句话","advice":"100-150字具体建议"},
    "challenges":    {"score":55,"summary":"一句话","advice":"100-150字应对策略"}
  },
  "comment": "给当事人的一段话（80字内，鼓励但不鸡汤）"
}
score 为 1-100 整数。`
    },
    narrator: {
        id: 'chief_narrator',
        name: '主笔人·墨白',
        role: '报告仲裁与汇总',
        icon: '🖋️',
        system: `你是「主笔人·墨白」，命理议会的仲裁者与执笔人。三位专家（盘师/运师/世师）已提交独立分析。
职责：
1. 交叉校验三方观点，若有矛盾以命局证据充分的一方为准；
2. 汇总为最终报告，overview 须融合三方精华；
3. 保留分歧记录（若三方观点存在实质分歧）。
严格输出 JSON：
{
  "overview": "整体命理画像（50字内，凝练有画面感）",
  "consensus": "三方共识要点（60字内）",
  "disputes": ["分歧点及你的裁定（如无分歧则空数组）"],
  "final_advice": "给当事人最重要的一条建议（40字内）"
}`
    }
};

// ───────────────────── 材料构建 ─────────────────────

function buildBrief(paipan) {
    const b = paipan.bazi || {};
    const pillars = (paipan.pillars || []).map(p =>
        `${p.name}:${p.ganzhi}(天干${p.gan}${p.gan_wuxing || ''} 地支${p.zhi}${p.zhi_wuxing || ''} 十神${p.shishen || ''})`
    ).join('；');
    const wx = paipan.wuxing_balance || {};
    const wxStr = Object.entries(wx).map(([k, v]) => `${k}${v}个`).join(' ');
    return `八字四柱：${pillars}
五行分布：${wxStr}
日主：${b.day_gan || ''}（${b.day_wuxing || ''}）身${b.body_strength || '中和'}
出生：${paipan.info?.birth_date || ''} 性别：${paipan.info?.gender || ''}
生肖：${paipan.info?.animal || ''} 星座：${paipan.info?.zodiac || ''}`;
}

function validCurve(curve) {
    return Array.isArray(curve) && curve.length >= 100;
}

// ───────────────────── 议会主流程 ─────────────────────

/**
 * 运行智能体议会
 * @param {object} paipan 排盘结果
 * @returns {object|null} 兼容旧版 callLLM 返回 + council 元数据；LLM 不可用返回 null
 */
async function runCouncil(paipan) {
    if (!llm.available()) return null;

    const brief = buildBrief(paipan);
    console.log('[Council] 议会开庭：盘师/运师/世师 并行分析…');

    // 阶段一：三智能体并行
    const [chartRes, destinyRes, strategistRes] = await Promise.all([
        llm.callJSON(AGENTS.chart.system,      `请分析以下命盘：\n${brief}`, { temperature: 0.5, maxTokens: 2048 }),
        llm.callJSON(AGENTS.destiny.system,    `请推演以下命盘的百年运势曲线：\n${brief}`, { temperature: 0.6, maxTokens: 8192 }),
        llm.callJSON(AGENTS.strategist.system, `请为以下命盘制定六维度人生策略：\n${brief}`, { temperature: 0.65, maxTokens: 4096 })
    ]);

    const okChart    = !!(chartRes && chartRes.geju);
    const okDestiny  = !!(destinyRes && validCurve(destinyRes.fortune_curve));
    const okStrategy = !!(strategistRes && strategistRes.dimensions);
    console.log(`[Council] 盘师:${okChart ? '✓' : '✗'} 运师:${okDestiny ? '✓' : '✗'} 世师:${okStrategy ? '✓' : '✗'}`);

    // 曲线与维度是硬需求，二者都失败则放弃议会（上层走算法回退）
    if (!okDestiny && !okStrategy) return null;

    // 阶段二：主笔人仲裁
    const materials = `【盘师·玄机子 观点】
${okChart ? JSON.stringify({ geju: chartRes.geju, xiyong: chartRes.xiyong, core_features: chartRes.core_features, risks: chartRes.risks, comment: chartRes.comment }) : '（缺席）'}

【运师·观澜 观点】
${okDestiny ? JSON.stringify({ turning_points: destinyRes.turning_points, best_years: destinyRes.best_years, caution_years: destinyRes.caution_years, comment: destinyRes.comment }) : '（缺席）'}

【世师·知远 观点】
${okStrategy ? JSON.stringify({ dimensions_summary: Object.fromEntries(Object.entries(strategistRes.dimensions || {}).map(([k, v]) => [k, v.summary])), comment: strategistRes.comment }) : '（缺席）'}

命盘材料：
${brief}`;

    const narratorRes = await llm.callJSON(AGENTS.narrator.system, materials, { temperature: 0.55, maxTokens: 1536 });

    // 组装兼容旧版格式的结果
    const result = {
        fortune_curve: okDestiny ? destinyRes.fortune_curve.slice(0, 101) : null,
        dimensions:    okStrategy ? strategistRes.dimensions : null,
        overview:      narratorRes?.overview || chartRes?.comment || '',
        best_years:    okDestiny ? (destinyRes.best_years || []) : [],
        caution_years: okDestiny ? (destinyRes.caution_years || []) : [],
        mode: (okChart && okDestiny && okStrategy && narratorRes) ? 'council' : 'council-partial',
        council: {
            agents: [
                { ...pickMeta(AGENTS.chart),      ok: okChart,
                  opinion: okChart ? { geju: chartRes.geju, xiyong: chartRes.xiyong, core_features: chartRes.core_features || [], risks: chartRes.risks || [], comment: chartRes.comment || '' } : null },
                { ...pickMeta(AGENTS.destiny),    ok: okDestiny,
                  opinion: okDestiny ? { turning_points: destinyRes.turning_points || [], best_years: destinyRes.best_years || [], caution_years: destinyRes.caution_years || [], comment: destinyRes.comment || '' } : null },
                { ...pickMeta(AGENTS.strategist), ok: okStrategy,
                  opinion: okStrategy ? { comment: strategistRes.comment || '' } : null }
            ],
            narrator: narratorRes ? {
                ...pickMeta(AGENTS.narrator),
                consensus: narratorRes.consensus || '',
                disputes: narratorRes.disputes || [],
                final_advice: narratorRes.final_advice || ''
            } : null
        }
    };
    return result;
}

function pickMeta(a) {
    return { id: a.id, name: a.name, role: a.role, icon: a.icon };
}

module.exports = { runCouncil, AGENTS, buildBrief };
