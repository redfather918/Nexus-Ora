import sys
sys.stdout.reconfigure(encoding='utf-8')

filepath = r'C:\Users\HUAWEI\WorkBuddy\2026-06-11-19-09-15\nexus-ora-mvp\frontend\index.html'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

zh_add = """
    // Matrix section (homepage)
    matrix_badge: 'AI 原生玄学平台',
    matrix_hero_title: 'Nexus Ora \u00b7 灵境八部',
    matrix_hero_desc: '东方玄学智慧 <span class="text-purple-300 font-semibold">\u00d7</span> AI 科技 &nbsp;\u00b7;&nbsp;八字命理 <span class="text-pink-300 font-semibold">\u00d7</span> 数据可视化 &nbsp;\u00b7;&nbsp;古老智慧 <span class="text-amber-300 font-semibold">\u00d7</span> 现代交互',
    matrix_hero_sub: '将千年东方玄学体系重构为可交互、可视化、可分享的 AI 原生数字产品',
    matrix_card_kline_sub: 'Life K-Line', matrix_card_kline_desc: '八字排盘 \u00b7 五行分析 \u00b7 人生K线图',
    matrix_tag_core: '核心引擎', matrix_tag_6dim: '六维解读',
    matrix_card_persona_sub: 'AI Soul Companion', matrix_card_persona_desc: '十神生成 \u00b7 虚拟伴侣 \u00b7 AI 对话',
    matrix_tag_ai: 'AI驱动', matrix_tag_emotion: '情绪支持',
    matrix_card_dream_sub: 'Dream Corridor', matrix_card_dream_desc: '梦境记录 \u00b7 周公+心理学双维解析',
    matrix_tag_dual: '双维解读', matrix_tag_trend: '趋势追踪',
    matrix_card_compat_sub: 'Soulmate Match', matrix_card_compat_desc: '双人合盘 \u00b7 五维评分 \u00b7 关系图谱',
    matrix_tag_hepan: '合盘算法', matrix_tag_deeprel: '深度关系',
    matrix_card_divi_sub: 'Mystic Oracle', matrix_card_divi_desc: '塔罗牌阵 \u00b7 摇杯筊 \u00b7 每日一签',
    matrix_tag_78tarot: '78张塔罗', matrix_tag_100qian: '100支灵签',
    matrix_card_cult_sub: 'Daily Cultivation', matrix_card_cult_desc: '了凡打卡 \u00b7 冥想引导 \u00b7 能量日记',
    matrix_tag_level: '修行等级', matrix_tag_weekly: '周报分析',
    matrix_card_market_sub: 'Spirit Market', matrix_card_market_desc: '数字周边 \u00b7 水晶商城 \u00b7 线下活动',
    matrix_tag_sku: '20+ SKU', matrix_tag_wuxing: '五行适配',
    matrix_card_ziwei_sub: 'Ziwei Astrology', matrix_card_ziwei_desc: '紫微排盘 \u00b7 十二宫 \u00b7 四化飞星',
    matrix_tag_star: '星盘解读', matrix_tag_14star: '14主星',
    matrix_relation_title: '产品矩阵关系图', matrix_relation_sub: '数据流转 \u00b7 用户路径 \u00b7 价值闭环',
    matrix_adv1_title: 'AI 原生驱动', matrix_adv1_desc: 'DeepSeek AI 加持<br>智能解读命盘玄机',
    matrix_adv2_title: '数据可视化', matrix_adv2_desc: '人生K线 \u00b7 雷达图 \u00b7 五行柱<br>命运一目了然',
    matrix_adv3_title: '隐私安全', matrix_adv3_desc: '本地 SQLite 存储<br>数据不出设备',
    matrix_adv4_title: '多语言支持', matrix_adv4_desc: '中/英/日三语切换<br>300+ 翻译词条',
    matrix_cta: '开始探索你的灵境图谱', matrix_cta_hint: '输入出生信息，即刻生成你的专属人生K线',"""

# ZH: insert before the closing }, of zh dict
zh_anchor = "    cult_alert_updated: '\u5df2\u66f4\u65b0\u4eca\u65e5\u65e5\u8bb0', cult_alert_saved: '\u5df2\u4fdd\u5b58\u4eca\u65e5\u65e5\u8bb0', cult_alert_medit_fail: '\u52a0\u8f7d\u51a5\u60f3\u5f15\u5bfc\u5931\u8d25\uff1a',\n  },\n"
zh_new = "    cult_alert_updated: '\u5df2\u66f4\u65b0\u4eca\u65e5\u65e5\u8bb0', cult_alert_saved: '\u5df2\u4fdd\u5b58\u4eca\u65e5\u65e5\u8bb0', cult_alert_medit_fail: '\u52a0\u8f7d\u51a5\u60f3\u5f15\u5bfc\u5931\u8d25\uff1a',\n" + zh_add + "\n  },\n"
assert zh_anchor in content, 'ZH anchor not found!'
content = content.replace(zh_anchor, zh_new, 1)

