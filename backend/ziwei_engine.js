/**
 * Nexus Ora - 紫微斗数排盘引擎 v1.0
 * 纯 JS 实现，依赖 lunar-typescript
 * 算法基于传统紫微斗数安星规则
 */

const { Solar } = require('lunar-typescript');

// ─────────────── 地支顺序 ───────────────
const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

// ─────────────── 天干 ───────────────
const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];

// ─────────────── 12 宫名 ───────────────
// 安命宫后，从命宫逆布宫名（传统顺序）
const PALACE_NAMES = ['命宫', '兄弟', '夫妻', '子女', '财帛', '疾厄', '迁移', '交友', '事业', '田宅', '福德', '父母'];

// ─────────────── 主星安星表 ───────────────
// 紫微星系：按阴历月份定位（阴历日数起紫微星位置）
// 紫微星所在宫 = ZI_WEI_TABLE[生日(1-30)] → 对应地支序号(0=子)
const ZI_WEI_TABLE = {
  1: 2, 2: 0, 3: 10, 4: 8, 5: 6, 6: 4,
  7: 2, 8: 0, 9: 10, 10: 8, 11: 6, 12: 4,
  13: 2, 14: 0, 15: 10, 16: 8, 17: 6, 18: 4,
  19: 2, 20: 0, 21: 10, 22: 8, 23: 6, 24: 4,
  25: 2, 26: 0, 27: 10, 28: 8, 29: 6, 30: 4
};

// 紫微星系距离偏移（以紫微星为基准，顺布）
// 天机(-1), 太阳(-2 or +6), 武曲(-3), 天同(-4 or +4), 廉贞(-5 or +3)
const ZI_WEI_GROUP = [
  { name: '紫微', offset: 0, type: '帝王星', yinyang: '阴土', wuxing: '土' },
  { name: '天机', offset: -1, type: '智慧星', yinyang: '阴木', wuxing: '木' },
  { name: '太阳', offset: -2, type: '官禄星', yinyang: '阳火', wuxing: '火' },
  { name: '武曲', offset: -3, type: '财帛星', yinyang: '阴金', wuxing: '金' },
  { name: '天同', offset: -4, type: '福德星', yinyang: '阳水', wuxing: '水' },
  { name: '廉贞', offset: -5, type: '囚星', yinyang: '阴火', wuxing: '火' },
];

// 天府星系：以天府星为基准（天府与紫微隔命宫对宫）
const TIAN_FU_GROUP = [
  { name: '天府', offset: 0,  type: '财库星', yinyang: '阳土', wuxing: '土' },
  { name: '太阴', offset: 1,  type: '财帛星', yinyang: '阴水', wuxing: '水' },
  { name: '贪狼', offset: 2,  type: '欲望星', yinyang: '阳木', wuxing: '木' },
  { name: '巨门', offset: 3,  type: '是非星', yinyang: '阴土', wuxing: '土' },
  { name: '天相', offset: 4,  type: '印星', yinyang: '阳水', wuxing: '水' },
  { name: '天梁', offset: 5,  type: '荫星', yinyang: '阳土', wuxing: '土' },
  { name: '七杀', offset: 6,  type: '将星', yinyang: '阳金', wuxing: '金' },
  { name: '破军', offset: 10, type: '耗星', yinyang: '阴水', wuxing: '水' },
];

// ─────────────── 六吉星安星 ───────────────
// 左辅：生月起寅宫顺布
// 右弼：生月起戌宫逆布
// 文昌：生时起戌宫逆布
// 文曲：生时起子宫顺布
// 天魁、天钺：由年干决定
const TIAN_KUI_TABLE  = { '甲':1, '戊':1, '庚':1, '乙':11, '己':11, '丙':8, '丁':8, '壬':4, '癸':4, '辛':6 }; // 地支序
const TIAN_YUE_TABLE  = { '甲':7, '戊':7, '庚':7, '乙':5,  '己':5,  '丙':10,'丁':10,'壬':0, '癸':0, '辛':4 };

