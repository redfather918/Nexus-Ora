/**
 * Nexus Ora - 纯 JavaScript 八字排盘引擎
 * 使用 lunar-typescript 替代 Python child_process 调用
 */

const { Solar } = require('lunar-typescript');

// 五行对照表
const WUXING_MAP = {
    '甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土',
    '庚':'金','辛':'金','壬':'水','癸':'水',
    '子':'水','丑':'土','寅':'木','卯':'木','辰':'土','巳':'火',
    '午':'火','未':'土','申':'金','酉':'金','戌':'土','亥':'水'
};

// 十神对照表（以日干为基准）
const SHISHEN_MAP = {
    '甲':{'甲':'比肩','乙':'劫财','丙':'食神','丁':'伤官','戊':'偏财','己':'正财','庚':'七杀','辛':'正官','壬':'偏印','癸':'正印'},
    '乙':{'甲':'劫财','乙':'比肩','丙':'伤官','丁':'食神','戊':'正财','己':'偏财','庚':'正官','辛':'七杀','壬':'正印','癸':'偏印'},
    '丙':{'甲':'偏印','乙':'正印','丙':'比肩','丁':'劫财','戊':'食神','己':'伤官','庚':'偏财','辛':'正财','壬':'七杀','癸':'正官'},
    '丁':{'甲':'正印','乙':'偏印','丙':'劫财','丁':'比肩','戊':'伤官','己':'食神','庚':'正财','辛':'偏财','壬':'正官','癸':'七杀'},
    '戊':{'甲':'七杀','乙':'正官','丙':'偏印','丁':'正印','戊':'比肩','己':'劫财','庚':'食神','辛':'伤官','壬':'偏财','癸':'正财'},
    '己':{'甲':'正官','乙':'七杀','丙':'正印','丁':'偏印','戊':'劫财','己':'比肩','庚':'伤官','辛':'食神','壬':'正财','癸':'偏财'},
    '庚':{'甲':'偏财','乙':'正财','丙':'七杀','丁':'正官','戊':'偏印','己':'正印','庚':'比肩','辛':'劫财','壬':'食神','癸':'伤官'},
    '辛':{'甲':'正财','乙':'偏财','丙':'正官','丁':'七杀','戊':'正印','己':'偏印','庚':'劫财','辛':'比肩','壬':'伤官','癸':'食神'},
    '壬':{'甲':'食神','乙':'伤官','丙':'偏财','丁':'正财','戊':'七杀','己':'正官','庚':'偏印','辛':'正印','壬':'比肩','癸':'劫财'},
    '癸':{'甲':'伤官','乙':'食神','丙':'正财','丁':'偏财','戊':'正官','己':'七杀','庚':'正印','辛':'偏印','壬':'劫财','癸':'比肩'}
};

function getWuxing(ganOrZhi) {
    return WUXING_MAP[ganOrZhi] || '未知';
}

function getShishen(dayGan, targetGan) {
    return (SHISHEN_MAP[dayGan] || {})[targetGan] || '未知';
}

/**
 * 主排盘函数
 * @param {Object} input - { year, month, day, hour, minute, gender }
 * @returns {Object} 排盘结果
 */
function paipan(input) {
    const year   = parseInt(input.year);
    const month  = parseInt(input.month);
    const day    = parseInt(input.day);
    const hour   = parseInt(input.hour || 12);
    const minute = parseInt(input.minute || 0);

    const solar = Solar.fromYmdHms(year, month, day, hour, minute, 0);
    const lunar = solar.getLunar();

    const yearPillar  = lunar.getYearInGanZhi();
    const monthPillar = lunar.getMonthInGanZhi();
    const dayPillar   = lunar.getDayInGanZhi();
    const hourPillar  = lunar.getTimeInGanZhi();

    const dayGan = dayPillar.length >= 2 ? dayPillar[0] : '';

    // 解析各柱
    const pillars = [];
    const pillarDefs = [
        ['年柱', yearPillar],
        ['月柱', monthPillar],
        ['日柱', dayPillar],
        ['时柱', hourPillar]
    ];

    for (const [name, pillar] of pillarDefs) {
        const gan = pillar.length >= 2 ? pillar[0] : '';
        const zhi = pillar.length >= 2 ? pillar[1] : '';
        pillars.push({
            name,
            ganzhi: pillar,
            gan,
            zhi,
            gan_wuxing: getWuxing(gan),
            zhi_wuxing: getWuxing(zhi),
            shishen: name !== '日柱' ? getShishen(dayGan, gan) : '日元'
        });
    }

    // 五行分布统计（固定五行顺序，缺失补 0）
    const wuxingCount = { '金': 0, '木': 0, '水': 0, '火': 0, '土': 0 };
    for (const p of pillars) {
        if (p.gan_wuxing in wuxingCount) wuxingCount[p.gan_wuxing] += 1;
        if (p.zhi_wuxing in wuxingCount) wuxingCount[p.zhi_wuxing] += 1;
    }

    // 日干五行 → 身强身弱判断
    const dayWuxing = getWuxing(dayGan);
    const dayWuxingCount = wuxingCount[dayWuxing] || 0;

    let bodyStrength, strengthScore;
    if (dayWuxingCount >= 3) {
        bodyStrength = '身强';
        strengthScore = 75;
    } else if (dayWuxingCount === 2) {
        bodyStrength = '中和';
        strengthScore = 50;
    } else {
        bodyStrength = '身弱';
        strengthScore = 35;
    }

    const gender = input.gender || '未知';

    return {
        success: true,
        bazi: {
            year: yearPillar,
            month: monthPillar,
            day: dayPillar,
            hour: hourPillar,
            day_gan: dayGan,
            day_wuxing: dayWuxing,
            body_strength: bodyStrength,
            strength_score: strengthScore
        },
        pillars,
        wuxing_balance: wuxingCount,
        info: {
            animal: lunar.getYearShengXiao(),
            zodiac: solar.getXingZuo(),
            lunar_date: `${lunar.getYear()}年${lunar.getMonth()}月${lunar.getDay()}日`,
            birth_date: `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`,
            gender
        }
    };
}

module.exports = { paipan, getWuxing, getShishen };
