import sys, re
sys.stdout.reconfigure(encoding='utf-8')

filepath = r'C:\Users\HUAWEI\WorkBuddy\2026-06-11-19-09-15\nexus-ora-mvp\frontend\index.html'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

replacements = [
    # Card 2 (persona)
    ('<h3 class="font-bold text-base">灵境人格</h3>',
     '<h3 class="font-bold text-base" data-i18n="tab_persona">灵境人格</h3>'),
    ('<span class="text-xs text-pink-400/80">AI Soul Companion</span>',
     '<span class="text-xs text-pink-400/80" data-i18n="matrix_card_persona_sub">AI Soul Companion</span>'),
    ('<p class="text-sm text-gray-400 leading-relaxed mb-3">十神生成 · 虚拟伴侣 · AI 对话</p>',
     '<p class="text-sm text-gray-400 leading-relaxed mb-3" data-i18n="matrix_card_persona_desc">十神生成 · 虚拟伴侣 · AI 对话</p>'),
    ('<span class="matrix-tag tag-purple">AI驱动</span>',
     '<span class="matrix-tag tag-purple" data-i18n="matrix_tag_ai">AI驱动</span>'),
    ('<span class="matrix-tag">情绪支持</span>',
     '<span class="matrix-tag" data-i18n="matrix_tag_emotion">情绪支持</span>'),

    # Card 3 (dream)
    ('<h3 class="font-bold text-base">梦境回廊</h3>',
     '<h3 class="font-bold text-base" data-i18n="tab_dream">梦境回廊</h3>'),
    ('<span class="text-xs text-indigo-400/80">Dream Corridor</span>',
     '<span class="text-xs text-indigo-400/80" data-i18n="matrix_card_dream_sub">Dream Corridor</span>'),
    ('<p class="text-sm text-gray-400 leading-relaxed mb-3">梦境记录 · 周公+心理学双维解析</p>',
     '<p class="text-sm text-gray-400 leading-relaxed mb-3" data-i18n="matrix_card_dream_desc">梦境记录 · 周公+心理学双维解析</p>'),
    ('<span class="matrix-tag tag-purple">双维解读</span>',
     '<span class="matrix-tag tag-purple" data-i18n="matrix_tag_dual">双维解读</span>'),
    ('<span class="matrix-tag">趋势追踪</span>',
     '<span class="matrix-tag" data-i18n="matrix_tag_trend">趋势追踪</span>'),

    # Card 4 (compat)
    ('<h3 class="font-bold text-base">缘分配对</h3>',
     '<h3 class="font-bold text-base" data-i18n="tab_compat">缘分配对</h3>'),
    ('<span class="text-xs text-pink-300/80">Soulmate Match</span>',
     '<span class="text-xs text-pink-300/80" data-i18n="matrix_card_compat_sub">Soulmate Match</span>'),
    ('<p class="text-sm text-gray-400 leading-relaxed mb-3">双人合盘 · 五维评分 · 关系图谱</p>',
     '<p class="text-sm text-gray-400 leading-relaxed mb-3" data-i18n="matrix_card_compat_desc">双人合盘 · 五维评分 · 关系图谱</p>'),
    ('<span class="matrix-tag tag-purple">合盘算法</span>',
     '<span class="matrix-tag tag-purple" data-i18n="matrix_tag_hepan">合盘算法</span>'),
    ('<span class="matrix-tag">深度关系</span>',
     '<span class="matrix-tag" data-i18n="matrix_tag_deeprel">深度关系</span>'),

    # Card 5 (divination)
    ('<h3 class="font-bold text-base">灵境占卜</h3>',
     '<h3 class="font-bold text-base" data-i18n="tab_divination">灵境占卜</h3>'),
    ('<span class="text-xs text-amber-400/80">Mystic Oracle</span>',
     '<span class="text-xs text-amber-400/80" data-i18n="matrix_card_divi_sub">Mystic Oracle</span>'),
    ('<p class="text-sm text-gray-400 leading-relaxed mb-3">塔罗牌阵 · 摇杯筊 · 每日一签</p>',
     '<p class="text-sm text-gray-400 leading-relaxed mb-3" data-i18n="matrix_card_divi_desc">塔罗牌阵 · 摇杯筊 · 每日一签</p>'),
    ('<span class="matrix-tag tag-amber">78张塔罗</span>',
     '<span class="matrix-tag tag-amber" data-i18n="matrix_tag_78tarot">78张塔罗</span>'),
    ('<span class="matrix-tag">100支灵签</span>',
     '<span class="matrix-tag" data-i18n="matrix_tag_100qian">100支灵签</span>'),

    # Card 6 (cultivation)
    ('<h3 class="font-bold text-base">灵境修行</h3>',
     '<h3 class="font-bold text-base" data-i18n="tab_cultivation">灵境修行</h3>'),
    ('<span class="text-xs text-green-400/80">Daily Cultivation</span>',
     '<span class="text-xs text-green-400/80" data-i18n="matrix_card_cult_sub">Daily Cultivation</span>'),
    ('<p class="text-sm text-gray-400 leading-relaxed mb-3">了凡打卡 · 冥想引导 · 能量日记</p>',
     '<p class="text-sm text-gray-400 leading-relaxed mb-3" data-i18n="matrix_card_cult_desc">了凡打卡 · 冥想引导 · 能量日记</p>'),
    ('<span class="matrix-tag tag-green">修行等级</span>',
     '<span class="matrix-tag tag-green" data-i18n="matrix_tag_level">修行等级</span>'),
    ('<span class="matrix-tag">周报分析</span>',
     '<span class="matrix-tag" data-i18n="matrix_tag_weekly">周报分析</span>'),

    # Card 7 (market)
    ('<h3 class="font-bold text-base">灵境市集</h3>',
     '<h3 class="font-bold text-base" data-i18n="tab_market">灵境市集</h3>'),
    ('<span class="text-xs text-cyan-400/80">Spirit Market</span>',
     '<span class="text-xs text-cyan-400/80" data-i18n="matrix_card_market_sub">Spirit Market</span>'),
    ('<p class="text-sm text-gray-400 leading-relaxed mb-3">数字周边 · 水晶商城 · 线下活动</p>',
     '<p class="text-sm text-gray-400 leading-relaxed mb-3" data-i18n="matrix_card_market_desc">数字周边 · 水晶商城 · 线下活动</p>'),
    ('<span class="matrix-tag">20+ SKU</span>',
     '<span class="matrix-tag" data-i18n="matrix_tag_sku">20+ SKU</span>'),
    ('<span class="matrix-tag tag-purple">五行适配</span>',
     '<span class="matrix-tag tag-purple" data-i18n="matrix_tag_wuxing">五行适配</span>'),

    # Card 8 (ziwei)
    ('<h3 class="font-bold text-base">紫微斗数</h3>',
     '<h3 class="font-bold text-base" data-i18n="tab_ziwei">紫微斗数</h3>'),
    ('<span class="text-xs text-yellow-400/80">Ziwei Astrology</span>',
     '<span class="text-xs text-yellow-400/80" data-i18n="matrix_card_ziwei_sub">Ziwei Astrology</span>'),
    ('<p class="text-sm text-gray-400 leading-relaxed mb-3">紫微排盘 · 十二宫 · 四化飞星</p>',
     '<p class="text-sm text-gray-400 leading-relaxed mb-3" data-i18n="matrix_card_ziwei_desc">紫微排盘 · 十二宫 · 四化飞星</p>'),
    ('<span class="matrix-tag tag-purple">星盘解读</span>',
     '<span class="matrix-tag tag-purple" data-i18n="matrix_tag_star">星盘解读</span>'),
    ('<span class="matrix-tag">14主星</span>',
     '<span class="matrix-tag" data-i18n="matrix_tag_14star">14主星</span>'),

    # Relation SVG title/subtitle
    ('<span class="bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">产品矩阵关系图</span>',
     '<span class="bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent" data-i18n="matrix_relation_title">产品矩阵关系图</span>'),
    ('<p class="text-sm text-gray-500 text-center mb-6">数据流转 · 用户路径 · 价值闭环</p>',
     '<p class="text-sm text-gray-500 text-center mb-6" data-i18n="matrix_relation_sub">数据流转 · 用户路径 · 价值闭环</p>'),

    # CTA
    ('开始探索你的灵境图谱',
     '<span data-i18n="matrix_cta">开始探索你的灵境图谱</span>'),
    ('<p class="text-xs text-gray-600 mt-3">输入出生信息，即刻生成你的专属人生K线</p>',
     '<p class="text-xs text-gray-600 mt-3" data-i18n="matrix_cta_hint">输入出生信息，即刻生成你的专属人生K线</p>'),
]

count = 0
for old, new in replacements:
    if old in content:
        content = content.replace(old, new, 1)
        count += 1
    else:
        print(f'WARN: not found: {old[:60]}')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print(f'OK: {count}/{len(replacements)} replacements done')