// ─────────────── 四化表（以年干） ───────────────
const SI_HUA_TABLE = {
  '甲': { '化禄':'廉贞', '化权':'破军', '化科':'武曲', '化忌':'太阳' },
  '乙': { '化禄':'天机', '化权':'天梁', '化科':'紫微', '化忌':'太阴' },
  '丙': { '化禄':'天同', '化权':'天机', '化科':'文昌', '化忌':'廉贞' },
  '丁': { '化禄':'太阴', '化权':'天同', '化科':'天机', '化忌':'巨门' },
  '戊': { '化禄':'贪狼', '化权':'太阴', '化科':'右弼', '化忌':'天机' },
  '己': { '化禄':'武曲', '化权':'贪狼', '化科':'天梁', '化忌':'文曲' },
  '庚': { '化禄':'太阳', '化权':'武曲', '化科':'太阴', '化忌':'天同' },
  '辛': { '化禄':'巨门', '化权':'太阳', '化科':'文曲', '化忌':'文昌' },
  '壬': { '化禄':'天梁', '化权':'紫微', '化科':'左辅', '化忌':'武曲' },
  '癸': { '化禄':'破军', '化权':'巨门', '化科':'太阴', '化忌':'贪狼' },
};

// ─────────────── 命宫主星性格解读 ───────────────
const MING_GONG_INTERPRET = {
  '紫微': { title: '帝王格', desc: '领袖气质天成，独立自主，追求完美，具有极强的组织协调能力。适合担任领导职务，但需避免自我中心。', lucky: '紫色·黄金', element: '土' },
  '天机': { title: '智慧格', desc: '聪明机智，思维活跃，善于分析谋划。学习能力极强，博学多才，但容易想太多、犹豫不决。', lucky: '绿色·青色', element: '木' },
  '太阳': { title: '光明格', desc: '热情开朗，慷慨大方，具有强烈的正义感和社会责任感。适合公关、外交、政务类工作。', lucky: '红色·橙色', element: '火' },
  '武曲': { title: '将帅格', desc: '刚毅果断，行动力极强，有强烈的功名心。适合军警、金融、工程类。感情上较为理性。', lucky: '白色·金色', element: '金' },
  '天同': { title: '福星格', desc: '温和善良，随遇而安，生活享受型。人缘极好，具有艺术天分，但缺乏进取心，需要激励。', lucky: '蓝色·青色', element: '水' },
  '廉贞': { title: '囚星格', desc: '个性鲜明，情感丰富，爱憎分明。具有开拓精神，但容易冲动。需特别注意感情与法律问题。', lucky: '红色·粉色', element: '火' },
  '天府': { title: '财库格', desc: '稳重踏实，注重实际利益，善于积累财富。保守但可靠，是天生的储蓄者和管理者。', lucky: '黄色·棕色', element: '土' },
  '太阴': { title: '月华格', desc: '温柔细腻，直觉敏锐，富有同情心。艺术鉴赏力强，适合文艺、教育、咨询类工作。', lucky: '银色·白色', element: '水' },
  '贪狼': { title: '桃花格', desc: '魅力四射，欲望强烈，多才多艺。社交能力一流，但贪多嚼不烂。桃花运极旺，感情复杂。', lucky: '绿色·红色', element: '木' },
  '巨门': { title: '是非格', desc: '口才出众，善辩多疑，洞察力强。适合传播、法律、辩论类职业。需注意口舌是非。', lucky: '黑色·灰色', element: '土' },
  '天相': { title: '印信格', desc: '善良忠厚，处事公正，是天生的协调者和辅佐者。注重形象，有贵人缘，适合行政管理。', lucky: '蓝色·白色', element: '水' },
  '天梁': { title: '荫庇格', desc: '清高正直，富有责任心，具有父母长辈般的包容特质。适合医疗、宗教、公益类工作。', lucky: '绿色·黄色', element: '土' },
  '七杀': { title: '将星格', desc: '孤傲独立，执行力超强，是命中的冲锋陷阵者。适合开创性工作。感情上直接，缺乏柔情。', lucky: '白色·红色', element: '金' },
  '破军': { title: '开拓格', desc: '变革创新，不循旧例，个性鲜明。适合突破传统的领域。人生起伏较大，善于在逆境中翻盘。', lucky: '黑色·蓝色', element: '水' },
  '空宫': { title: '借星安宫', desc: '命宫无主星，需借对宫主星论命。性格较为中性，受环境影响较大，适应能力强。', lucky: '紫色·银色', element: '综合' },
};

