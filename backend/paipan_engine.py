#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Nexus Ora - 八字排盘引擎
通过命令行调用，接收JSON输入，输出JSON结果
用法: python paipan_engine.py '{"year":1990,"month":6,"day":15,"hour":14,"minute":30}'
"""

import sys
import json
from lunar_python import Solar

# 五行对照表
WUXING_MAP = {
    '甲': '木', '乙': '木',
    '丙': '火', '丁': '火',  
    '戊': '土', '己': '土',
    '庚': '金', '辛': '金',
    '壬': '水', '癸': '水',
    '子': '水', '丑': '土',
    '寅': '木', '卯': '木',
    '辰': '土', '巳': '火',
    '午': '火', '未': '土',
    '申': '金', '酉': '金',
    '戌': '土', '亥': '水'
}

# 十神对照表 (以日干为基准)
SHISHEN_MAP = {
    '甲': {'甲': '比肩', '乙': '劫财', '丙': '食神', '丁': '伤官', '戊': '偏财', '己': '正财', '庚': '七杀', '辛': '正官', '壬': '偏印', '癸': '正印'},
    '乙': {'甲': '劫财', '乙': '比肩', '丙': '伤官', '丁': '食神', '戊': '正财', '己': '偏财', '庚': '正官', '辛': '七杀', '壬': '正印', '癸': '偏印'},
    '丙': {'甲': '偏印', '乙': '正印', '丙': '比肩', '丁': '劫财', '戊': '食神', '己': '伤官', '庚': '偏财', '辛': '正财', '壬': '七杀', '癸': '正官'},
    '丁': {'甲': '正印', '乙': '偏印', '丙': '劫财', '丁': '比肩', '戊': '伤官', '己': '食神', '庚': '正财', '辛': '偏财', '壬': '正官', '癸': '七杀'},
    '戊': {'甲': '七杀', '乙': '正官', '丙': '偏印', '丁': '正印', '戊': '比肩', '己': '劫财', '庚': '食神', '辛': '伤官', '壬': '偏财', '癸': '正财'},
    '己': {'甲': '正官', '乙': '七杀', '丙': '正印', '丁': '偏印', '戊': '劫财', '己': '比肩', '庚': '伤官', '辛': '食神', '壬': '正财', '癸': '偏财'},
    '庚': {'甲': '偏财', '乙': '正财', '丙': '七杀', '丁': '正官', '戊': '偏印', '己': '正印', '庚': '比肩', '辛': '劫财', '壬': '食神', '癸': '伤官'},
    '辛': {'甲': '正财', '乙': '偏财', '丙': '正官', '丁': '七杀', '戊': '正印', '己': '偏印', '庚': '劫财', '辛': '比肩', '壬': '伤官', '癸': '食神'},
    '壬': {'甲': '食神', '乙': '伤官', '丙': '偏财', '丁': '正财', '戊': '七杀', '己': '正官', '庚': '偏印', '辛': '正印', '壬': '比肩', '癸': '劫财'},
    '癸': {'甲': '伤官', '乙': '食神', '丙': '正财', '丁': '偏财', '戊': '正官', '己': '七杀', '庚': '正印', '辛': '偏印', '壬': '劫财', '癸': '比肩'}
}

def get_wuxing(gan_or_zhi):
    return WUXING_MAP.get(gan_or_zhi, '未知')

def get_shishen(day_gan, target_gan):
    return SHISHEN_MAP.get(day_gan, {}).get(target_gan, '未知')

def paipan(input_data):
    year = int(input_data.get('year'))
    month = int(input_data.get('month'))
    day = int(input_data.get('day'))
    hour = int(input_data.get('hour', 12))
    minute = int(input_data.get('minute', 0))
    
    solar = Solar.fromYmdHms(year, month, day, hour, minute, 0)
    lunar = solar.getLunar()
    
    year_pillar = lunar.getYearInGanZhi()
    month_pillar = lunar.getMonthInGanZhi()
    day_pillar = lunar.getDayInGanZhi()
    hour_pillar = lunar.getTimeInGanZhi()
    
    day_gan = day_pillar[0] if len(day_pillar) >= 2 else ""
    
    # 解析各柱
    pillars = []
    for name, pillar in [("年柱", year_pillar), ("月柱", month_pillar), ("日柱", day_pillar), ("时柱", hour_pillar)]:
        gan = pillar[0] if len(pillar) >= 2 else ""
        zhi = pillar[1] if len(pillar) >= 2 else ""
        pillars.append({
            "name": name,
            "ganzhi": pillar,
            "gan": gan,
            "zhi": zhi,
            "gan_wuxing": get_wuxing(gan),
            "zhi_wuxing": get_wuxing(zhi),
            "shishen": get_shishen(day_gan, gan) if name != "日柱" else "日元"
        })
    
    # 计算基础运势评分
    wuxing_count = {}
    for p in pillars:
        w = p["gan_wuxing"]
        wuxing_count[w] = wuxing_count.get(w, 0) + 1
        w = p["zhi_wuxing"]
        wuxing_count[w] = wuxing_count.get(w, 0) + 1
    
    # 日干五行
    day_wuxing = get_wuxing(day_gan)
    day_wuxing_count = wuxing_count.get(day_wuxing, 0)
    
    # 身强身弱判断
    if day_wuxing_count >= 3:
        body_strength = "身强"
        strength_score = 75
    elif day_wuxing_count == 2:
        body_strength = "中和"
        strength_score = 50
    else:
        body_strength = "身弱"
        strength_score = 35
    
    result = {
        "success": True,
        "bazi": {
            "year": year_pillar,
            "month": month_pillar,
            "day": day_pillar,
            "hour": hour_pillar,
            "day_gan": day_gan,
            "day_wuxing": day_wuxing,
            "body_strength": body_strength,
            "strength_score": strength_score
        },
        "pillars": pillars,
        "wuxing_balance": wuxing_count,
        "info": {
            "animal": lunar.getYearShengXiao(),
            "zodiac": solar.getXingZuo(),
            "lunar_date": f"{lunar.getYear()}年{lunar.getMonth()}月{lunar.getDay()}日",
            "gender": input_data.get('gender', '未知')
        }
    }
    
    return result

if __name__ == '__main__':
    try:
        if len(sys.argv) > 1:
            input_str = sys.argv[1]
        else:
            input_str = sys.stdin.read()
        
        input_data = json.loads(input_str)
        result = paipan(input_data)
        print(json.dumps(result, ensure_ascii=False))
        
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}, ensure_ascii=False))
        sys.exit(1)