# EN
en_add = """
    // Matrix section
    matrix_badge: 'AI Native Mystical Platform',
    matrix_hero_title: 'Nexus Ora \u00b7 Eight Realms',
    matrix_hero_desc: 'Eastern Wisdom <span class="text-purple-300 font-semibold">\u00d7</span> AI Tech &nbsp;\u00b7;&nbsp;BaZi <span class="text-pink-300 font-semibold">\u00d7</span> Data Viz &nbsp;\u00b7;&nbsp;Ancient <span class="text-amber-300 font-semibold">\u00d7</span> Modern UX',
    matrix_hero_sub: 'Rebuilding millennia of Eastern mysticism as interactive, visual, shareable AI-native products',
    matrix_card_kline_sub: 'Life K-Line', matrix_card_kline_desc: 'BaZi Chart \u00b7 Five Elements \u00b7 Life K-Line',
    matrix_tag_core: 'Core Engine', matrix_tag_6dim: '6-Dim Analysis',
    matrix_card_persona_sub: 'AI Soul Companion', matrix_card_persona_desc: 'Ten Gods \u00b7 Virtual Companion \u00b7 AI Chat',
    matrix_tag_ai: 'AI Powered', matrix_tag_emotion: 'Emotional Support',
    matrix_card_dream_sub: 'Dream Corridor', matrix_card_dream_desc: 'Dream Journal \u00b7 Zhouyi + Psychology',
    matrix_tag_dual: 'Dual Analysis', matrix_tag_trend: 'Trend Tracking',
    matrix_card_compat_sub: 'Soulmate Match', matrix_card_compat_desc: 'Synastry \u00b7 5-Dim Score \u00b7 Relationship Map',
    matrix_tag_hepan: 'Synastry Algo', matrix_tag_deeprel: 'Deep Relations',
    matrix_card_divi_sub: 'Mystic Oracle', matrix_card_divi_desc: 'Tarot \u00b7 Jiaobei \u00b7 Daily Fortune',
    matrix_tag_78tarot: '78 Tarot Cards', matrix_tag_100qian: '100 Fortune Slips',
    matrix_card_cult_sub: 'Daily Cultivation', matrix_card_cult_desc: 'Liao Fan \u00b7 Meditation \u00b7 Energy Diary',
    matrix_tag_level: 'XP Level', matrix_tag_weekly: 'Weekly Report',
    matrix_card_market_sub: 'Spirit Market', matrix_card_market_desc: 'Digital Goods \u00b7 Crystal Shop \u00b7 Events',
    matrix_tag_sku: '20+ SKU', matrix_tag_wuxing: 'Wuxing Match',
    matrix_card_ziwei_sub: 'Ziwei Astrology', matrix_card_ziwei_desc: 'Zi Wei Chart \u00b7 12 Palaces \u00b7 4 Transformations',
    matrix_tag_star: 'Star Reading', matrix_tag_14star: '14 Main Stars',
    matrix_relation_title: 'Product Matrix', matrix_relation_sub: 'Data Flow \u00b7 User Journey \u00b7 Value Loop',
    matrix_adv1_title: 'AI Native', matrix_adv1_desc: 'DeepSeek AI Powered<br>Smart destiny解读',
    matrix_adv2_title: 'Data Visualization', matrix_adv2_desc: 'Life K-Line \u00b7 Radar \u00b7 Wuxing Bars<br>Fate at a glance',
    matrix_adv3_title: 'Privacy First', matrix_adv3_desc: 'Local SQLite Storage<br>Data stays on device',
    matrix_adv4_title: 'Multilingual', matrix_adv4_desc: 'ZH / EN / JA<br>300+ translated terms',
    matrix_cta: 'Explore Your Life K-Line', matrix_cta_hint: 'Enter birth info to generate your unique K-Line',"""

en_anchor = "    cult_alert_updated: 'Diary updated', cult_alert_saved: 'Diary saved', cult_alert_medit_fail: 'Failed to load meditation: ',\n  },\n"
en_new = "    cult_alert_updated: 'Diary updated', cult_alert_saved: 'Diary saved', cult_alert_medit_fail: 'Failed to load meditation: ',\n" + en_add + "\n  },\n"
assert en_anchor in content, 'EN anchor not found!'
content = content.replace(en_anchor, en_new, 1)

