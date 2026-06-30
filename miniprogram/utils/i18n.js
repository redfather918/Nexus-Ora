// utils/i18n.js — 多语言支持
const translations = {
  zh: {
    // 通用
    'app.name': 'Nexus Ora',
    'app.slogan': 'AI 原生玄学平台',
    'loading': '加载中...',
    'submit': '提交',
    'back': '返回',
    'share': '分享',
    'save': '保存',

    // 首页
    'home.title': '灵境八部',
    'home.subtitle': '探索你的命运密码',
    'home.fortune': '灵境图谱',
    'home.compat': '缘分配对',
    'home.dream': '梦境回廊',
    'home.persona': '灵境人格',
    'home.oracle': '灵境占卜',
    'home.cultivation': '灵境修行',
    'home.market': '灵境市集',
    'home.ziwei': '紫微命盘',

    // 灵境图谱
    'fortune.title': '我的命运K线',
    'fortune.input_birth': '请输入出生信息',
    'fortune.birth_date': '出生日期',
    'fortune.birth_time': '出生时辰',
    'fortune.gender': '性别',
    'fortune.male': '男',
    'fortune.female': '女',
    'fortune.calculate': '开始排盘',
    'fortune.overall': '综合运势',
    'fortune.career': '事业',
    'fortune.wealth': '财运',
    'fortune.relationships': '感情',
    'fortune.health': '健康',
    'fortune.mentors': '贵人',
    'fortune.challenges': '挑战',

    // 缘分配对
    'compat.title': '缘分配对',
    'compat.person_a': '第一人信息',
    'compat.person_b': '第二人信息',
    'compat.calculate': '开始合盘',
    'compat.overall': '缘分指数',
    'compat.personality': '性格互补',
    'compat.career': '事业合作',
    'compat.romance': '感情契合',
    'compat.communication': '沟通默契',
    'compat.long_term': '长期发展',

    // 梦境回廊
    'dream.title': '梦境回廊',
    'dream.input': '描述你的梦境',
    'dream.mood': '梦境氛围',
    'dream.analyze': '解析梦境',
    'dream.east': '周公解梦',
    'dream.west': '心理学视角',
    'dream.history': '历史记录',

    // 灵境人格
    'persona.title': '灵境人格',
    'persona.generate': '生成我的人格',
    'persona.chat': '开始对话',
    'persona.input': '说点什么...',
    'persona.send': '发送',

    // 灵境占卜
    'oracle.title': '灵境占卜',
    'oracle.tarot': '塔罗牌',
    'oracle.jiaobei': '摇杯筊',
    'oracle.daily': '每日一签',

    // 灵境修行
    'cultivation.title': '灵境修行',
    'cultivation.checkin': '每日打卡',
    'cultivation.meditation': '冥想引导',
    'cultivation.diary': '能量日记',
    'cultivation.streak': '连续修行',
    'cultivation.days': '天',
    'cultivation.level': '修行等级',

    // 灵境市集
    'market.title': '灵境市集',
    'market.digital': '数字周边',
    'market.crystals': '水晶商城',
    'market.events': '线下活动',
    'market.wishlist': '心愿单',

    // 紫微命盘
    'ziwei.title': '紫微命盘',
    'ziwei.minggong': '命宫',
    'ziwei.shengong': '身宫',
  },

  en: {
    'app.name': 'Nexus Ora',
    'app.slogan': 'AI-Native Divination Platform',
    'loading': 'Loading...',
    'submit': 'Submit',
    'back': 'Back',
    'share': 'Share',
    'save': 'Save',
    'home.title': 'Eight Paths',
    'home.subtitle': 'Unlock Your Destiny Code',
    'home.fortune': 'Fortune Chart',
    'home.compat': 'Soul Match',
    'home.dream': 'Dream Hall',
    'home.persona': 'Spirit Persona',
    'home.oracle': 'Oracle',
    'home.cultivation': 'Cultivation',
    'home.market': 'Market',
    'home.ziwei': 'Ziwei Chart',
    'fortune.title': 'My Fortune K-Line',
    'fortune.calculate': 'Calculate',
    'fortune.overall': 'Overall Fortune',
    'fortune.career': 'Career',
    'fortune.wealth': 'Wealth',
    'fortune.relationships': 'Love',
    'fortune.health': 'Health',
    'fortune.mentors': 'Mentors',
    'fortune.challenges': 'Challenges',
  },

  ja: {
    'app.name': 'Nexus Ora',
    'app.slogan': 'AIネイティブ占いプラットフォーム',
    'loading': '読み込み中...',
    'submit': '送信',
    'back': '戻る',
    'share': '共有',
    'home.title': '八つの道',
    'home.subtitle': 'あなたの運命コードを解き明かす',
    'home.fortune': '運勢チャート',
    'home.compat': '縁結び',
    'home.dream': '夢回廊',
    'home.persona': '霊境人格',
    'home.oracle': 'オラクル',
    'home.cultivation': '修行',
    'home.market': 'マーケット',
    'home.ziwei': '紫微命盤',
  }
}

let currentLang = 'zh'

function setLang(lang) {
  currentLang = lang
  wx.setStorageSync('lang', lang)
}

function getLang() {
  if (!currentLang) {
    currentLang = wx.getStorageSync('lang') || 'zh'
  }
  return currentLang
}

function t(key, fallback) {
  const lang = getLang()
  return (translations[lang] && translations[lang][key]) ||
         (translations.zh && translations.zh[key]) ||
         fallback || key
}

module.exports = {
  t, setLang, getLang, translations
}