// ─────────────── 主函数 ───────────────

/**
 * 紫微斗数排盘
 * @param {object} param
 * @param {number} param.year   公历年
 * @param {number} param.month  公历月
 * @param {number} param.day    公历日
 * @param {number} param.hour   公历时（0-23）
 * @param {number} param.minute 公历分
 * @param {string} param.gender 性别：'男' | '女'
 * @returns {object} 命盘数据
 */
function ziwei({ year, month, day, hour, minute = 0, gender }) {
    // 1. 转换为农历
    const solar = Solar.fromYmdHms(year, month, day, hour, minute, 0);
    const lunar = solar.getLunar();

    const lunarYear  = lunar.getYear();
    const lunarMonth = Math.abs(lunar.getMonth()); // 闰月取绝对值
    const lunarDay   = lunar.getDay();
    const lunarHour  = solar.getHour();

    // 年干支
    const yearGanZhi = lunar.getYearInGanZhi();
    const yearGan    = yearGanZhi[0];
    const yearZhi    = yearGanZhi[1];

    // 2. 确定时支（子丑寅卯辰巳午未申酉戌亥）
    const hourZhiIdx = Math.floor((lunarHour + 1) / 2) % 12;

    // 3. 安命宫 — 虎口诀
    // 命宫起寅（2），生月往前顺数，生时再逆回
    // 命宫地支 = (寅(2) + 生月 - 1 - 时支) mod 12
    const mingZhiIdx = ((2 + lunarMonth - 1 - hourZhiIdx) % 12 + 12) % 12;

    // 4. 安身宫 — 身宫起寅，生月顺布，生时加
    const shenZhiIdx = ((2 + lunarMonth - 1 + hourZhiIdx) % 12 + 12) % 12;

    // 5. 安紫微星
    const day30 = Math.min(lunarDay, 30);
    const ziWeiBase = ZI_WEI_TABLE[day30] !== undefined ? ZI_WEI_TABLE[day30] : 2;

    // 初始化 12 宫（按地支序号）
    const palaces = Array.from({ length: 12 }, (_, i) => ({
        zhiIdx:  i,
        zhi:     ZHI[i],
        name:    '',       // 宫名（在命宫确定后填入）
        stars:   [],       // 星曜数组
        isMing:  i === mingZhiIdx,
        isShen:  i === shenZhiIdx,
    }));

    // 6. 布宫名（从命宫逆时针，按传统12宫顺序）
    for (let i = 0; i < 12; i++) {
        const palaceIdx = ((mingZhiIdx + i) % 12 + 12) % 12;
        palaces[palaceIdx].name = PALACE_NAMES[i];
    }

    // 7. 布紫微星系（天干支从紫微出发逆布）
    for (const star of ZI_WEI_GROUP) {
        const starIdx = ((ziWeiBase + star.offset) % 12 + 12) % 12;
        palaces[starIdx].stars.push({ name: star.name, type: '主星', detail: star });
    }

    // 8. 布天府星系（天府与紫微的宫位关系：子宫紫微 → 天府在寅；顺时针镜像）
    // 天府 = 紫微所在 + (命宫宫位 - 紫微宫位)*2 % 12 → 简化：天府在 (14 - 紫微) % 12
    const tianFuBase = (14 - ziWeiBase % 12) % 12;
    for (const star of TIAN_FU_GROUP) {
        const starIdx = ((tianFuBase + star.offset) % 12 + 12) % 12;
        palaces[starIdx].stars.push({ name: star.name, type: '主星', detail: star });
    }

    // 9. 六吉星
    // 左辅：生月数，从寅(2)顺布
    const zuofuIdx = ((2 + lunarMonth - 1) % 12 + 12) % 12;
    palaces[zuofuIdx].stars.push({ name: '左辅', type: '辅星', detail: { yinyang: '阳土', wuxing: '土' } });

    // 右弼：生月数，从戌(10)逆布
    const youbiIdx = ((10 - lunarMonth + 1) % 12 + 12) % 12;
    palaces[youbiIdx].stars.push({ name: '右弼', type: '辅星', detail: { yinyang: '阴水', wuxing: '水' } });

    // 文昌：生时数，从戌(10)逆布
    const wenchangIdx = ((10 - hourZhiIdx) % 12 + 12) % 12;
    palaces[wenchangIdx].stars.push({ name: '文昌', type: '辅星', detail: { yinyang: '阴金', wuxing: '金' } });

    // 文曲：生时数，从子(0)顺布
    const wenquIdx = ((0 + hourZhiIdx) % 12 + 12) % 12;
    palaces[wenquIdx].stars.push({ name: '文曲', type: '辅星', detail: { yinyang: '阴水', wuxing: '水' } });

    // 天魁天钺：年干决定
    const kuiIdx  = TIAN_KUI_TABLE[yearGan]  !== undefined ? TIAN_KUI_TABLE[yearGan]  : 1;
    const yueIdx  = TIAN_YUE_TABLE[yearGan]  !== undefined ? TIAN_YUE_TABLE[yearGan]  : 7;
    palaces[kuiIdx].stars.push({ name: '天魁', type: '辅星', detail: { yinyang: '阳火', wuxing: '火' } });
    palaces[yueIdx].stars.push({ name: '天钺', type: '辅星', detail: { yinyang: '阴火', wuxing: '火' } });

    // 10. 四化
    const siHua = SI_HUA_TABLE[yearGan] || {};
    // 将四化标注到对应星上
    for (const [huaName, starName] of Object.entries(siHua)) {
        for (const palace of palaces) {
            for (const star of palace.stars) {
                if (star.name === starName) {
                    star.hua = huaName;
                }
            }
        }
    }

    // 11. 命宫主星分析
    const mingPalace  = palaces[mingZhiIdx];
    const shenPalace  = palaces[shenZhiIdx];
    const mainStars   = mingPalace.stars.filter(s => s.type === '主星');
    const mingStarName = mainStars.length > 0 ? mainStars[0].name : '空宫';
    const mingInterpret = MING_GONG_INTERPRET[mingStarName] || MING_GONG_INTERPRET['空宫'];

    // 身宫主星
    const shenMainStars = shenPalace.stars.filter(s => s.type === '主星');
    const shenStarName  = shenMainStars.length > 0 ? shenMainStars[0].name : '空宫';

    // 12. 财帛宫、事业宫分析
    const caiboPalace  = palaces.find(p => p.name === '财帛');
    const shiyePalace  = palaces.find(p => p.name === '事业');
    const qianYiPalace = palaces.find(p => p.name === '迁移');

    return {
        input: { year, month, day, hour, minute, gender },
        lunar: {
            year: lunarYear, month: lunarMonth, day: lunarDay,
            yearGan, yearZhi,
            yearGanZhi,
            monthGanZhi: lunar.getMonthInGanZhi(),
            dayGanZhi:   lunar.getDayInGanZhi(),
            hourZhi:     ZHI[hourZhiIdx],
        },
        mingGong: {
            zhi:      ZHI[mingZhiIdx],
            zhiIdx:   mingZhiIdx,
            mainStar: mingStarName,
            interpret: mingInterpret,
        },
        shenGong: {
            zhi:      ZHI[shenZhiIdx],
            zhiIdx:   shenZhiIdx,
            mainStar: shenStarName,
        },
        siHua,
        palaces,
        summary: buildSummary(mingStarName, shenStarName, gender, siHua, mingInterpret),
    };
}

// ─────────────── 命盘概述生成 ───────────────
function buildSummary(mingStarName, shenStarName, gender, siHua, interpret) {
    const pronoun = gender === '女' ? '她' : '他';
    return {
        格局: `${mingStarName}坐命 · ${interpret.title}`,
        身宫: `身宫主星 ${shenStarName}，${pronoun}的精神追求与现实落地点`,
        化禄: `${siHua['化禄'] || '—'} 化禄：财运与贵人之星，逢之则兴`,
        化权: `${siHua['化权'] || '—'} 化权：权势与掌控之星，入宫则旺`,
        化科: `${siHua['化科'] || '—'} 化科：文名与贵气之星，入宫则显`,
        化忌: `${siHua['化忌'] || '—'} 化忌：阻力与暗耗之星，逢之需谨慎`,
        幸运色: interpret.lucky,
        命主五行: interpret.element,
    };
}

module.exports = { ziwei };