# JA
ja_add = """
    // Matrix section
    matrix_badge: 'AI\u30cd\u30a4\u30c6\u30a3\u30d6\u7384\u5b66\u30d7\u30e9\u30c3\u30c8\u30d5\u30a9\u30fc\u30e0',
    matrix_hero_title: 'Nexus Ora \u00b7 \u970a\u5883\u516b\u90e8',
    matrix_hero_desc: '\u6771\u6d0b\u7384\u5b66\u306e\u667a\u6167 <span class="text-purple-300 font-semibold">\u00d7</span> AI\u30c6\u30af\u30ce\u30ed\u30b8\u30fc &nbsp;\u00b7;&nbsp;\u516b\u5b57\u547d\u7406 <span class="text-pink-300 font-semibold">\u00d7</span> \u30c7\u30fc\u30bf\u53ef\u8996\u5316 &nbsp;\u00b7;&nbsp;\u53e4\u4ee3\u306e\u667a\u6167 <span class="text-amber-300 font-semibold">\u00d7</span> \u30e2\u30c0\u30f3UX',
    matrix_hero_sub: '\u5343\u5e74\u306e\u6771\u6d0b\u7384\u5b66\u3092\u3001\u30a4\u30f3\u30bf\u30e9\u30af\u30c6\u30a3\u30d6\u3067\u53ef\u8996\u5316\u30fb\u30b7\u30a7\u30a2\u53ef\u80fd\u306aAI\u30cd\u30a4\u30c6\u30a3\u30d6\u30c7\u30b8\u30bf\u30eb\u30d7\u30ed\u30c0\u30af\u30c8\u306b\u518d\u69cb\u7bc9',
    matrix_card_kline_sub: 'Life K-Line', matrix_card_kline_desc: '\u516b\u5b57\u6392\u76e4 \u00b7 \u4e94\u884c\u5206\u6790 \u00b7 \u4eba\u751fK\u30e9\u30a4\u30f3',
    matrix_tag_core: '\u30b3\u30a2\u30a8\u30f3\u30b8\u30f3', matrix_tag_6dim: '6\u6b21\u5143\u89e3\u6790',
    matrix_card_persona_sub: 'AI\u30bd\u30a6\u30eb\u30b3\u30f3\u30d1\u30cb\u30aa\u30f3', matrix_card_persona_desc: '\u5341\u795e\u751f\u6210 \u00b7 \u30d0\u30fc\u30c1\u30e3\u30eb\u30b3\u30f3\u30d1\u30cb\u30aa\u30f3 \u00b7 AI\u5bfe\u8a71',
    matrix_tag_ai: 'AI\u642d\u8f09', matrix_tag_emotion: '\u611f\u60c5\u30b5\u30dd\u30fc\u30c8',
    matrix_card_dream_sub: 'Dream Corridor', matrix_card_dream_desc: '\u5922\u306e\u8a18\u9332 \u00b7 \u5468\u516c+\u5fc3\u7406\u5b66\u30c7\u30e5\u30a2\u30eb\u89e3\u6790',
    matrix_tag_dual: '\u30c7\u30e5\u30a2\u30eb\u89e3\u6790', matrix_tag_trend: '\u30c8\u30ec\u30f3\u30c9\u8ffd\u8de1',
    matrix_card_compat_sub: 'Soulmate Match', matrix_card_compat_desc: '\u53cc\u4eba\u5408\u76e4 \u00b7 5\u6b21\u5143\u30b9\u30b3\u30a2 \u00b7 \u95a2\u4fc2\u30de\u30c3\u30d7',
    matrix_tag_hepan: '\u5408\u76e4\u30a2\u30eb\u30b4', matrix_tag_deeprel: '\u30c7\u30a3\u30fc\u30d7\u30ea\u30ec\u30fc\u30b7\u30e7\u30f3',
    matrix_card_divi_sub: 'Mystic Oracle', matrix_card_divi_desc: '\u30bf\u30ed\u30c3\u30c8 \u00b7 \u676f\u7b4a \u00b7 \u6bce\u65e5\u304a\u307f\u304f\u3058',
    matrix_tag_78tarot: '78\u679a\u30bf\u30ed\u30c3\u30c8', matrix_tag_100qian: '100\u672c\u304a\u307f\u304f\u3058',
    matrix_card_cult_sub: 'Daily Cultivation', matrix_card_cult_desc: '\u4e86\u51e1\u6253\u30ab \u00b7 \u7791\u60f3\u30ac\u30a4\u30c9 \u00b7 \u30a8\u30cd\u30eb\u30ae\u30fc\u65e5\u8a18',
    matrix_tag_level: '\u4fee\u884c\u30ec\u30d9\u30eb', matrix_tag_weekly: '\u9031\u6b21\u30ec\u30dd\u30fc\u30c8',
    matrix_card_market_sub: 'Spirit Market', matrix_card_market_desc: '\u30c7\u30b8\u30bf\u30eb\u30b0\u30c3\u30ba \u00b7 \u30af\u30ea\u30b9\u30bf\u30eb\u30b7\u30e7\u30c3\u30d7 \u00b7 \u30a4\u30d9\u30f3\u30c8',
    matrix_tag_sku: '20+ SKU', matrix_tag_wuxing: '\u4e94\u884c\u30de\u30c3\u30c1',
    matrix_card_ziwei_sub: 'Ziwei Astrology', matrix_card_ziwei_desc: '\u7d2b\u5fae\u6392\u76e4 \u00b7 \u5341\u4e8c\u5bae \u00b7 \u56db\u5316\u98db\u661f',
    matrix_tag_star: '\u661f\u76e4\u30ea\u30fc\u30c7\u30a3\u30f3\u30b0', matrix_tag_14star: '14\u4e3b\u661f',
    matrix_relation_title: '\u30d7\u30ed\u30c0\u30af\u30c8\u30de\u30c8\u30ea\u30c3\u30af\u30b9', matrix_relation_sub: '\u30c7\u30fc\u30bf\u30d5\u30ed\u30fc \u00b7 \u30e6\u30fc\u30b6\u30fc\u65c5\u7a0b \u00b7 \u4fa1\u5024\u30eb\u30fc\u30d7',
    matrix_adv1_title: 'AI\u30cd\u30a4\u30c6\u30a3\u30d6', matrix_adv1_desc: 'DeepSeek AI\u642d\u8f09<br>\u547d\u76e4\u3092\u30b9\u30de\u30fc\u30c8\u306b\u89e3\u8aad',
    matrix_adv2_title: '\u30c7\u30fc\u30bf\u53ef\u8996\u5316', matrix_adv2_desc: '\u4eba\u751fK\u30e9\u30a4\u30f3 \u00b7 \u30ec\u30fc\u30c0\u30fc \u00b7 \u4e94\u884c\u30d0\u30fc<br>\u904b\u547d\u3092\u4e00\u76ee\u3067\u628a\u63e1',
    matrix_adv3_title: '\u30d7\u30e9\u30a4\u30d0\u30b7\u30fc\u4fdd\u8b77', matrix_adv3_desc: '\u30ed\u30fc\u30ab\u30eb SQLite\u4fdd\u5b58<br>\u30c7\u30fc\u30bf\u306f\u30c7\u30d0\u30a4\u30b9\u5916\u306b\u51fa\u306a\u3044',
    matrix_adv4_title: '\u591a\u8a00\u8a9e\u5bfe\u5fdc', matrix_adv4_desc: '\u4e2d/\u82f1/\u65e5 3\u8a00\u8a9e\u5207\u66ff<br>300+ \u7ffb\u8a33\u8a9e\u53e5',
    matrix_cta: '\u4eba\u751fK\u30e9\u30a4\u30f3\u3092\u63a2\u7d22\u3059\u308b', matrix_cta_hint: '\u751f\u5e74\u6708\u65e5\u3092\u5165\u529b\u3057\u3066\u3001\u3042\u306a\u305f\u3060\u3051\u306e\u4eba\u751fK\u30e9\u30a4\u30f3\u3092\u751f\u6210',"""

