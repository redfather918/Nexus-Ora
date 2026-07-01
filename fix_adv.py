import sys
sys.stdout.reconfigure(encoding='utf-8')

filepath = r'C:\Users\HUAWEI\WorkBuddy\2026-06-11-19-09-15\nexus-ora-mvp\frontend\index.html'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 4 advantages h4 + p elements
adv_replacements = [
    ('<h4 class="font-semibold mb-1">AI \u539f\u751f\u9a71\u52a8</h4>\n      <p class="text-xs text-gray-500">DeepSeek AI \u52a0\u6301<br>\u667a\u80fd\u89e3\u8bfb\u547d\u76d8\u7384\u673a</p>',
     '<h4 class="font-semibold mb-1" data-i18n="matrix_adv1_title">AI \u539f\u751f\u9a71\u52a8</h4>\n      <p class="text-xs text-gray-500" data-i18n-html="matrix_adv1_desc">DeepSeek AI \u52a0\u6301<br>\u667a\u80fd\u89e3\u8bfb\u547d\u76d8\u7384\u673a</p>'),
    ('<h4 class="font-semibold mb-1">\u6570\u636e\u53ef\u89c6\u5316</h4>\n      <p class="text-xs text-gray-500">\u4eba\u751fK\u7ebf \u00b7 \u96f7\u8fbe\u56fe \u00b7 \u4e94\u884c\u67f1<br>\u547d\u8fd0\u4e00\u76ee\u4e86\u7136</p>',
     '<h4 class="font-semibold mb-1" data-i18n="matrix_adv2_title">\u6570\u636e\u53ef\u89c6\u5316</h4>\n      <p class="text-xs text-gray-500" data-i18n-html="matrix_adv2_desc">\u4eba\u751fK\u7ebf \u00b7 \u96f7\u8fbe\u56fe \u00b7 \u4e94\u884c\u67f1<br>\u547d\u8fd0\u4e00\u76ee\u4e86\u7136</p>'),
    ('<h4 class="font-semibold mb-1">\u9690\u79c1\u5b89\u5168</h4>\n      <p class="text-xs text-gray-500">\u672c\u5730 SQLite \u5b58\u50a8<br>\u6570\u636e\u4e0d\u51fa\u8bbe\u5907</p>',
     '<h4 class="font-semibold mb-1" data-i18n="matrix_adv3_title">\u9690\u79c1\u5b89\u5168</h4>\n      <p class="text-xs text-gray-500" data-i18n-html="matrix_adv3_desc">\u672c\u5730 SQLite \u5b58\u50a8<br>\u6570\u636e\u4e0d\u51fa\u8bbe\u5907</p>'),
    ('<h4 class="font-semibold mb-1">\u591a\u8bed\u8a00\u652f\u6301</h4>\n      <p class="text-xs text-gray-500">\u4e2d/\u82f1/\u65e5\u4e09\u8bed\u5207\u6362<br>300+ \u7ffb\u8bd1\u8bcd\u6761</p>',
     '<h4 class="font-semibold mb-1" data-i18n="matrix_adv4_title">\u591a\u8bed\u8a00\u652f\u6301</h4>\n      <p class="text-xs text-gray-500" data-i18n-html="matrix_adv4_desc">\u4e2d/\u82f1/\u65e5\u4e09\u8bed\u5207\u6362<br>300+ \u7ffb\u8bd1\u8bcd\u6761</p>'),
]

count = 0
for old, new in adv_replacements:
    if old in content:
        content = content.replace(old, new, 1)
        count += 1
        print(f'OK: replaced advantage {count}')
    else:
        print(f'WARN: not found')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print(f'Done: {count}/4 advantages updated')
