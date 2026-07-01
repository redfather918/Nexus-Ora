import sys, re
sys.stdout.reconfigure(encoding='utf-8')

filepath = r'C:\Users\HUAWEI\WorkBuddy\2026-06-11-19-09-15\nexus-ora-mvp\frontend\index.html'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# --- ZH section: add before closing of zh dict ---
zh_add = """
    // Matrix section (homepage)
    matrix_badge: 'AI 原生玄学平台',
    matrix_hero_title: 'Nexus Ora · 灵境八部',
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
    matrix_cta: '开始探索你的灵境图谱', matrix_cta_hint: '输入出生信息，即刻生成你的专属人生K线',
"""

# Insert before the closing of zh dict (before cult_alert_medit_fail line)
zh_anchor = "    cult_alert_medit_fail: '加载冥想引导失败：',\n  },"
zh_new_anchor = "    cult_alert_medit_fail: '加载冥想引导失败：',\n" + zh_add.rstrip() + "\n  },"
content = content.replace(zh_anchor, zh_new_anchor)

# --- EN section: add before closing ---
en_add = """
    // Matrix section
    matrix_badge: 'AI Native Mystical Platform',
    matrix_hero_title: 'Nexus Ora \u00b7 Eight Realms',
    matrix_hero_desc: 'Eastern Mystical Wisdom <span class="text-purple-300 font-semibold">\u00d7</span> AI Tech &nbsp;\u00b7;&nbsp;BaZi Numerology <span class="text-pink-300 font-semibold">\u00d7</span> Data Visualization &nbsp;\u00b7;&nbsp;Ancient Wisdom <span class="text-amber-300 font-semibold">\u00d7</span> Modern UX',
    matrix_hero_sub: 'Reconstructing thousands of years of Eastern mysticism as interactive, visual, shareable AI-native digital products',
    matrix_card_kline_sub: 'Life K-Line', matrix_card_kline_desc: 'BaZi Chart \u00b7 Five Elements \u00b7 Life K-Line',
    matrix_tag_core: 'Core Engine', matrix_tag_6dim: '6-Dim Analysis',
    matrix_card_persona_sub: 'AI Soul Companion', matrix_card_persona_desc: 'Ten Gods \u00b7 Virtual Companion \u00b7 AI Chat',
    matrix_tag_ai: 'AI Powered', matrix_tag_emotion: 'Emotional Support',
    matrix_card_dream_sub: 'Dream Corridor', matrix_card_dream_desc: 'Dream Journal \u00b7 Zhouyi + Psychology',
    matrix_tag_dual: 'Dual Analysis', matrix_tag_trend: 'Trend Tracking',
    matrix_card_compat_sub: 'Soulmate Match', matrix_card_compat_desc: 'Synastry Chart \u00b7 5-Dim Score \u00b7 Relationship Map',
    matrix_tag_hepan: 'Synastry Algo', matrix_tag_deeprel: 'Deep Relations',
    matrix_card_divi_sub: 'Mystic Oracle', matrix_card_divi_desc: 'Tarot Spread \u00b7 Jiaobei \u00b7 Daily Fortune',
    matrix_tag_78tarot: '78 Tarot Cards', matrix_tag_100qian: '100 Fortune Slips',
    matrix_card_cult_sub: 'Daily Cultivation', matrix_card_cult_desc: 'Liao Fan Practice \u00b7 Meditation \u00b7 Energy Diary',
    matrix_tag_level: 'XP Level', matrix_tag_weekly: 'Weekly Report',
    matrix_card_market_sub: 'Spirit Market', matrix_card_market_desc: 'Digital Goods \u00b7 Crystal Shop \u00b7 Live Events',
    matrix_tag_sku: '20+ SKU', matrix_tag_wuxing: 'Wuxing Match',
    matrix_card_ziwei_sub: 'Ziwei Astrology', matrix_card_ziwei_desc: 'Zi Wei Chart \u00b7 12 Palaces \u00b7 Four Transformations',
    matrix_tag_star: 'Star Reading', matrix_tag_14star: '14 Main Stars',
    matrix_relation_title: 'Product Matrix', matrix_relation_sub: 'Data Flow \u00b7 User Journey \u00b7 Value Loop',
    matrix_adv1_title: 'AI Native', matrix_adv1_desc: 'DeepSeek AI Powered<br>Smart destiny interpretation',
    matrix_adv2_title: 'Data Visualization', matrix_adv2_desc: 'Life K-Line \u00b7 Radar Chart \u00b7 Wuxing Bars<br>Fate at a glance',
    matrix_adv3_title: 'Privacy First', matrix_adv3_desc: 'Local SQLite Storage<br>Data never leaves your device',
    matrix_adv4_title: 'Multilingual', matrix_adv4_desc: 'Chinese / English / Japanese<br>300+ translated terms',
    matrix_cta: 'Explore Your Life K-Line', matrix_cta_hint: 'Enter your birth info to generate your unique life K-Line',
"""