ja_anchor = "    cult_alert_updated: '\u65e5\u8a18\u3092\u66f4\u65b0\u3057\u307e\u3057\u305f', cult_alert_saved: '\u65e5\u8a18\u3092\u4fdd\u5b58\u3057\u307e\u3057\u305f', cult_alert_medit_fail: '\u7791\u60f3\u30ac\u30a4\u30c9\u306e\u8aad\u307f\u8fbc\u307f\u306b\u5931\u6557\uff1a',\n  }\n};\n"
ja_new = "    cult_alert_updated: '\u65e5\u8a18\u3092\u66f4\u65b0\u3057\u307e\u3057\u305f', cult_alert_saved: '\u65e5\u8a18\u3092\u4fdd\u5b58\u3057\u307e\u3057\u305f', cult_alert_medit_fail: '\u7791\u60f3\u30ac\u30a4\u30c9\u306e\u8aad\u307f\u8fbc\u307f\u306b\u5931\u6557\uff1a',\n" + ja_add + "\n  }\n};\n"
assert ja_anchor in content, 'JA anchor not found!'
content = content.replace(ja_anchor, ja_new, 1)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

# Verify
count = content.count('matrix_badge')
print(f'Done! matrix_badge appears {count} times (expect 3: zh+en+ja)')
print(f'Total matrix_ references: {content.count("matrix_")}')