en_anchor = "    cult_alert_medit_fail: 'Failed to load meditation: ',\n  },"
en_new_anchor = "    cult_alert_medit_fail: 'Failed to load meditation: ',\n" + en_add.rstrip() + "\n  },"
content = content.replace(en_anchor, en_new_anchor)

# --- JA section: add before closing ---
ja_add = """
    // Matrix section
    matrix_badge: 'AIネイティブ玄学プラットフォーム',
    matrix_hero_title: 'Nexus Ora \u00b7 霊境八部',
    matrix_hero_desc: '東洋玄学の智慧 <span class="text-purple-300 font-semibold">\u00d7</span> AIテクノロジー &nbsp;\u00b7;&nbsp;八字命理 <span class="text-pink-300 font-semibold">\u00d7</span> データ可視化 &nbsp;\u00b7;&nbsp;古代の智慧 <span class="text-amber-300 font-semibold">\u00d7</span> モダンUX',
    matrix_hero_sub: '千年の東洋玄学体系を、インタラクティブで可視化・シェア可能なAIネイティブデジタルプロダクトに再構築',
    matrix_card_kline_sub: 'Life K-Line', matrix_card_kline_desc: '八字排盤 \u00b7 五行分析 \u00b7 人生Kライン',
    matrix_tag_core: 'コアエンジン', matrix_tag_6dim: '6次元解析',
    matrix_card_persona_sub: 'AIソウルコンパニオン', matrix_card_persona_desc: '十神生成 \u00b7 バーチャルコンパニオン \u00b7 AI対話',
    matrix_tag_ai: 'AI搭載', matrix_tag_emotion: '感情サポート',
    matrix_card_dream_sub: 'Dream Corridor', matrix_card_dream_desc: '夢の記録 \u00b7 周公+心理学デュアル解析',
    matrix_tag_dual: 'デュアル解析', matrix_tag_trend: 'トレース追跡',
    matrix_card_compat_sub: 'Soulmate Match', matrix_card_compat_desc: '双人合盤 \u00b7 5次元スコア \u00b7 関係マップ',
    matrix_tag_hepan: '合盤アルゴ', matrix_tag_deeprel: 'ディープリレーション',
    matrix_card_divi_sub: 'Mystic Oracle', matrix_card_divi_desc: 'タロットスプレッド \u00b7 杯筊 \u00b7 毎日おみくじ',
    matrix_tag_78tarot: '78枚タロット', matrix_tag_100qian: '100本のおみくじ',
    matrix_card_cult_sub: 'Daily Cultivation', matrix_card_cult_desc: '了凡打卡 \u00b7 瞑想ガイド \u00b7 エネルギー日記',
    matrix_tag_level: '修行レベル', matrix_tag_weekly: '週次レポート',
    matrix_card_market_sub: 'Spirit Market', matrix_card_market_desc: 'デジタルグッズ \u00b7 クリスタルショップ \u00b7 オフラインイベント',
    matrix_tag_sku: '20+ SKU', matrix_tag_wuxing: '五行マッチ',
    matrix_card_ziwei_sub: 'Ziwei Astrology', matrix_card_ziwei_desc: '紫微排盤 \u00b7 十二宮 \u00b7 四化飛星',
    matrix_tag_star: '星盤リーディング', matrix_tag_14star: '14主星',
    matrix_relation_title: 'プロダクトマトリックス', matrix_relation_sub: 'データフロー \u00b7 ユーザー旅程 \u00b7 価値ループ',
    matrix_adv1_title: 'AIネイティブ', matrix_adv1_desc: 'DeepSeek AI搭載<br>知命盤をスマートに解読',
    matrix_adv2_title: 'データ可視化', matrix_adv2_desc: '人生Kライン \u00b7 レーダーチャート \u00b7 五行バー<br>運命を一目で把握',
    matrix_adv3_title: 'プライバシー保護', matrix_adv3_desc: 'ローカル SQLite保存<br>データはデバイス外に出ない',
    matrix_adv4_title: '多言語対応', matrix_adv4_desc: '中/英/日 3言語切替<br>300+ 翻訳語句',
    matrix_cta: '人生Kラインを探索する', matrix_cta_hint: '生年月日を入力して、あなただけの人生Kラインを生成',
"""

ja_anchor = "    cult_alert_medit_fail: '\u7791\u60f3\u30ac\u30a4\u30c9\u306e\u8aad\u307f\u8fbc\u307f\u306b\u5931\u6557\uff1a',\n  },"
ja_new_anchor = "    cult_alert_medit_fail: '\u7791\u60f3\u30ac\u30a4\u30c9\u306e\u8aad\u307f\u8fbc\u307f\u306b\u5931\u6557\uff1a',\n" + ja_add.rstrip() + "\n  },"
content = content.replace(ja_anchor, ja_new_anchor)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

# Verify
with open(filepath, 'r', encoding='utf-8') as f:
    content2 = f.read()

zh_ok = 'matrix_badge' in content2 and content2.count('matrix_badge') == 3
print(f'I18N entries added. All 3 langs have matrix keys: {zh_ok}')
print(f'ZH entries: {content2.count("matrix_") // 3} per language')
