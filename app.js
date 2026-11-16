/* =============================================================
   佛光靈氣・佛學系統 — app.js
   純離線單頁應用：咒音庫、修行次第、108 計數、功課紀錄
   - 資料來源：window.FO_DATA（data.js，以 <script> 載入）
   - 冇 data.js 時用內置示範資料 FO_DEMO，並顯示「示範資料」橫幅
   - 唔用 fetch／CDN／外部字體
   ============================================================= */
(function (global) {
  'use strict';

  var doc = global.document;

  /* =========================================================
     0. 小工具
     ========================================================= */
  function byId(id) {
    return doc ? doc.getElementById(id) : null;
  }

  function el(tag, className, text) {
    var node = doc.createElement(tag);
    if (className) { node.className = className; }
    if (text !== undefined && text !== null) { node.textContent = String(text); }
    return node;
  }

  function clear(node) {
    if (!node) { return; }
    while (node.firstChild) { node.removeChild(node.firstChild); }
  }

  function asArray(value) {
    if (value === undefined || value === null) { return []; }
    if (Array.isArray(value)) { return value; }
    if (typeof value === 'string') { return value.trim() ? [value] : []; }
    return [value];
  }

  function asText(value, fallback) {
    if (value === undefined || value === null) { return fallback === undefined ? '' : fallback; }
    if (typeof value === 'string') { return value; }
    if (typeof value === 'number' || typeof value === 'boolean') { return String(value); }
    return fallback === undefined ? '' : fallback;
  }

  function asNumber(value, fallback) {
    var n = Number(value);
    return isFinite(n) ? n : fallback;
  }

  function cleanText(value) {
    if (typeof value === 'string') { return value.trim(); }
    if (value && typeof value === 'object') {
      return asText(value.text || value.action || value.label || value.summary).trim();
    }
    return asText(value).trim();
  }

  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function isoDate(date) {
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
  }

  function parseISO(value) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(asText(value));
    if (!m) { return null; }
    var date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (isNaN(date.getTime())) { return null; }
    return date;
  }

  function todayISO() {
    return isoDate(new Date());
  }

  function addDays(date, days) {
    var next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    next.setDate(next.getDate() + days);
    return next;
  }

  function weekdayName(date) {
    return WEEKDAYS[date.getDay()];
  }

  function formatZhDate(date) {
    return date.getFullYear() + '年' + (date.getMonth() + 1) + '月' + date.getDate() + '日（星期' + weekdayName(date) + '）';
  }

  function formatShortDate(date) {
    return (date.getMonth() + 1) + '月' + date.getDate() + '日（' + weekdayName(date) + '）';
  }

  function formatClock(date) {
    if (!date || isNaN(date.getTime())) { return ''; }
    return pad2(date.getHours()) + ':' + pad2(date.getMinutes());
  }

  function formatTime(seconds) {
    var total = Math.floor(Number(seconds));
    if (!isFinite(total) || total < 0) { total = 0; }
    var m = Math.floor(total / 60);
    var s = total % 60;
    if (m >= 60) {
      var h = Math.floor(m / 60);
      return h + ':' + pad2(m % 60) + ':' + pad2(s);
    }
    return m + ':' + pad2(s);
  }

  function closestAttr(node, selector) {
    while (node && node.nodeType === 1) {
      if (typeof node.matches === 'function' && node.matches(selector)) { return node; }
      node = node.parentNode;
    }
    return null;
  }

  function showToast(message) {
    if (!els.toastRoot) { return; }
    var toast = el('div', 'toast', message);
    els.toastRoot.appendChild(toast);
    while (els.toastRoot.children.length > 3) {
      els.toastRoot.removeChild(els.toastRoot.firstChild);
    }
    setTimeout(function () {
      if (toast.parentNode) { toast.parentNode.removeChild(toast); }
    }, 3400);
  }

  /* =========================================================
     1. 常數
     ========================================================= */
  var STORAGE_KEY = 'foguang.foxue.state.v1';
  var TARGET = 108;
  var WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
  var TABS = ['home', 'library', 'practice', 'records', 'about'];
  var CATEGORY_ORDER = ['真言', '陀羅尼', '聖號', '淨土', '儀軌', '靈性（非佛教）'];
  var SPIRITUAL_CATEGORY = '靈性（非佛教）';

  /* =========================================================
     2. 示範資料（冇 data.js 時使用；有 data.js 則以 FO_DATA 為準）
     ========================================================= */
  var FO_DEMO = {
    meta: {
      title: '佛光靈氣・佛學系統',
      version: '1.0.0-demo',
      updated: '2026-11-15',
      lineage: '顯密圓融（漢傳為主，兼容唐密、藏密公開部分與淨土）',
      disclaimer: '本系統為個人修學整理，非官方教材；密法儀軌須依具格上師傳承。此處為示範資料，未經完整考據，正式內容以 data.js 為準。'
    },
    mantras: [
      {
        id: 'guangming-zhenyan',
        order: 1,
        title: '光明真言',
        alias: ['大日如來光明真言', '光之真言'],
        category: '真言',
        tradition: '唐密・漢傳',
        source: '《不空羂索神變真言經》卷二十八（待考）',
        sourceNote: '示範資料：經名卷品依傳統記載，詳細出處待考據。',
        summary: '以光明遍照為德的真言，常於淨業、開光、超薦等場合持誦。',
        benefits: [
          '（經說）依經文記載，持誦光明真言能滅除重罪、增長福德智慧（原文摘要，待核）。',
          '（傳統說法）密教傳統視此真言為淨除業障、遍照光明之修法，常配合觀想光明遍滿。'
        ],
        mantraHan: '唵 阿謨伽 尾盧左曩 摩賀 母捺囉 摩尼 鉢納摩 入縛攞 鉢囉韈多野 吽',
        mantraRoman: 'oṃ amogha vairocana mahāmudrā maṇi padma jvāla pravarttaya hūṃ',
        howTo: [
          '先淨手、漱口，端身正坐，合掌。',
          '每次 21 遍或 108 遍，可跟音檔持誦。',
          '末後念補闕圓滿真言 3 遍，再作迴向。'
        ],
        caution: [
          '重在攝心，不宜求神通或治病；身心不適請就醫。',
          '密法觀想若無傳承，只作公開持誦即可，勿自行編排儀軌。'
        ],
        audio: [
          { file: '../000佛音靈氣000/1.光明真言 108遍。.MP3', label: '108 遍（12:31）' },
          { file: '../000佛音靈氣000/01.光明真言功德.MP3', label: '功德開示（1:48）' }
        ],
        tags: ['淨業', '光明', '日常']
      },
      {
        id: 'sanzi-zongchi',
        order: 2,
        title: '三字總持真言',
        alias: ['三字神咒', '普賢王如來根本咒'],
        category: '真言',
        tradition: '顯密共通',
        source: '《瑜伽大教王經》（依音檔說明，待考）',
        sourceNote: '示範資料：三字分別表毘盧遮那佛、阿彌陀佛、阿閦如來之德。',
        summary: '咒文只有唵、阿、吽三字，總攝諸佛身語意之德，短而易持。',
        benefits: [
          '（經說）三字總持總攝諸佛身語意功德（經文引述，待核）。',
          '（傳統說法）常作前行淨業或日常總持，短咒易記，適合忙碌中持誦。'
        ],
        mantraHan: '唵 阿 吽',
        mantraRoman: 'oṃ āḥ hūṃ',
        howTo: [
          '每次 21 遍、108 遍或 1080 遍均可。',
          '可配合呼吸：吸氣默念「唵」，住氣念「阿」，呼氣念「吽」。'
        ],
        caution: ['勿以數量相較；重在身語意相應。'],
        audio: [
          { file: '../000佛音靈氣000/01.三字總持真言 唵阿吽.MP3', label: '長版持誦（30:05）' },
          { file: '../000佛音靈氣000/0.三字總持真言功德.MP3', label: '功德開示（1:12）' }
        ],
        tags: ['總持', '前行', '日常']
      },
      {
        id: 'liuzi-daming',
        order: 3,
        title: '六字大明咒',
        alias: ['六字真言', '觀音心咒'],
        category: '真言',
        tradition: '藏傳・漢傳共通',
        source: '《佛說大乘莊嚴寶王經》卷四（待考）',
        sourceNote: '示範資料：常譯作「唵嘛呢叭咪吽」。',
        summary: '觀世音菩薩心咒，以慈悲為體，普利眾生。',
        benefits: [
          '（經說）經中稱此咒有廣大功德，能與觀音悲願相應（摘要，待核）。',
          '（傳統說法）藏傳佛教視之為觀音修法核心，常於日常持誦。'
        ],
        mantraHan: '唵 嘛呢 叭咪 吽',
        mantraRoman: 'oṃ maṇi padme hūṃ',
        howTo: ['每日 108 遍為常見功課；可出聲、金剛念或默念。'],
        caution: ['此示範項未配對音檔；正式音檔請於 data.js 加入。'],
        audio: [],
        tags: ['觀音', '慈悲', '日常']
      },
      {
        id: 'dasuiqiu-xinzhou',
        order: 4,
        title: '大隨求陀羅尼心咒',
        alias: ['隨求心咒'],
        category: '陀羅尼',
        tradition: '唐密',
        source: '《佛說隨求即得大自在陀羅尼神呪經》（待考）',
        sourceNote: '示範資料：咒文與經名待考據，正式內容以 data.js 為準。',
        summary: '大隨求陀羅尼之心咒，傳統上用於除障、滿願。',
        benefits: [
          '（經說）經中廣說此陀羅尼功德（摘要，待核）。',
          '（傳統說法）常用於淨除障礙、祈求善願成就。'
        ],
        mantraHan: '唵 跋囉 跋囉 三跋囉 三跋囉 印捺哩野 尾戍馱你 吽吽 盧盧 左隸 娑婆訶',
        mantraRoman: 'oṃ bhara bhara sambhara sambhara indriya viśodhani hūṃ hūṃ ruru cale svāhā',
        howTo: ['每次 21 遍或 108 遍；可跟音檔。', '持誦後念補闕真言，再作迴向。'],
        caution: ['咒文以漢譯課誦本為準，異譯本差異待考。'],
        audio: [
          { file: '../000佛音靈氣000/2.大隨求陀羅尼 心咒功德.MP3', label: '心咒功德開示（3:59）' },
          { file: '../000佛音靈氣000/2.大隨求陀羅尼心咒 108遍 共三次.MP3', label: '108 遍共三次（43:31）' }
        ],
        tags: ['除障', '隨求']
      },
      {
        id: 'buque-yuanman',
        order: 5,
        title: '補闕圓滿真言',
        alias: ['補闕真言'],
        category: '真言',
        tradition: '漢傳密教',
        source: '密教課誦常用補闕真言（出處待考）',
        sourceNote: '示範資料：常見於漢傳密教課誦本，用以補足持誦闕漏。',
        summary: '持誦末後念此真言，補足闕漏，令功課圓滿。',
        benefits: [
          '（傳統說法）課誦收尾常用，表補闕圓滿、迴向前之加行。'
        ],
        mantraHan: '唵 呼嚧呼嚧 社曳穆契 娑訶',
        mantraRoman: 'oṃ huru huru jaye mukhe svāhā',
        howTo: ['每堂功課末後念 3 遍或 7 遍。', '念畢合掌迴向。'],
        caution: [],
        audio: [
          { file: '../000佛音靈氣000/07.梵文補闕圓滿真言 果濱居士.MP3', label: '梵文持誦（0:54）' }
        ],
        tags: ['補闕', '收尾']
      },
      {
        id: 'amituofo-sheng',
        order: 6,
        title: '阿彌陀佛聖號',
        alias: ['持名念佛'],
        category: '淨土',
        tradition: '淨土宗',
        source: '淨土五經・《佛說阿彌陀經》持名念佛法門',
        summary: '執持名號，一心不亂，求生淨土；日常行住坐臥皆可念。',
        benefits: [
          '（經說）《阿彌陀經》勸人執持名號，若一日至七日一心不亂，臨終得往生（經文摘要）。'
        ],
        mantraHan: '南無阿彌陀佛',
        mantraRoman: 'Namo Amitābha',
        howTo: ['每日 108 次或更多，可跟音檔。', '念畢念迴向偈，迴向眾生。'],
        caution: ['淨土法門重信願行，宜依淨土經論與善知識指導。'],
        audio: [
          { file: '../04.天元太保阿彌陀佛108次.MP3', label: '108 次（10:35）' },
          { file: '../000佛音靈氣000/5.以此功德願證佛自性.mp3', label: '迴向偈片段（0:33）' }
        ],
        tags: ['淨土', '日常', '聖號']
      },
      {
        id: 'lingxing-yuzhou',
        order: 7,
        title: '宇宙能量連結（靈性・非佛教）',
        alias: ['示範用靈性音檔'],
        category: SPIRITUAL_CATEGORY,
        tradition: '新時代／靈性',
        source: '出處非佛教經典（示範資料）',
        sourceNote: '此項屬靈性成長類內容，只作資料整理，與佛教正典分開陳列。',
        summary: '原音檔屬靈性成長類分享，與佛教咒音不同；本系統只作離線整理，不視為佛法。',
        benefits: [
          '（非佛教）屬新時代／靈性類說法，本系統不視為佛法，請自行判別。'
        ],
        mantraHan: '（此項非咒文，只作音檔分類示範）',
        howTo: ['如要收聽，可作一般音檔播放。'],
        caution: ['非佛教正典，勿與佛法混淆。'],
        audio: [
          { file: '../每天1秒鐘，連結宇宙比冥想快100倍/每天1秒鐘，連結宇宙比冥想快100倍.MP3', label: '靈性分享（24:02）' }
        ],
        tags: ['靈性', '非佛教']
      }
    ],
    curriculum: {
      cycleLength: 7,
      totalMinutesHint: '每日 15–30 分鐘',
      guidelines: [
        '每次修學前先淨手、漱口，端身正坐。',
        '以慈悲心與慚愧心持誦，不求神通、不與人比較。',
        '功課完畢念補闕圓滿真言 3 遍，再作迴向。',
        '每日 15–30 分鐘即可，持續比數量重要。'
      ],
      days: [
        {
          day: 1,
          title: '安住身心日',
          focus: '前行靜坐＋三字總持真言＋光明真言',
          steps: [
            { minutes: 2, action: '靜坐調息，放鬆身心' },
            { minutes: 3, action: '三字總持真言 21 遍', mantraId: 'sanzi-zongchi' },
            { minutes: 12, action: '光明真言 108 遍（可跟音檔）', mantraId: 'guangming-zhenyan' },
            { minutes: 2, action: '補闕圓滿真言 3 遍，迴向', mantraId: 'buque-yuanman' }
          ]
        },
        {
          day: 2,
          title: '觀音悲願日',
          focus: '六字大明咒＋大隨求心咒',
          steps: [
            { minutes: 2, action: '靜坐調息，發慈悲心' },
            { minutes: 8, action: '六字大明咒 108 遍（可默念）', mantraId: 'liuzi-daming' },
            { minutes: 6, action: '大隨求陀羅尼心咒 21 遍', mantraId: 'dasuiqiu-xinzhou' },
            { minutes: 2, action: '補闕圓滿真言 3 遍，迴向', mantraId: 'buque-yuanman' }
          ]
        },
        {
          day: 3,
          title: '淨障光明日',
          focus: '光明真言＋三字總持真言',
          steps: [
            { minutes: 2, action: '淨手漱口，三稱南無本師釋迦牟尼佛' },
            { minutes: 13, action: '光明真言 108 遍（跟 12:31 音檔）', mantraId: 'guangming-zhenyan' },
            { minutes: 5, action: '三字總持真言 108 遍', mantraId: 'sanzi-zongchi' },
            { minutes: 2, action: '補闕圓滿真言 3 遍，迴向', mantraId: 'buque-yuanman' }
          ]
        },
        {
          day: 4,
          title: '彌陀淨土日',
          focus: '持名念佛＋六字大明咒',
          steps: [
            { minutes: 2, action: '靜坐調息，發願求生淨土' },
            { minutes: 11, action: '南無阿彌陀佛 108 次（跟音檔）', mantraId: 'amituofo-sheng' },
            { minutes: 5, action: '六字大明咒 21 遍', mantraId: 'liuzi-daming' },
            { minutes: 1, action: '念迴向偈，迴向眾生' }
          ]
        },
        {
          day: 5,
          title: '總持精進日',
          focus: '大隨求心咒＋三字總持真言',
          steps: [
            { minutes: 2, action: '靜坐調息' },
            { minutes: 10, action: '大隨求陀羅尼心咒 21 遍', mantraId: 'dasuiqiu-xinzhou' },
            { minutes: 5, action: '三字總持真言 108 遍', mantraId: 'sanzi-zongchi' },
            { minutes: 2, action: '補闕圓滿真言 3 遍，迴向', mantraId: 'buque-yuanman' }
          ]
        },
        {
          day: 6,
          title: '光明遍照日',
          focus: '光明真言長版',
          steps: [
            { minutes: 2, action: '靜坐調息，觀想光明遍照' },
            { minutes: 13, action: '光明真言 108 遍（跟音檔）', mantraId: 'guangming-zhenyan' },
            { minutes: 2, action: '補闕圓滿真言 3 遍', mantraId: 'buque-yuanman' },
            { minutes: 1, action: '迴向' }
          ]
        },
        {
          day: 7,
          title: '總持迴向日',
          focus: '各法門總修，普皆迴向',
          steps: [
            { minutes: 2, action: '三字總持真言 21 遍', mantraId: 'sanzi-zongchi' },
            { minutes: 5, action: '六字大明咒 21 遍', mantraId: 'liuzi-daming' },
            { minutes: 5, action: '大隨求陀羅尼心咒 21 遍', mantraId: 'dasuiqiu-xinzhou' },
            { minutes: 12, action: '光明真言 108 遍', mantraId: 'guangming-zhenyan' },
            { minutes: 2, action: '南無阿彌陀佛 21 次', mantraId: 'amituofo-sheng' },
            { minutes: 2, action: '補闕圓滿真言 3 遍，總迴向', mantraId: 'buque-yuanman' }
          ]
        }
      ]
    },
    rituals: [
      {
        id: 'daily',
        title: '每日功課儀軌',
        when: '早上或睡前',
        steps: [
          '淨手漱口，端身正坐，合掌。',
          '三稱「南無本師釋迦牟尼佛」。',
          '三字總持真言 7 遍。',
          '當日主修咒語 21 遍或 108 遍（可跟音檔）。',
          '補闕圓滿真言 3 遍。',
          '念迴向偈，迴向眾生及自身冤親。'
        ]
      }
    ],
    references: [
      {
        label: 'CBETA 漢文大藏經（線上，需上網）',
        url: 'https://cbetaonline.dila.edu.tw/',
        note: '核對經文出處與咒文用字'
      }
    ]
  };

  /* =========================================================
     3. 資料正規化（任何欄位缺失都唔會爆）
     ========================================================= */
  function benefitTypeOf(label) {
    var text = asText(label);
    if (!text) { return ''; }
    if (text.indexOf('傳統') !== -1 || /trad/i.test(text) || /folk/i.test(text)) { return 'tradition'; }
    if (text.indexOf('經') !== -1 || /sutra/i.test(text) || /canon/i.test(text)) { return 'sutra'; }
    return 'other';
  }

  function normalizeBenefit(item) {
    if (item === undefined || item === null) { return null; }
    var type = '';
    var text = '';

    if (typeof item === 'string') {
      text = item.trim();
      if (!text) { return null; }
      var m = /^(?:（\s*(經說|經典說法|傳統說法|傳統|其他)\s*）|\[\s*(經說|傳統說法|傳統|其他)\s*\]|(經說|傳統說法|傳統)\s*[:：]|(sutra|tradition)\s*[:：])\s*/i.exec(text);
      if (m) {
        type = benefitTypeOf((m[1] || m[2] || m[3] || m[4] || ''));
        text = text.slice(m[0].length).trim();
      } else if (/^經說/.test(text)) {
        type = 'sutra';
      } else if (/^傳統/.test(text)) {
        type = 'tradition';
      }
    } else if (typeof item === 'object') {
      if (Array.isArray(item)) {
        var joined = item.map(cleanText).filter(Boolean).join('；');
        return joined ? { type: 'other', text: joined } : null;
      }
      text = asText(item.text || item.content || item.summary || item.value || item.description).trim();
      var label = asText(item.type || item.kind || item.label || item.category || item.source || item.origin).trim();
      type = benefitTypeOf(label);
      if (!text) {
        var keys = Object.keys(item);
        for (var i = 0; i < keys.length; i++) {
          var key = keys[i];
          var value = item[key];
          if (value === undefined || value === null) { continue; }
          if (typeof value === 'string' && value.trim()) {
            type = benefitTypeOf(key);
            text = value.trim();
            break;
          }
          if (Array.isArray(value) && value.length) {
            type = benefitTypeOf(key);
            text = value.map(cleanText).filter(Boolean).join('；');
            if (text) { break; }
          }
        }
      }
    }

    if (!text) { return null; }
    return { type: type || 'other', text: text };
  }

  function normalizeBenefits(raw) {
    var out = [];
    if (raw === undefined || raw === null) { return out; }
    if (typeof raw === 'string') {
      var single = normalizeBenefit(raw);
      return single ? [single] : [];
    }
    if (Array.isArray(raw)) {
      raw.forEach(function (item) {
        var benefit = normalizeBenefit(item);
        if (benefit) { out.push(benefit); }
      });
      return out;
    }
    if (typeof raw === 'object') {
      Object.keys(raw).forEach(function (key) {
        var type = benefitTypeOf(key);
        asArray(raw[key]).forEach(function (value) {
          if (typeof value === 'string' && value.trim()) {
            out.push({ type: type, text: value.trim() });
          } else if (value && typeof value === 'object') {
            var nested = normalizeBenefit(value);
            if (nested) {
              if (!nested.type && type) { nested.type = type; }
              out.push(nested);
            }
          }
        });
      });
    }
    return out;
  }

  function normalizeAudio(item) {
    if (!item) { return null; }
    if (typeof item === 'string') {
      var file = item.trim();
      return file ? { file: file, label: '' } : null;
    }
    if (typeof item !== 'object') { return null; }
    var path = asText(item.file || item.src || item.path || item.url).trim();
    if (!path) { return null; }
    var label = asText(item.label || item.title || item.name || item.duration).trim();
    return { file: path, label: label };
  }

  function normalizeMantra(item, index, seenIds) {
    var raw = (item && typeof item === 'object') ? item : {};
    var id = asText(raw.id).trim();
    if (!id) { id = 'mantra-' + (index + 1); }
    if (seenIds[id]) {
      var base = id;
      var n = 2;
      while (seenIds[id]) {
        id = base + '-' + n;
        n++;
      }
    }
    seenIds[id] = true;

    return {
      id: id,
      order: asNumber(raw.order, index + 1),
      title: asText(raw.title).trim() || ('未命名法門 ' + (index + 1)),
      alias: asArray(raw.alias).map(cleanText).filter(Boolean),
      category: asText(raw.category).trim() || '未分類',
      tradition: asText(raw.tradition).trim(),
      source: asText(raw.source).trim() || '出處待考',
      sourceNote: asText(raw.sourceNote).trim(),
      summary: asText(raw.summary).trim(),
      benefits: normalizeBenefits(raw.benefits),
      mantraHan: asText(raw.mantraHan || raw.mantra || raw.text).trim(),
      mantraRoman: asText(raw.mantraRoman || raw.roman).trim(),
      howTo: asArray(raw.howTo).map(cleanText).filter(Boolean),
      caution: asArray(raw.caution).map(cleanText).filter(Boolean),
      audio: asArray(raw.audio).map(normalizeAudio).filter(Boolean),
      tags: asArray(raw.tags).map(cleanText).filter(Boolean),
      _index: index
    };
  }

  function normalizeCurriculum(raw, mantraIds) {
    var source = (raw && typeof raw === 'object') ? raw : {};
    var daysRaw = asArray(source.days);

    var days = daysRaw.map(function (item, index) {
      var day = (item && typeof item === 'object') ? item : {};
      var steps = asArray(day.steps).map(function (step, stepIndex) {
        var s = (step && typeof step === 'object') ? step : { action: cleanText(step) };
        var action = asText(s.action || s.text || s.step || s.title).trim() || '（未填步驟）';
        var mantraId = asText(s.mantraId || s.mantra || s.id).trim();
        var validId = mantraId && mantraIds.indexOf(mantraId) !== -1 ? mantraId : '';
        return {
          minutes: Math.max(0, asNumber(s.minutes, 0)),
          action: action,
          mantraId: validId
        };
      });
      return {
        day: asNumber(day.day, index + 1),
        title: asText(day.title).trim() || ('第 ' + (index + 1) + ' 日'),
        focus: asText(day.focus).trim(),
        steps: steps
      };
    });

    return {
      cycleLength: Math.max(1, Math.floor(asNumber(source.cycleLength, days.length || 7))),
      weeks: Math.max(0, Math.floor(asNumber(source.weeks, 0))),
      totalMinutesHint: asText(source.totalMinutesHint).trim(),
      guidelines: asArray(source.guidelines).map(cleanText).filter(Boolean),
      weekEmphasis: asArray(source.weekEmphasis).map(cleanText).filter(Boolean),
      days: days
    };
  }

  function normalizeRituals(raw) {
    return asArray(raw).map(function (item, index) {
      var ritual = (item && typeof item === 'object') ? item : {};
      var steps = asArray(ritual.steps).map(cleanText).filter(Boolean);
      return {
        id: asText(ritual.id).trim() || ('ritual-' + (index + 1)),
        title: asText(ritual.title).trim() || ('儀軌 ' + (index + 1)),
        when: asText(ritual.when).trim(),
        steps: steps
      };
    });
  }

  function normalizeReferences(raw) {
    return asArray(raw).map(function (item) {
      if (typeof item === 'string') {
        return { label: item.trim(), url: '', note: '' };
      }
      var ref = (item && typeof item === 'object') ? item : {};
      return {
        label: asText(ref.label || ref.title || ref.name).trim() || '參考資料',
        url: asText(ref.url || ref.href).trim(),
        note: asText(ref.note || ref.description).trim()
      };
    }).filter(function (ref) { return !!ref.label; });
  }

  function normalizeData(raw) {
    var source = (raw && typeof raw === 'object') ? raw : {};
    var metaRaw = (source.meta && typeof source.meta === 'object') ? source.meta : {};

    var meta = {
      title: asText(metaRaw.title).trim() || '佛光靈氣・佛學系統',
      version: asText(metaRaw.version).trim() || '—',
      updated: asText(metaRaw.updated).trim() || '',
      lineage: asText(metaRaw.lineage).trim() || '顯密圓融（漢傳為主，兼容密咒與淨土）',
      disclaimer: asText(metaRaw.disclaimer).trim() || '本系統為個人修學整理，非官方教材；密法儀軌須依具格上師傳承。',
      nonBuddhistNote: asText(metaRaw.nonBuddhistNote).trim(),
      countingHint: asText(metaRaw.countingHint).trim()
    };

    var seenIds = Object.create(null);
    var mantras = asArray(source.mantras).map(function (item, index) {
      return normalizeMantra(item, index, seenIds);
    });

    mantras.sort(function (a, b) {
      if (a.order !== b.order) { return a.order - b.order; }
      return a._index - b._index;
    });

    var mantraIds = mantras.map(function (mantra) { return mantra.id; });

    return {
      meta: meta,
      mantras: mantras,
      curriculum: normalizeCurriculum(source.curriculum, mantraIds),
      rituals: normalizeRituals(source.rituals),
      references: normalizeReferences(source.references)
    };
  }

  /* =========================================================
     4. 純邏輯（可獨立測試）
     ========================================================= */
  function isEncodedSegment(segment) {
    if (!/%[0-9A-Fa-f]{2}/.test(segment)) { return false; }
    /* 有非 ASCII、空白、# 或 ? 就當係未編碼 */
    if (/[^\x21-\x7E]/.test(segment)) { return false; }
    if (/[\\?#]/.test(segment)) { return false; }
    return /^(?:[A-Za-z0-9\-._~!$&'()*+,;=:@]|%[0-9A-Fa-f]{2})+$/.test(segment);
  }

  function trackUrl(file) {
    var path = asText(file).trim();
    if (!path) { return ''; }
    /* 絕對 URL（http/https/file/data/blob 等）保持原樣 */
    if (/^[a-z][a-z0-9+.-]*:/i.test(path) || path.indexOf('//') === 0) { return path; }
    path = path.replace(/\\/g, '/');
    return path.split('/').map(function (segment) {
      if (!segment) { return segment; }
      /* 已經係完整 %XX 編碼就唔重複編碼 */
      if (isEncodedSegment(segment)) { return segment; }
      return encodeURIComponent(segment);
    }).join('/');
  }

  function buildPlaylist(data) {
    var list = [];
    if (!data || !Array.isArray(data.mantras)) { return list; }
    data.mantras.forEach(function (mantra) {
      (mantra.audio || []).forEach(function (track) {
        list.push({
          file: track.file,
          url: trackUrl(track.file),
          label: track.label || '音檔',
          mantraId: mantra.id,
          mantraTitle: mantra.title
        });
      });
    });
    return list;
  }

  function categoryList(mantras) {
    var seen = Object.create(null);
    var out = [];
    (mantras || []).forEach(function (mantra) {
      var category = mantra.category || '未分類';
      if (!seen[category]) {
        seen[category] = true;
        out.push(category);
      }
    });
    out.sort(function (a, b) {
      var ia = CATEGORY_ORDER.indexOf(a);
      var ib = CATEGORY_ORDER.indexOf(b);
      if (ia === -1) { ia = CATEGORY_ORDER.length; }
      if (ib === -1) { ib = CATEGORY_ORDER.length; }
      if (ia !== ib) { return ia - ib; }
      return a.localeCompare(b);
    });
    return out;
  }

  function filterMantras(mantras, query, category) {
    var q = asText(query).trim().toLowerCase();
    var cat = category || '全部';
    var list = Array.isArray(mantras) ? mantras : [];
    return list.filter(function (mantra) {
      if (cat !== '全部' && mantra.category !== cat) { return false; }
      if (!q) { return true; }
      var haystack = [
        mantra.title,
        (mantra.alias || []).join(' '),
        mantra.category,
        mantra.tradition,
        mantra.source,
        mantra.sourceNote,
        mantra.summary,
        mantra.mantraHan,
        mantra.mantraRoman,
        (mantra.tags || []).join(' '),
        (mantra.benefits || []).map(function (b) { return b.text; }).join(' '),
        (mantra.howTo || []).join(' ')
      ].join(' ').toLowerCase();
      return haystack.indexOf(q) !== -1;
    });
  }

  function computeStreak(records, todayIso) {
    var recordsSafe = (records && typeof records === 'object') ? records : {};
    var today = parseISO(todayIso) || new Date();
    var doneToday = !!(recordsSafe[todayIso] && recordsSafe[todayIso].done !== false);
    var cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (!doneToday) { cursor = addDays(cursor, -1); }
    var streak = 0;
    while (recordsSafe[isoDate(cursor)] && recordsSafe[isoDate(cursor)].done !== false) {
      streak++;
      if (streak > 5000) { break; }
      cursor = addDays(cursor, -1);
    }
    return { streak: streak, doneToday: doneToday };
  }

  function recordStats(records, todayIso) {
    var recordsSafe = (records && typeof records === 'object') ? records : {};
    var keys = Object.keys(recordsSafe).filter(function (key) {
      return recordsSafe[key] && recordsSafe[key].done !== false;
    });
    var monthPrefix = asText(todayIso).slice(0, 7);
    var month = keys.filter(function (key) { return key.slice(0, 7) === monthPrefix; }).length;
    return { total: keys.length, month: month };
  }

  function suggestedDayNumber(records, cycleLength, todayIso) {
    var cycle = Math.max(1, Math.floor(asNumber(cycleLength, 7)));
    var recordsSafe = (records && typeof records === 'object') ? records : {};
    var doneBeforeToday = 0;
    Object.keys(recordsSafe).forEach(function (key) {
      if (key < todayIso && recordsSafe[key] && recordsSafe[key].done !== false) {
        doneBeforeToday++;
      }
    });
    return (doneBeforeToday % cycle) + 1;
  }

  /* =========================================================
     5. 狀態（localStorage + 記憶體後備）
     ========================================================= */
  var state = null;
  var storageAvailable = true;
  var storageIssueShown = false;

  function defaultState() {
    return {
      version: 1,
      counter: { date: todayISO(), count: 0 },
      records: {},
      curriculum: {},
      settings: { beep: true, bigText: false, lastTab: 'home', loop: false }
    };
  }

  function normalizeState(raw) {
    var safe = defaultState();
    if (!raw || typeof raw !== 'object') { return safe; }

    if (raw.counter && typeof raw.counter === 'object') {
      var counterDate = asText(raw.counter.date).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(counterDate)) { safe.counter.date = counterDate; }
      safe.counter.count = Math.max(0, Math.floor(asNumber(raw.counter.count, 0)));
    }

    if (raw.records && typeof raw.records === 'object') {
      Object.keys(raw.records).forEach(function (key) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) { return; }
        var record = raw.records[key];
        if (record === true) {
          safe.records[key] = { done: true, rounds: 0, ts: '' };
        } else if (record && typeof record === 'object') {
          safe.records[key] = {
            done: record.done !== false,
            rounds: Math.max(0, Math.floor(asNumber(record.rounds, 0))),
            ts: asText(record.ts, ''),
            source: asText(record.source, '')
          };
        }
      });
    }

    if (raw.curriculum && typeof raw.curriculum === 'object') {
      Object.keys(raw.curriculum).forEach(function (key) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) { return; }
        var value = raw.curriculum[key];
        if (!value || typeof value !== 'object') { return; }
        var checkedRaw = value.checked && typeof value.checked === 'object' ? value.checked : value;
        var checked = {};
        Object.keys(checkedRaw).forEach(function (stepKey) {
          if (checkedRaw[stepKey] === true || checkedRaw[stepKey] === 1) {
            if (/^\d+:\d+$/.test(stepKey)) { checked[stepKey] = true; }
          }
        });
        safe.curriculum[key] = checked;
      });
    }

    if (raw.settings && typeof raw.settings === 'object') {
      safe.settings.beep = raw.settings.beep !== false;
      safe.settings.bigText = raw.settings.bigText === true;
      safe.settings.loop = raw.settings.loop === true;
      var lastTab = asText(raw.settings.lastTab).trim();
      if (TABS.indexOf(lastTab) !== -1) { safe.settings.lastTab = lastTab; }
    }

    return safe;
  }

  function storeRead() {
    var raw = null;
    try {
      raw = global.localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      storageAvailable = false;
      return null;
    }
    if (!raw) { return null; }
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function noteStorageIssue() {
    if (storageIssueShown || !els.banner) { return; }
    storageIssueShown = true;
    els.bannerExtra.hidden = false;
    els.bannerExtra.textContent = '注意：此瀏覽器唔准儲存進度（可能係隱私模式或安全設定），今次嘅設定同紀錄重新整理後會消失。';
    els.banner.hidden = false;
  }

  function saveState() {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      storageAvailable = false;
      noteStorageIssue();
    }
  }

  function ensureToday() {
    var today = todayISO();
    if (!state.counter || state.counter.date !== today) {
      state.counter = { date: today, count: 0 };
      saveState();
      return true;
    }
    return false;
  }

  function pruneOldCurriculum() {
    var cutoff = isoDate(addDays(new Date(), -90));
    Object.keys(state.curriculum).forEach(function (key) {
      if (key < cutoff) { delete state.curriculum[key]; }
    });
  }

  function checkedStepsFor(dateIso) {
    var value = state.curriculum[dateIso];
    return (value && typeof value === 'object') ? value : {};
  }

  function isStepChecked(dayNumber, stepIndex) {
    var checked = checkedStepsFor(todayISO());
    return checked[dayNumber + ':' + stepIndex] === true;
  }

  function setStepChecked(dayNumber, stepIndex, checked) {
    var date = todayISO();
    var map = state.curriculum[date];
    if (!map || typeof map !== 'object') { map = {}; state.curriculum[date] = map; }
    var key = dayNumber + ':' + stepIndex;
    if (checked) { map[key] = true; } else { delete map[key]; }
    saveState();
  }

  /* =========================================================
     6. 全局變數 / DOM 快取
     ========================================================= */
  var DATA = null;
  var IS_DEMO = false;
  var playlist = [];
  var currentTrack = -1;
  var els = {};
  var openDays = {};
  var currentTab = 'home';
  var libFilter = { query: '', category: '全部' };
  var lastFocused = null;
  var audioCtx = null;
  var seekDragging = false;
  var lastPositionUpdate = 0;
  var dateTimer = null;
  var resetArmed = false;
  var resetTimer = null;

  function cacheEls() {
    els = {
      tabs: byId('tabs'),
      banner: byId('data-banner'),
      bannerTitle: byId('data-banner-title'),
      bannerText: byId('data-banner-text'),
      bannerExtra: byId('data-banner-extra'),
      brandSub: byId('brand-sub'),
      todayChip: byId('today-chip'),
      installApp: byId('install-app'),
      fontsizeToggle: byId('fontsize-toggle'),
      footVersion: byId('foot-version'),
      homeDate: byId('home-date'),
      homeGreeting: byId('home-greeting'),
      homeStats: byId('home-stats'),
      homeToday: byId('home-today'),
      homeFeatured: byId('home-featured'),
      searchInput: byId('search-input'),
      categoryChips: byId('category-chips'),
      libraryCount: byId('library-count'),
      mantraGrid: byId('mantra-grid'),
      libraryEmpty: byId('library-empty'),
      practiceToday: byId('practice-today'),
      guidelines: byId('guidelines'),
      weekEmphasis: byId('week-emphasis'),
      curriculumList: byId('curriculum-list'),
      nonBuddhistNote: byId('nonbuddhist-note'),
      counterSection: byId('counter-section'),
      counterBtn: byId('counter-btn'),
      counterRing: byId('counter-ring'),
      counterCount: byId('counter-count'),
      counterToday: byId('counter-today'),
      counterDataHint: byId('counter-data-hint'),
      counterRounds: byId('counter-rounds'),
      counterReset: byId('counter-reset'),
      counterSound: byId('counter-sound'),
      counterLog: byId('counter-log'),
      counterDone: byId('counter-done'),
      counterLogNote: byId('counter-log-note'),
      ritualsBlock: byId('rituals-block'),
      ritualsList: byId('rituals-list'),
      recordToday: byId('record-today'),
      recordsStats: byId('records-stats'),
      historyGrid: byId('history-grid'),
      recordsMarkToday: byId('records-mark-today'),
      recordsReset: byId('records-reset'),
      recordsResetNote: byId('records-reset-note'),
      aboutMeta: byId('about-meta'),
      aboutLineage: byId('about-lineage'),
      aboutReferencesBlock: byId('about-references-block'),
      aboutReferences: byId('about-references'),
      aboutDisclaimer: byId('about-disclaimer'),
      playerBar: byId('player-bar'),
      playerAudio: byId('player-audio'),
      playerLabel: byId('player-label'),
      playerMantra: byId('player-mantra'),
      playerToggle: byId('player-toggle'),
      playerPrev: byId('player-prev'),
      playerNext: byId('player-next'),
      playerLoop: byId('player-loop'),
      playerListToggle: byId('player-list-toggle'),
      playerTime: byId('player-time'),
      playerDuration: byId('player-duration'),
      playerSeek: byId('player-seek'),
      playerStatus: byId('player-status'),
      playlistDrawer: byId('playlist-drawer'),
      playlist: byId('playlist'),
      playlistEmpty: byId('playlist-empty'),
      playlistClose: byId('playlist-close'),
      mantraModal: byId('mantra-modal'),
      modalBody: byId('modal-body'),
      modalClose: byId('modal-close'),
      toastRoot: byId('toast-root')
    };
    els.tabButtons = els.tabs ? Array.prototype.slice.call(els.tabs.querySelectorAll('[data-tab]')) : [];
  }

  /* =========================================================
     7. 資料來源判斷
     ========================================================= */
  function resolveData() {
    var raw = global.FO_DATA;
    if (raw && typeof raw === 'object') {
      var hasShape = Array.isArray(raw.mantras) ||
        (raw.curriculum && Array.isArray(raw.curriculum.days));
      if (hasShape) {
        try {
          return { data: normalizeData(raw), isDemo: false, invalid: false };
        } catch (e) {
          if (global.console) { global.console.error('[佛學系統] data.js 解析失敗', e); }
        }
      }
      return { data: normalizeData(FO_DEMO), isDemo: true, invalid: true };
    }
    return { data: normalizeData(FO_DEMO), isDemo: true, invalid: false };
  }

  /* =========================================================
     8. 初始化
     ========================================================= */
  function init() {
    if (!doc) { return; }
    cacheEls();

    var resolved = resolveData();
    DATA = resolved.data;
    IS_DEMO = resolved.isDemo;

    state = normalizeState(storeRead());
    pruneOldCurriculum();

    if (IS_DEMO) {
      showBanner(
        resolved.invalid ? 'data.js 格式有問題' : '示範資料',
        resolved.invalid
          ? '偵測到 data.js，但內容格式唔完整，暫時用內置示範資料顯示；請修正 data.js 後重新載入。'
          : '未偵測到 data.js，以下內容係內置示範資料，只作版面同功能示範；正式內容以 data.js 為準。'
      );
    }
    if (!storageAvailable) { noteStorageIssue(); }

    playlist = buildPlaylist(DATA);

    var suggested = suggestedDayNumber(state.records, DATA.curriculum.cycleLength, todayISO());
    openDays = {};
    if (suggested) { openDays[suggested] = true; }
    ensureToday();

    applySettings();
    buildCategoryChips();
    bindEvents();
    renderAll();
    initPlayer();
    setupBackgroundPlayback();

    var initialTab = TABS.indexOf(state.settings.lastTab) !== -1 ? state.settings.lastTab : 'home';
    goTab(initialTab, false);

    dateTimer = global.setInterval(onTick, 30000);
    if (global.addEventListener) {
      global.addEventListener('focus', onTick);
      doc.addEventListener('visibilitychange', function () {
        if (!doc.hidden) { onTick(); }
      });
    }

    if (global.console && global.console.info) {
      global.console.info('[佛學系統] 載入完成：' +
        DATA.mantras.length + ' 個法門、' +
        playlist.length + ' 個音檔；' +
        (IS_DEMO ? '示範資料' : 'data.js'));
    }
  }

  function showBanner(title, text) {
    if (!els.banner) { return; }
    els.bannerTitle.textContent = title;
    els.bannerText.textContent = text;
    els.banner.hidden = false;
  }

  function applySettings() {
    var big = !!state.settings.bigText;
    if (doc.documentElement.classList) {
      doc.documentElement.classList.toggle('big-text', big);
    } else {
      doc.documentElement.className = big ? 'big-text' : '';
    }
    if (els.fontsizeToggle) {
      els.fontsizeToggle.setAttribute('aria-pressed', big ? 'true' : 'false');
      els.fontsizeToggle.textContent = big ? '標準字' : '大字';
    }
    if (els.playerAudio) {
      els.playerAudio.loop = !!state.settings.loop;
    }
    if (els.playerLoop) {
      els.playerLoop.setAttribute('aria-pressed', state.settings.loop ? 'true' : 'false');
    }
    syncSoundButton();
  }

  /* =========================================================
     9. 分頁
     ========================================================= */
  function goTab(name, scrollTop) {
    if (TABS.indexOf(name) === -1) { name = 'home'; }
    currentTab = name;

    els.tabButtons.forEach(function (button) {
      var isActive = button.getAttribute('data-tab') === name;
      if (button.classList) { button.classList.toggle('is-active', isActive); }
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
      button.tabIndex = isActive ? 0 : -1;
    });

    TABS.forEach(function (tab) {
      var panel = byId('panel-' + tab);
      if (panel && panel.classList) { panel.classList.toggle('is-active', tab === name); }
    });

    if (name === 'home') { renderHome(); }
    else if (name === 'library') { renderLibrary(); }
    else if (name === 'practice') { renderPractice(); }
    else if (name === 'records') { renderRecords(); }
    else if (name === 'about') { renderAbout(); }

    if (state.settings.lastTab !== name) {
      state.settings.lastTab = name;
      saveState();
    }
    if (scrollTop !== false) {
      try {
        global.scrollTo({ top: 0, behavior: 'auto' });
      } catch (e) {
        global.scrollTo(0, 0);
      }
    }
  }

  function handleGotoButton(button) {
    var tab = button.getAttribute('data-goto');
    var focusId = button.getAttribute('data-focus');
    var dayAttr = button.getAttribute('data-day');
    goTab(tab, true);

    global.setTimeout(function () {
      if (focusId) {
        var target = byId(focusId);
        if (target) {
          if (focusId === 'counter-section' && els.counterBtn) {
            try { els.counterBtn.focus(); } catch (e) { /* ignore */ }
          }
          if (target.scrollIntoView) {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
        return;
      }
      if (tab === 'practice') {
        var dayNumber = dayAttr ? Number(dayAttr) :
          suggestedDayNumber(state.records, DATA.curriculum.cycleLength, todayISO());
        if (dayNumber) {
          openDays[dayNumber] = true;
          renderPractice();
          var card = doc.querySelector('[data-day-card="' + dayNumber + '"]');
          if (card && card.scrollIntoView) {
            card.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      }
    }, 50);
  }

  /* =========================================================
     10. 渲染：共用
     ========================================================= */
  function setTodayLabel() {
    var now = new Date();
    if (els.todayChip) { els.todayChip.textContent = formatShortDate(now); }
  }

  function statCard(label, value, note) {
    var card = el('div', 'stat-card');
    card.appendChild(el('span', 'stat-label', label));
    card.appendChild(el('span', 'stat-value', value));
    if (note) { card.appendChild(el('span', 'stat-note', note)); }
    return card;
  }

  function renderStatRow(container, items) {
    if (!container) { return; }
    clear(container);
    items.forEach(function (item) {
      container.appendChild(statCard(item.label, item.value, item.note));
    });
  }

  function findMantra(id) {
    if (!DATA || !Array.isArray(DATA.mantras)) { return null; }
    for (var i = 0; i < DATA.mantras.length; i++) {
      if (DATA.mantras[i].id === id) { return DATA.mantras[i]; }
    }
    return null;
  }

  function findDay(dayNumber) {
    var days = DATA && DATA.curriculum ? DATA.curriculum.days : [];
    for (var i = 0; i < days.length; i++) {
      if (days[i].day === dayNumber) { return days[i]; }
    }
    return days[dayNumber - 1] || null;
  }

  function firstTrackIndexForMantra(mantraId) {
    for (var i = 0; i < playlist.length; i++) {
      if (playlist[i].mantraId === mantraId) { return i; }
    }
    return -1;
  }

  function trackIndexFor(mantraId, file) {
    for (var i = 0; i < playlist.length; i++) {
      if (playlist[i].mantraId === mantraId && playlist[i].file === file) { return i; }
    }
    return -1;
  }

  function greetingTitle(now) {
    var h = now.getHours();
    if (h < 5) { return '夜深了，宜安住身心'; }
    if (h < 11) { return '晨光初現，願你身心清明'; }
    if (h < 14) { return '日正當午，願你安住當下'; }
    if (h < 18) { return '午後時分，願你心不散亂'; }
    return '夜漸深，願你歇息安穩';
  }

  /* =========================================================
     11. 渲染：首頁
     ========================================================= */
  function renderHome() {
    if (!els.homeStats) { return; }
    ensureToday();
    var now = new Date();
    var today = todayISO();
    setTodayLabel();

    if (els.homeDate) { els.homeDate.textContent = formatZhDate(now); }
    if (els.homeGreeting) { els.homeGreeting.textContent = greetingTitle(now); }

    var streakInfo = computeStreak(state.records, today);
    var stats = recordStats(state.records, today);
    var count = state.counter.count;

    renderStatRow(els.homeStats, [
      {
        label: '連續日數',
        value: streakInfo.streak > 0 ? streakInfo.streak + ' 日' : '—',
        note: streakInfo.doneToday ? '今日已完成' : (streakInfo.streak > 0 ? '今日尚未完成' : '由今日開始')
      },
      {
        label: '今日功課',
        value: streakInfo.doneToday ? '已完成' : '未完成',
        note: streakInfo.doneToday ? '隨喜功德' : '108 遍或手動標記'
      },
      { label: '本日持誦', value: count + ' 遍', note: '目標 108 遍' },
      { label: '本月完成', value: stats.month + ' 日', note: '累計 ' + stats.total + ' 日' }
    ]);

    renderHomeToday();
    renderFeatured();
  }

  function renderHomeToday() {
    if (!els.homeToday) { return; }
    clear(els.homeToday);
    var suggested = suggestedDayNumber(state.records, DATA.curriculum.cycleLength, todayISO());
    var day = findDay(suggested);
    if (!day) {
      els.homeToday.appendChild(el('p', 'empty-note', 'data.js 未有次第資料，可先到咒音庫自由持誦。'));
      return;
    }
    var doneToday = computeStreak(state.records, todayISO()).doneToday;
    els.homeToday.appendChild(el('p', 'today-kicker', '第 ' + day.day + ' 日・' + (doneToday ? '今日功課已完成' : '建議今日修學')));
    els.homeToday.appendChild(el('p', 'today-title', day.title));
    if (day.focus) { els.homeToday.appendChild(el('p', 'today-focus', day.focus)); }

    var list = el('ul', 'today-steps');
    day.steps.slice(0, 4).forEach(function (step) {
      var li = el('li');
      li.appendChild(el('span', 'today-min', step.minutes > 0 ? step.minutes + ' 分' : '—'));
      li.appendChild(el('span', null, step.action));
      list.appendChild(li);
    });
    if (day.steps.length > 4) {
      list.appendChild(el('li', null, '（其餘 ' + (day.steps.length - 4) + ' 個步驟，請到「修行次第」查看）'));
    }
    els.homeToday.appendChild(list);

    var actions = el('div', 'hero-actions');
    var goPractice = el('button', 'btn btn-primary', '查看今日次第');
    goPractice.type = 'button';
    goPractice.setAttribute('data-goto', 'practice');
    goPractice.setAttribute('data-day', String(day.day));
    var goLibrary = el('button', 'btn btn-quiet', '咒音庫');
    goLibrary.type = 'button';
    goLibrary.setAttribute('data-goto', 'library');
    actions.appendChild(goPractice);
    actions.appendChild(goLibrary);
    els.homeToday.appendChild(actions);
  }

  function renderFeatured() {
    if (!els.homeFeatured) { return; }
    clear(els.homeFeatured);
    var picks = DATA.mantras.filter(function (mantra) { return mantra.audio.length > 0; }).slice(0, 3);
    if (!picks.length) { picks = DATA.mantras.slice(0, 3); }
    if (!picks.length) {
      els.homeFeatured.appendChild(el('p', 'empty-note', '未有咒音資料。'));
      return;
    }
    picks.forEach(function (mantra) {
      var card = el('article', 'mini-card');
      card.appendChild(el('h4', 'mini-title', mantra.title));
      card.appendChild(el('p', 'mini-meta', mantra.category + (mantra.source ? '・' + mantra.source : '')));
      var actions = el('div', 'mini-actions');
      var trackIndex = firstTrackIndexForMantra(mantra.id);
      var play = el('button', 'btn', trackIndex >= 0 ? '播放' : '未配對音檔');
      play.type = 'button';
      if (trackIndex >= 0) {
        play.setAttribute('data-action', 'play-track');
        play.setAttribute('data-track', String(trackIndex));
      } else {
        play.disabled = true;
      }
      var detail = el('button', 'btn btn-quiet', '詳情');
      detail.type = 'button';
      detail.setAttribute('data-action', 'detail');
      detail.setAttribute('data-id', mantra.id);
      actions.appendChild(play);
      actions.appendChild(detail);
      card.appendChild(actions);
      els.homeFeatured.appendChild(card);
    });
  }

  /* =========================================================
     12. 渲染：咒音庫
     ========================================================= */
  function buildCategoryChips() {
    if (!els.categoryChips) { return; }
    clear(els.categoryChips);
    var categories = categoryList(DATA.mantras);

    var all = el('button', 'chip is-on', '全部');
    all.type = 'button';
    all.setAttribute('data-category', '全部');
    all.appendChild(el('span', 'chip-count', String(DATA.mantras.length)));
    els.categoryChips.appendChild(all);

    categories.forEach(function (category) {
      var count = DATA.mantras.filter(function (mantra) {
        return mantra.category === category;
      }).length;
      var chip = el('button', 'chip', category);
      chip.type = 'button';
      chip.setAttribute('data-category', category);
      chip.appendChild(el('span', 'chip-count', String(count)));
      els.categoryChips.appendChild(chip);
    });
  }

  function updateChips() {
    if (!els.categoryChips) { return; }
    var chips = els.categoryChips.querySelectorAll('[data-category]');
    Array.prototype.forEach.call(chips, function (chip) {
      var active = chip.getAttribute('data-category') === libFilter.category;
      if (chip.classList) { chip.classList.toggle('is-on', active); }
    });
  }

  function mantraCard(mantra) {
    var card = el('article', 'mantra-card');
    card.setAttribute('data-mantra-card', mantra.id);

    var top = el('div', 'card-top');
    var title = el('h3', 'card-title');
    var titleButton = el('button', 'linklike', mantra.title);
    titleButton.type = 'button';
    titleButton.setAttribute('data-action', 'detail');
    titleButton.setAttribute('data-id', mantra.id);
    title.appendChild(titleButton);
    top.appendChild(title);
    top.appendChild(el('span', 'badge ' + (mantra.category === SPIRITUAL_CATEGORY ? 'badge-warn' : 'badge-cat'), mantra.category));
    card.appendChild(top);

    var sourceLine = mantra.source;
    if (mantra.tradition) { sourceLine += '・' + mantra.tradition; }
    card.appendChild(el('p', 'card-source', sourceLine));

    if (mantra.summary) {
      card.appendChild(el('p', 'card-summary', mantra.summary));
    }
    if (mantra.alias.length) {
      card.appendChild(el('p', 'card-source', '別名：' + mantra.alias.join('、')));
    }

    if (mantra.tags.length) {
      var tags = el('p', 'card-tags');
      mantra.tags.forEach(function (tag) { tags.appendChild(el('span', 'tag', tag)); });
      card.appendChild(tags);
    }

    var actions = el('div', 'card-actions');
    var trackIndex = firstTrackIndexForMantra(mantra.id);
    var play = el('button', 'btn', trackIndex >= 0 ? '播放音檔' : '未配對音檔');
    play.type = 'button';
    if (trackIndex >= 0) {
      play.setAttribute('data-action', 'play-track');
      play.setAttribute('data-track', String(trackIndex));
    } else {
      play.disabled = true;
    }
    var detail = el('button', 'btn btn-quiet', '詳情');
    detail.type = 'button';
    detail.setAttribute('data-action', 'detail');
    detail.setAttribute('data-id', mantra.id);
    actions.appendChild(play);
    actions.appendChild(detail);
    card.appendChild(actions);

    return card;
  }

  function renderLibrary() {
    if (!els.mantraGrid) { return; }
    var list = filterMantras(DATA.mantras, libFilter.query, libFilter.category);
    clear(els.mantraGrid);
    list.forEach(function (mantra) {
      els.mantraGrid.appendChild(mantraCard(mantra));
    });

    if (els.libraryCount) {
      var text = '共 ' + DATA.mantras.length + ' 個法門';
      if (list.length !== DATA.mantras.length) { text += '，顯示 ' + list.length + ' 個'; }
      els.libraryCount.textContent = text;
    }
    if (els.libraryEmpty) { els.libraryEmpty.hidden = list.length > 0; }
    updateChips();

    if (els.nonBuddhistNote) {
      var spiritualNote = DATA.meta.nonBuddhistNote;
      if (spiritualNote) {
        els.nonBuddhistNote.hidden = false;
        els.nonBuddhistNote.textContent = '類別說明：' + spiritualNote;
      } else {
        els.nonBuddhistNote.hidden = true;
      }
    }
  }

  /* =========================================================
     13. 渲染：修行次第
     ========================================================= */
  function updateDayCardProgress(dayNumber) {
    var day = findDay(dayNumber);
    var card = doc.querySelector('[data-day-card="' + dayNumber + '"]');
    if (!day || !card) { return; }
    var checked = 0;
    day.steps.forEach(function (step, index) {
      if (isStepChecked(dayNumber, index)) { checked++; }
    });
    var progress = card.querySelector('.day-progress');
    if (progress) {
      progress.textContent = checked + '/' + day.steps.length;
      if (progress.classList) {
        progress.classList.toggle('is-full', day.steps.length > 0 && checked === day.steps.length);
      }
    }
  }

  function dayCard(day, index, suggestedDay) {
    var dayNumber = day.day || (index + 1);
    var steps = day.steps || [];
    var checkedCount = 0;
    steps.forEach(function (step, stepIndex) {
      if (isStepChecked(dayNumber, stepIndex)) { checkedCount++; }
    });
    var isOpen = !!openDays[dayNumber];

    var card = el('article', 'day-card' + (dayNumber === suggestedDay ? ' is-today' : ''));
    card.setAttribute('data-day-card', String(dayNumber));

    var head = el('button', 'day-head');
    head.type = 'button';
    head.setAttribute('data-day-toggle', String(dayNumber));
    head.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    head.setAttribute('aria-controls', 'day-panel-' + dayNumber);
    head.setAttribute('aria-label', '第 ' + dayNumber + ' 日 ' + day.title + '，' + (isOpen ? '收起步驟' : '展開步驟'));

    head.appendChild(el('span', 'day-index', String(dayNumber)));
    var summary = el('span', 'day-summary-main');
    summary.appendChild(el('span', 'day-title', (dayNumber === suggestedDay ? '今日・' : '') + day.title));
    if (day.focus) { summary.appendChild(el('span', 'day-focus', day.focus)); }
    head.appendChild(summary);
    head.appendChild(el('span', 'day-progress' + (steps.length > 0 && checkedCount === steps.length ? ' is-full' : ''), checkedCount + '/' + steps.length));
    head.appendChild(el('span', 'day-chevron', '›'));
    card.appendChild(head);

    var panelId = 'day-panel-' + dayNumber;
    var panel = el('div', 'day-panel');
    panel.id = panelId;
    if (!isOpen) { panel.hidden = true; }

    var list = el('ol', 'step-list');
    steps.forEach(function (step, stepIndex) {
      list.appendChild(stepRow(dayNumber, step, stepIndex));
    });
    panel.appendChild(list);
    card.appendChild(panel);

    return card;
  }

  function stepRow(dayNumber, step, stepIndex) {
    var checked = isStepChecked(dayNumber, stepIndex);
    var row = el('li', 'step-row');

    var checkbox = doc.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'step-check';
    checkbox.checked = checked;
    checkbox.setAttribute('data-step-day', String(dayNumber));
    checkbox.setAttribute('data-step-index', String(stepIndex));
    checkbox.setAttribute('aria-label', '第 ' + dayNumber + ' 日步驟：' + step.action);
    row.appendChild(checkbox);

    var body = el('div', 'step-body');
    body.appendChild(el('p', 'step-action' + (checked ? ' is-checked' : ''), step.action));

    var meta = el('div', 'step-meta');
    meta.appendChild(el('span', 'step-min', step.minutes > 0 ? step.minutes + ' 分鐘' : '不計時'));
    var mantra = step.mantraId ? findMantra(step.mantraId) : null;
    if (step.mantraId && !mantra) {
      meta.appendChild(el('span', 'step-mantra', '法門：' + step.mantraId));
    } else if (mantra) {
      meta.appendChild(el('span', 'step-mantra', '法門：' + mantra.title));
    }
    body.appendChild(meta);

    if (mantra) {
      var actions = el('div', 'step-actions');
      var detail = el('button', 'btn btn-quiet', '看咒語');
      detail.type = 'button';
      detail.setAttribute('data-action', 'detail');
      detail.setAttribute('data-id', mantra.id);
      actions.appendChild(detail);
      var trackIndex = firstTrackIndexForMantra(mantra.id);
      if (trackIndex >= 0) {
        var play = el('button', 'btn', '播放音檔');
        play.type = 'button';
        play.setAttribute('data-action', 'play-track');
        play.setAttribute('data-track', String(trackIndex));
        actions.appendChild(play);
      }
      body.appendChild(actions);
    }

    row.appendChild(body);
    return row;
  }

  function renderPractice() {
    if (!els.curriculumList) { return; }
    var suggested = suggestedDayNumber(state.records, DATA.curriculum.cycleLength, todayISO());
    var day = findDay(suggested);

    if (els.practiceToday) {
      clear(els.practiceToday);
      if (day) {
        var strong = el('strong', null, '今日建議：第 ' + day.day + ' 日・' + day.title);
        els.practiceToday.appendChild(strong);
        if (day.focus) { els.practiceToday.appendChild(doc.createTextNode('　' + day.focus)); }
        if (DATA.curriculum.totalMinutesHint) {
          els.practiceToday.appendChild(doc.createTextNode('（' + DATA.curriculum.totalMinutesHint +
            (DATA.curriculum.weeks > 1 ? '・共 ' + DATA.curriculum.weeks + ' 週' : '') + '）'));
        }
      } else {
        els.practiceToday.textContent = 'data.js 未有次第資料，可先到咒音庫自由持誦。';
      }
    }

    if (els.guidelines) {
      clear(els.guidelines);
      var guidelines = DATA.curriculum.guidelines;
      if (guidelines.length) {
        els.guidelines.hidden = false;
        els.guidelines.appendChild(el('h3', 'guidelines-title', '修行通則'));
        var ul = el('ul');
        guidelines.forEach(function (line) { ul.appendChild(el('li', null, line)); });
        els.guidelines.appendChild(ul);
      } else {
        els.guidelines.hidden = true;
      }
    }

    if (els.weekEmphasis) {
      clear(els.weekEmphasis);
      var weekLines = DATA.curriculum.weekEmphasis;
      if (weekLines.length) {
        els.weekEmphasis.hidden = false;
        els.weekEmphasis.appendChild(el('h3', 'guidelines-title',
          (DATA.curriculum.weeks > 0 ? DATA.curriculum.weeks + ' 週進程' : '進程提示')));
        var weekList = el('ul');
        weekLines.forEach(function (line) { weekList.appendChild(el('li', null, line)); });
        els.weekEmphasis.appendChild(weekList);
      } else {
        els.weekEmphasis.hidden = true;
      }
    }

    clear(els.curriculumList);
    if (!DATA.curriculum.days.length) {
      els.curriculumList.appendChild(el('p', 'empty-note', '未設定修行次第；可到咒音庫自由持誦。'));
    } else {
      DATA.curriculum.days.forEach(function (item, index) {
        els.curriculumList.appendChild(dayCard(item, index, suggested));
      });
    }

    renderCounter();
    renderRituals();
  }

  function renderRituals() {
    if (!els.ritualsBlock || !els.ritualsList) { return; }
    clear(els.ritualsList);
    if (!DATA.rituals.length) {
      els.ritualsBlock.hidden = true;
      return;
    }
    els.ritualsBlock.hidden = false;
    DATA.rituals.forEach(function (ritual) {
      var card = el('div', 'ritual-card');
      card.appendChild(el('h4', 'ritual-title', ritual.title + (ritual.when ? '（' + ritual.when + '）' : '')));
      var list = el('ol', 'rule-list');
      ritual.steps.forEach(function (step) { list.appendChild(el('li', null, step)); });
      card.appendChild(list);
      els.ritualsList.appendChild(card);
    });
  }

  /* =========================================================
     14. 計數器
     ========================================================= */
  function ringLength() {
    return 2 * Math.PI * 96;
  }

  function updateCounterRing() {
    if (!els.counterRing) { return; }
    var progress = Math.min(state.counter.count, TARGET);
    var length = ringLength();
    els.counterRing.style.strokeDasharray = length + 'px';
    els.counterRing.style.strokeDashoffset = (length * (1 - progress / TARGET)) + 'px';
  }

  function syncSoundButton() {
    if (!els.counterSound) { return; }
    var on = !!state.settings.beep;
    els.counterSound.textContent = '提示音：' + (on ? '開' : '關');
    els.counterSound.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  function renderCounter() {
    if (!els.counterCount) { return; }
    ensureToday();
    var count = state.counter.count;
    var progress = Math.min(count, TARGET);
    var rounds = Math.floor(count / TARGET);

    els.counterCount.textContent = String(progress);
    if (els.counterToday) { els.counterToday.textContent = String(count); }
    updateCounterRing();

    if (els.counterRounds) {
      if (rounds >= 1) {
        els.counterRounds.hidden = false;
        els.counterRounds.textContent = '已完成 ' + rounds + ' 輪 108 遍' +
          (state.records[todayISO()] ? '，今日功課已記錄。' : '。');
      } else {
        els.counterRounds.hidden = true;
        els.counterRounds.textContent = '';
      }
    }

    if (els.counterDataHint) {
      var countingHint = DATA.meta.countingHint;
      if (countingHint) {
        els.counterDataHint.hidden = false;
        els.counterDataHint.textContent = countingHint;
      } else {
        els.counterDataHint.hidden = true;
        els.counterDataHint.textContent = '';
      }
    }

    var done = count >= TARGET;
    if (els.counterDone) { els.counterDone.hidden = !done; }
    if (done && els.counterLog) {
      var recorded = !!state.records[todayISO()];
      els.counterLogNote.textContent = recorded ? '今日功課已記錄。' : '';
      els.counterLog.textContent = recorded ? '更新今日功課紀錄' : '記錄今日功課';
    }
    els.counterBtn.setAttribute('aria-label', '計數一次（本日 ' + count + ' 遍，目標 108 遍）');
    syncSoundButton();
  }

  function getAudioContext() {
    if (!state.settings.beep) { return null; }
    var Ctx = global.AudioContext || global.webkitAudioContext;
    if (!Ctx) { return null; }
    if (!audioCtx) {
      try {
        audioCtx = new Ctx();
      } catch (e) {
        audioCtx = null;
        return null;
      }
    }
    if (audioCtx.state === 'suspended') {
      try { audioCtx.resume(); } catch (e) { /* ignore */ }
    }
    return audioCtx;
  }

  function tone(frequency, duration, delay, volume) {
    var ctx = getAudioContext();
    if (!ctx) { return; }
    try {
      var oscillator = ctx.createOscillator();
      var gain = ctx.createGain();
      var start = ctx.currentTime + (delay || 0);
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume || 0.05, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.03);
    } catch (e) { /* 靜默失敗 */ }
  }

  function tickSound() {
    tone(760, 0.07, 0, 0.045);
  }

  function chimeSound() {
    var notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach(function (frequency, index) {
      tone(frequency, 0.65, index * 0.16, 0.065);
    });
  }

  function pulseCounterButton() {
    if (!els.counterBtn || !els.counterBtn.classList) { return; }
    els.counterBtn.classList.remove('pulse');
    /* 強制 reflow，令動畫可以重播 */
    void els.counterBtn.offsetWidth;
    els.counterBtn.classList.add('pulse');
    global.setTimeout(function () {
      if (els.counterBtn && els.counterBtn.classList) {
        els.counterBtn.classList.remove('pulse');
      }
    }, 260);
  }

  function incrementCounter() {
    ensureToday();
    state.counter.count += 1;
    saveState();
    renderCounter();
    pulseCounterButton();
    if (state.counter.count % TARGET === 0) {
      chimeSound();
      showToast('108 遍完成，願此功德迴向眾生。');
    } else {
      tickSound();
    }
  }

  function resetCounter() {
    state.counter.count = 0;
    saveState();
    renderCounter();
    showToast('計數已歸零。');
  }

  function toggleBeep() {
    state.settings.beep = !state.settings.beep;
    saveState();
    syncSoundButton();
    if (state.settings.beep) { tickSound(); }
  }

  function logPractice() {
    var today = todayISO();
    var rounds = Math.floor(state.counter.count / TARGET);
    state.records[today] = {
      done: true,
      rounds: rounds,
      ts: new Date().toISOString(),
      source: 'counter'
    };
    saveState();
    renderAll();
    showToast('已記錄今日功課，願此功德迴向眾生。');
  }

  /* =========================================================
     15. 功課紀錄
     ========================================================= */
  function toggleTodayRecord() {
    var today = todayISO();
    if (state.records[today] && state.records[today].done !== false) {
      delete state.records[today];
      showToast('已取消今日紀錄。');
    } else {
      state.records[today] = {
        done: true,
        rounds: Math.floor(state.counter.count / TARGET),
        ts: new Date().toISOString(),
        source: 'manual'
      };
      showToast('已標記今日功課完成。');
    }
    saveState();
    renderHome();
    renderRecords();
    renderPractice();
  }

  function toggleRecord(dateIso) {
    var date = parseISO(dateIso);
    if (!date) { return; }
    if (dateIso > todayISO()) { return; }
    if (state.records[dateIso] && state.records[dateIso].done !== false) {
      delete state.records[dateIso];
      showToast('已取消 ' + (date.getMonth() + 1) + '月' + date.getDate() + '日 的紀錄。');
    } else {
      state.records[dateIso] = {
        done: true,
        rounds: dateIso === todayISO() ? Math.floor(state.counter.count / TARGET) : 0,
        ts: new Date().toISOString(),
        source: 'history'
      };
      showToast('已補記 ' + (date.getMonth() + 1) + '月' + date.getDate() + '日 的功課。');
    }
    saveState();
    renderHome();
    renderRecords();
    renderPractice();
  }

  function renderRecords() {
    if (!els.recordToday) { return; }
    var today = todayISO();
    var record = state.records[today];
    var done = !!(record && record.done !== false);

    if (els.recordToday) {
      clear(els.recordToday);
      if (els.recordToday.classList) { els.recordToday.classList.toggle('is-done', done); }
      els.recordToday.appendChild(el('p', 'status-kicker', '今日功課'));
      els.recordToday.appendChild(el('p', 'status-value', done ? '已完成' : '尚未完成'));
      var note = done
        ? '已記錄' + (record.ts ? '：' + formatClock(new Date(record.ts)) : '') + '，隨喜。'
        : '完成 108 遍後可記錄，或喺下面手動標記。';
      els.recordToday.appendChild(el('p', 'status-note', note));
    }

    var streakInfo = computeStreak(state.records, today);
    var stats = recordStats(state.records, today);
    var last30 = 0;
    var startDate = addDays(new Date(), -29);
    for (var i = 0; i < 30; i++) {
      var iso = isoDate(addDays(startDate, i));
      if (state.records[iso] && state.records[iso].done !== false) { last30++; }
    }

    renderStatRow(els.recordsStats, [
      { label: '連續日數', value: streakInfo.streak > 0 ? streakInfo.streak + ' 日' : '—', note: streakInfo.doneToday ? '今日已計入' : '斷一日即重新計' },
      { label: '最近 30 日', value: last30 + ' 日', note: '有紀錄嘅日數' },
      { label: '本月完成', value: stats.month + ' 日', note: '累計 ' + stats.total + ' 日' }
    ]);

    if (els.recordsMarkToday) {
      els.recordsMarkToday.textContent = done ? '取消今日紀錄' : '標記今日完成';
    }

    if (els.historyGrid) {
      clear(els.historyGrid);
      for (var j = 0; j < 30; j++) {
        var date = addDays(startDate, j);
        var dateIso = isoDate(date);
        var isDone = !!(state.records[dateIso] && state.records[dateIso].done !== false);
        var cell = doc.createElement('button');
        cell.type = 'button';
        cell.className = 'history-cell';
        cell.setAttribute('data-date', dateIso);
        if (isDone) { cell.classList.add('is-done'); }
        if (dateIso === today) { cell.classList.add('is-today'); }
        cell.setAttribute('aria-label', formatZhDate(date) + (isDone ? '：已記錄，按一下取消' : '：未記錄，按一下補記'));
        cell.setAttribute('title', formatZhDate(date) + (isDone ? '・已記錄' : '・未記錄'));
        cell.appendChild(el('span', 'history-day', String(date.getDate())));
        cell.appendChild(el('span', 'history-week', '週' + weekdayName(date)));
        els.historyGrid.appendChild(cell);
      }
    }
  }

  function onResetRecords() {
    if (!resetArmed) {
      resetArmed = true;
      els.recordsReset.textContent = '再按一次確認重設';
      if (els.recordsResetNote) {
        els.recordsResetNote.textContent = '重設會清除全部功課紀錄、次第勾選同計數，無法復原。';
      }
      resetTimer = global.setTimeout(disarmReset, 6000);
      return;
    }
    disarmReset();
    state.records = {};
    state.curriculum = {};
    state.counter = { date: todayISO(), count: 0 };
    saveState();
    renderAll();
    showToast('已重設全部進度。');
  }

  function disarmReset() {
    resetArmed = false;
    if (resetTimer) { global.clearTimeout(resetTimer); resetTimer = null; }
    if (els.recordsReset) { els.recordsReset.textContent = '重設進度'; }
    if (els.recordsResetNote) { els.recordsResetNote.textContent = ''; }
  }

  /* =========================================================
     16. 關於
     ========================================================= */
  function renderAbout() {
    if (!els.aboutMeta) { return; }
    var meta = DATA.meta;
    clear(els.aboutMeta);

    function metaRow(key, value) {
      var row = el('div', 'meta-row');
      row.appendChild(el('dt', 'meta-key', key));
      row.appendChild(el('dd', 'meta-val', value || '—'));
      els.aboutMeta.appendChild(row);
    }

    var audioCount = playlist.length;
    metaRow('系統名稱', meta.title);
    metaRow('版本', meta.version);
    if (meta.updated) { metaRow('更新日期', meta.updated); }
    metaRow('資料來源', IS_DEMO ? '內置示範資料（未接上 data.js）' : '佛學系統／data.js');
    metaRow('法門數目', DATA.mantras.length + ' 項');
    metaRow('音檔數目', audioCount + ' 個');
    metaRow('次第日數', DATA.curriculum.days.length + ' 日一循環' +
      (DATA.curriculum.weeks > 1 ? '・共 ' + DATA.curriculum.weeks + ' 週' : ''));
    if (meta.nonBuddhistNote) { metaRow('靈性素材說明', meta.nonBuddhistNote); }
    if (meta.countingHint) { metaRow('計數提示', meta.countingHint); }

    if (els.aboutLineage) { els.aboutLineage.textContent = meta.lineage; }
    if (els.aboutDisclaimer) { els.aboutDisclaimer.textContent = meta.disclaimer; }
    if (els.footVersion) { els.footVersion.textContent = meta.title + ' v' + meta.version; }

    if (els.aboutReferencesBlock && els.aboutReferences) {
      clear(els.aboutReferences);
      if (DATA.references.length) {
        els.aboutReferencesBlock.hidden = false;
        DATA.references.forEach(function (ref) {
          var li = el('li');
          if (/^https?:\/\//i.test(ref.url)) {
            var link = doc.createElement('a');
            link.href = ref.url;
            link.textContent = ref.label;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            li.appendChild(link);
          } else {
            li.appendChild(doc.createTextNode(ref.label));
          }
          if (ref.note) { li.appendChild(doc.createTextNode('　' + ref.note)); }
          els.aboutReferences.appendChild(li);
        });
      } else {
        els.aboutReferencesBlock.hidden = true;
      }
    }
  }

  /* =========================================================
     17. 詳情視窗
     ========================================================= */
  function detailSection(label) {
    var section = el('section', 'detail-section');
    section.appendChild(el('p', 'detail-label', label));
    return section;
  }

  function renderMantraDetail(mantra) {
    if (!els.modalBody) { return; }
    clear(els.modalBody);

    var head = el('header', 'detail-head');
    var title = el('h2', 'detail-title', mantra.title);
    title.id = 'modal-title';
    head.appendChild(title);
    if (mantra.alias.length) {
      head.appendChild(el('p', 'detail-alias', '別名：' + mantra.alias.join('、')));
    }
    var badges = el('div', 'detail-badges');
    badges.appendChild(el('span', 'badge ' + (mantra.category === SPIRITUAL_CATEGORY ? 'badge-warn' : 'badge-cat'), mantra.category));
    if (mantra.tradition) { badges.appendChild(el('span', 'badge badge-tradition', mantra.tradition)); }
    head.appendChild(badges);
    els.modalBody.appendChild(head);

    if (mantra.category === SPIRITUAL_CATEGORY) {
      els.modalBody.appendChild(el('p', 'detail-warning',
        DATA.meta.nonBuddhistNote ||
        '此項屬「靈性（非佛教）」素材，與佛教正典分開陳列，請自行判別，勿與佛法混同。'));
    }

    if (mantra.summary) {
      var summary = detailSection('簡介');
      summary.appendChild(el('p', null, mantra.summary));
      els.modalBody.appendChild(summary);
    }

    var source = detailSection('出處');
    source.appendChild(el('p', null, mantra.source));
    if (mantra.sourceNote) {
      source.appendChild(el('p', 'muted', mantra.sourceNote));
    }
    els.modalBody.appendChild(source);

    var han = detailSection('漢譯咒文');
    han.appendChild(el('div', 'mantra-han', mantra.mantraHan || '（未提供）'));
    if (mantra.mantraRoman) {
      han.appendChild(el('p', 'mantra-roman', mantra.mantraRoman));
    }
    els.modalBody.appendChild(han);

    var benefits = detailSection('功德利益');
    if (mantra.benefits.length) {
      var benefitList = el('ul', 'benefit-list');
      mantra.benefits.forEach(function (benefit) {
        var item = el('li', 'benefit-item');
        var label = benefit.type === 'sutra' ? '經說' : (benefit.type === 'tradition' ? '傳統說法' : '其他');
        var tag = el('span', 'benefit-tag' + (benefit.type === 'sutra' ? ' is-sutra' : (benefit.type === 'tradition' ? ' is-tradition' : '')), label);
        item.appendChild(tag);
        item.appendChild(el('span', null, benefit.text));
        benefitList.appendChild(item);
      });
      benefits.appendChild(benefitList);
    } else {
      benefits.appendChild(el('p', 'muted', '（未提供）'));
    }
    els.modalBody.appendChild(benefits);

    var howTo = detailSection('持誦要點');
    if (mantra.howTo.length) {
      var howToList = el('ol');
      mantra.howTo.forEach(function (line) { howToList.appendChild(el('li', null, line)); });
      howTo.appendChild(howToList);
    } else {
      howTo.appendChild(el('p', 'muted', '（未提供）'));
    }
    els.modalBody.appendChild(howTo);

    if (mantra.caution.length) {
      var caution = detailSection('注意');
      var cautionList = el('ul');
      mantra.caution.forEach(function (line) { cautionList.appendChild(el('li', null, line)); });
      caution.appendChild(cautionList);
      els.modalBody.appendChild(caution);
    }

    var audio = detailSection('音檔');
    if (mantra.audio.length) {
      var audioList = el('ul', 'audio-list');
      mantra.audio.forEach(function (track) {
        var row = el('li', 'audio-row');
        row.appendChild(el('span', 'audio-label', track.label || track.file));
        var trackIndex = trackIndexFor(mantra.id, track.file);
        var play = el('button', 'btn', trackIndex >= 0 ? '播放' : '未載入');
        play.type = 'button';
        if (trackIndex >= 0) {
          play.setAttribute('data-action', 'play-track');
          play.setAttribute('data-track', String(trackIndex));
        } else {
          play.disabled = true;
        }
        row.appendChild(play);
        audioList.appendChild(row);
      });
      audio.appendChild(audioList);
    } else {
      audio.appendChild(el('p', 'muted', '未配對音檔（可於 data.js 加入）。'));
    }
    els.modalBody.appendChild(audio);

    if (mantra.tags.length) {
      var tagSection = detailSection('標籤');
      var tagRow = el('div', 'detail-tags');
      mantra.tags.forEach(function (tag) { tagRow.appendChild(el('span', 'tag', tag)); });
      tagSection.appendChild(tagRow);
      els.modalBody.appendChild(tagSection);
    }

    var foot = el('p', 'detail-foot', '本頁內容為個人修學整理，非官方教材；密法觀想／儀軌須依具格上師傳承。身心不適請就醫。');
    els.modalBody.appendChild(foot);
  }

  function openMantraModal(id) {
    var mantra = findMantra(id);
    if (!mantra || !els.mantraModal) { return; }
    lastFocused = doc.activeElement;
    renderMantraDetail(mantra);
    els.mantraModal.hidden = false;
    if (doc.body.classList) { doc.body.classList.add('modal-open'); }
    if (els.modalClose) {
      try { els.modalClose.focus(); } catch (e) { /* ignore */ }
    }
  }

  function closeMantraModal() {
    if (!els.mantraModal || els.mantraModal.hidden) { return; }
    els.mantraModal.hidden = true;
    if (doc.body.classList) { doc.body.classList.remove('modal-open'); }
    if (lastFocused && typeof lastFocused.focus === 'function') {
      try { lastFocused.focus(); } catch (e) { /* ignore */ }
    }
    lastFocused = null;
  }

  /* =========================================================
     18. 播放器
     ========================================================= */
  function setPlayerStatus(message, isError) {
    if (!els.playerStatus) { return; }
    els.playerStatus.textContent = message || '';
    if (els.playerStatus.classList) {
      els.playerStatus.classList.toggle('is-error', !!isError);
    }
  }

  function updatePlayerToggle(playing) {
    if (!els.playerToggle) { return; }
    els.playerToggle.textContent = playing ? '暫停' : '播放';
    els.playerToggle.setAttribute('aria-label', playing ? '暫停' : '播放');
    els.playerToggle.setAttribute('aria-pressed', playing ? 'true' : 'false');
  }

  function updatePlaylistCurrent() {
    if (!els.playlist) { return; }
    var items = els.playlist.querySelectorAll('.playlist-item');
    Array.prototype.forEach.call(items, function (item) {
      var isCurrent = Number(item.getAttribute('data-track')) === currentTrack;
      if (item.classList) { item.classList.toggle('is-current', isCurrent); }
      if (isCurrent) {
        item.setAttribute('aria-current', 'true');
      } else {
        item.removeAttribute('aria-current');
      }
    });
  }

  function renderPlaylistDrawer() {
    if (!els.playlist) { return; }
    clear(els.playlist);
    playlist.forEach(function (track, index) {
      var li = el('li');
      var button = el('button', 'playlist-item');
      button.type = 'button';
      button.setAttribute('data-action', 'playlist');
      button.setAttribute('data-track', String(index));
      button.appendChild(el('span', 'playlist-idx', String(index + 1)));
      var name = el('span', 'playlist-name');
      name.appendChild(el('span', 'playlist-label', track.label || '音檔'));
      name.appendChild(el('span', 'playlist-mantra', track.mantraTitle));
      button.appendChild(name);
      li.appendChild(button);
      els.playlist.appendChild(li);
    });
    if (els.playlistEmpty) { els.playlistEmpty.hidden = playlist.length > 0; }
    updatePlaylistCurrent();
  }

  function resetProgressUI() {
    if (els.playerTime) { els.playerTime.textContent = '0:00'; }
    if (els.playerDuration) { els.playerDuration.textContent = '0:00'; }
    if (els.playerSeek) {
      els.playerSeek.value = 0;
      els.playerSeek.max = 0;
    }
  }

  function loadTrack(index, autoplay) {
    if (!playlist.length || !els.playerAudio) { return; }
    var total = playlist.length;
    index = ((index % total) + total) % total;
    currentTrack = index;
    var track = playlist[index];

    els.playerAudio.src = track.url;
    if (els.playerLabel) {
      els.playerLabel.textContent = track.label || '音檔';
      els.playerLabel.setAttribute('title', track.label || '');
    }
    if (els.playerMantra) { els.playerMantra.textContent = track.mantraTitle || ''; }
    updateMediaSession(track);
    resetProgressUI();
    setPlayerStatus('');
    updatePlayerToggle(false);
    updatePlaylistCurrent();

    try { els.playerAudio.load(); } catch (e) { /* ignore */ }
    if (autoplay) { playAudio(); }
  }

  function playAudio() {
    if (!playlist.length || !els.playerAudio) { return; }
    enableBackgroundPlayback();
    if (currentTrack < 0) { loadTrack(0, false); }
    var promise = null;
    try {
      promise = els.playerAudio.play();
    } catch (e) {
      setPlayerStatus('未能播放：' + asText(e && e.message), true);
      return;
    }
    if (promise && typeof promise.catch === 'function') {
      promise.catch(function () {
        setPlayerStatus('瀏覽器未能開始播放，請再按一次「播放」。', true);
        updatePlayerToggle(false);
      });
    }
  }

  function initPlayer() {
    if (!els.playerAudio) { return; }
    els.playerAudio.loop = !!state.settings.loop;
    if (els.playerLoop) {
      els.playerLoop.setAttribute('aria-pressed', state.settings.loop ? 'true' : 'false');
    }
    renderPlaylistDrawer();
    if (playlist.length) {
      loadTrack(0, false);
    } else {
      if (els.playerLabel) { els.playerLabel.textContent = '未選擇音檔'; }
      setPlayerStatus('此資料集未有音檔。');
      updatePlayerToggle(false);
    }
  }

  function closePlaylistDrawer() {
    if (!els.playlistDrawer) { return; }
    els.playlistDrawer.hidden = true;
    if (els.playerListToggle) { els.playerListToggle.setAttribute('aria-expanded', 'false'); }
  }

  function togglePlaylistDrawer() {
    if (!els.playlistDrawer) { return; }
    if (els.playlistDrawer.hidden) {
      renderPlaylistDrawer();
      els.playlistDrawer.hidden = false;
      if (els.playerListToggle) { els.playerListToggle.setAttribute('aria-expanded', 'true'); }
    } else {
      closePlaylistDrawer();
    }
  }

  function toggleLoop() {
    state.settings.loop = !state.settings.loop;
    saveState();
    if (els.playerAudio) { els.playerAudio.loop = state.settings.loop; }
    if (els.playerLoop) { els.playerLoop.setAttribute('aria-pressed', state.settings.loop ? 'true' : 'false'); }
    showToast(state.settings.loop ? '已開啟單曲循環。' : '已關閉單曲循環。');
  }

  function bindPlayerEvents() {
    var audio = els.playerAudio;
    if (!audio) { return; }

    audio.addEventListener('play', function () {
      enableBackgroundPlayback();
      updatePlayerToggle(true);
      setPlayerStatus('');
      setMediaPlaybackState('playing');
    });
    audio.addEventListener('pause', function () {
      updatePlayerToggle(false);
      setMediaPlaybackState('paused');
    });
    audio.addEventListener('ended', function () {
      updatePlayerToggle(false);
      if (playlist.length && currentTrack < playlist.length - 1) {
        loadTrack(currentTrack + 1, true);
      } else {
        setPlayerStatus('播放清單已完結。');
      }
    });
    audio.addEventListener('durationchange', function () {
      var duration = audio.duration;
      if (isFinite(duration) && duration > 0) {
        if (els.playerSeek) { els.playerSeek.max = Math.floor(duration); }
        if (els.playerDuration) { els.playerDuration.textContent = formatTime(duration); }
      }
    });
    audio.addEventListener('timeupdate', function () {
      var duration = audio.duration;
      if (!isFinite(duration) || duration <= 0) { return; }
      if (els.playerSeek) { els.playerSeek.max = Math.floor(duration); }
      if (!seekDragging && els.playerSeek) {
        els.playerSeek.value = Math.floor(audio.currentTime);
      }
      if (els.playerTime) { els.playerTime.textContent = formatTime(audio.currentTime); }
      if (els.playerDuration) { els.playerDuration.textContent = formatTime(duration); }
      var now = Date.now();
      if (now - lastPositionUpdate > 2000) {
        lastPositionUpdate = now;
        updatePositionState(audio);
      }
    });
    audio.addEventListener('waiting', function () {
      if (!audio.paused) { setPlayerStatus('載入中…'); }
    });
    audio.addEventListener('canplay', function () {
      setPlayerStatus('');
    });
    audio.addEventListener('error', function () {
      setPlayerStatus('音檔載入唔到：可能係路徑、檔案唔存在，或瀏覽器 file:// 限制（建議用 Chrome／Edge）。', true);
      updatePlayerToggle(false);
    });

    if (els.playerToggle) {
      els.playerToggle.addEventListener('click', function () {
        if (audio.paused) { playAudio(); } else { audio.pause(); }
      });
    }
    if (els.playerPrev) {
      els.playerPrev.addEventListener('click', function () {
        if (playlist.length) { loadTrack(currentTrack - 1, true); }
      });
    }
    if (els.playerNext) {
      els.playerNext.addEventListener('click', function () {
        if (playlist.length) { loadTrack(currentTrack + 1, true); }
      });
    }
    if (els.playerLoop) {
      els.playerLoop.addEventListener('click', toggleLoop);
    }
    if (els.playerListToggle) {
      els.playerListToggle.addEventListener('click', togglePlaylistDrawer);
    }
    if (els.playlistClose) {
      els.playlistClose.addEventListener('click', closePlaylistDrawer);
    }
    if (els.playerSeek) {
      els.playerSeek.addEventListener('input', function () {
        seekDragging = true;
        if (els.playerTime) { els.playerTime.textContent = formatTime(els.playerSeek.value); }
      });
      els.playerSeek.addEventListener('change', function () {
        var value = Number(els.playerSeek.value);
        if (audio.duration && isFinite(audio.duration)) {
          try { audio.currentTime = value; } catch (e) { /* ignore */ }
        }
        seekDragging = false;
      });
    }
  }

  /* =========================================================
     18b. 背景播放 / 媒體工作階段 / 安裝（PWA）
     ========================================================= */
  function enableBackgroundPlayback() {
    /* iOS Safari 16.4+：音頻會話設為 playback，鎖屏或切到背景時
       唔會被當成普通網頁音效而暫停。其他瀏覽器冇此 API，安全略過。 */
    try {
      if (global.navigator && global.navigator.audioSession) {
        global.navigator.audioSession.type = 'playback';
      }
    } catch (e) { /* 舊瀏覽器忽略 */ }
  }

  function getMediaSession() {
    try {
      return (global.navigator && global.navigator.mediaSession) || null;
    } catch (e) {
      return null;
    }
  }

  function setMediaPlaybackState(value) {
    var ms = getMediaSession();
    if (!ms) { return; }
    try { ms.playbackState = value; } catch (e) { /* 忽略 */ }
  }

  function updateMediaSession(track) {
    var ms = getMediaSession();
    if (!ms || !track) { return; }
    try {
      if (global.MediaMetadata) {
        ms.metadata = new global.MediaMetadata({
          title: track.label || track.mantraTitle || '佛學系統',
          artist: track.mantraTitle || '佛光靈氣・佛學系統',
          album: '佛光靈氣・佛學系統',
          artwork: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }
          ]
        });
      }
    } catch (e) { /* 忽略 */ }
  }

  function updatePositionState(audio) {
    var ms = getMediaSession();
    if (!ms || typeof ms.setPositionState !== 'function') { return; }
    if (!audio || !isFinite(audio.duration) || audio.duration <= 0) { return; }
    try {
      ms.setPositionState({
        duration: audio.duration,
        playbackRate: audio.playbackRate || 1,
        position: Math.min(audio.currentTime, audio.duration)
      });
    } catch (e) { /* 忽略 */ }
  }

  function seekAudioBy(delta) {
    var audio = els.playerAudio;
    if (!audio || !isFinite(audio.duration) || audio.duration <= 0) { return; }
    var target = Math.min(audio.duration, Math.max(0, audio.currentTime + delta));
    try { audio.currentTime = target; } catch (e) { /* 忽略 */ }
  }

  function setupMediaSessionHandlers() {
    var ms = getMediaSession();
    if (!ms || typeof ms.setActionHandler !== 'function') { return; }
    var handlers = {
      play: function () { playAudio(); },
      pause: function () { if (els.playerAudio) { els.playerAudio.pause(); } },
      stop: function () {
        if (!els.playerAudio) { return; }
        els.playerAudio.pause();
        try { els.playerAudio.currentTime = 0; } catch (e) { /* 忽略 */ }
      },
      previoustrack: function () { if (playlist.length) { loadTrack(currentTrack - 1, true); } },
      nexttrack: function () { if (playlist.length) { loadTrack(currentTrack + 1, true); } },
      seekbackward: function (details) { seekAudioBy(-((details && details.seekOffset) || 15)); },
      seekforward: function (details) { seekAudioBy((details && details.seekOffset) || 15); },
      seekto: function (details) {
        var audio = els.playerAudio;
        if (audio && details && typeof details.seekTime === 'number') {
          try { audio.currentTime = details.seekTime; } catch (e) { /* 忽略 */ }
        }
      }
    };
    Object.keys(handlers).forEach(function (name) {
      try { ms.setActionHandler(name, handlers[name]); } catch (e) { /* 個別瀏覽器唔支援 */ }
    });
  }

  function isStandalone() {
    try {
      return (global.matchMedia && global.matchMedia('(display-mode: standalone)').matches) ||
        (global.navigator && global.navigator.standalone === true);
    } catch (e) {
      return false;
    }
  }

  function isIOSDevice() {
    var ua = global.navigator ? asText(global.navigator.userAgent) : '';
    if (/iPad|iPhone|iPod/.test(ua)) { return true; }
    return /Macintosh/.test(ua) && global.navigator && global.navigator.maxTouchPoints > 1;
  }

  function registerServiceWorker() {
    if (!global.navigator || !global.navigator.serviceWorker) { return; }
    var loc = global.location;
    if (!loc) { return; }
    /* file:// 開本機檔時冇 SW；要 http(s)（GitHub Pages 用 https） */
    if (loc.protocol !== 'https:' && loc.hostname !== 'localhost' && loc.hostname !== '127.0.0.1') { return; }
    try {
      var reg = global.navigator.serviceWorker.register('sw.js', { scope: './' });
      if (reg && typeof reg.catch === 'function') {
        reg.catch(function () { /* 離線快取失敗不影響即時使用 */ });
      }
    } catch (e) { /* 忽略 */ }
  }

  function setupInstallPrompt() {
    if (!els.installApp) { return; }
    if (isStandalone()) { els.installApp.hidden = true; return; }

    var deferred = null;

    global.addEventListener('beforeinstallprompt', function (event) {
      event.preventDefault();
      deferred = event;
      if (els.installApp) { els.installApp.hidden = false; }
    });

    global.addEventListener('appinstalled', function () {
      deferred = null;
      if (els.installApp) { els.installApp.hidden = true; }
      showToast('已安裝「佛學系統」到主畫面。');
    });

    if (isIOSDevice()) { els.installApp.hidden = false; }

    els.installApp.addEventListener('click', function () {
      if (deferred && typeof deferred.prompt === 'function') {
        deferred.prompt();
        if (deferred.userChoice && typeof deferred.userChoice.then === 'function') {
          deferred.userChoice.then(function (choice) {
            if (choice && choice.outcome === 'accepted') {
              showToast('已開始安裝，完成後可喺主畫面開啟。');
            }
            deferred = null;
          });
        }
        return;
      }
      if (isIOSDevice()) {
        showToast('iPhone／iPad：按「分享」→「加入主畫面」即可安裝。');
        return;
      }
      showToast('呢個瀏覽器唔支援自動安裝，請用選單「安裝應用程式」或「加到主畫面」。');
    });
  }

  function setupBackgroundPlayback() {
    enableBackgroundPlayback();
    setupMediaSessionHandlers();
    registerServiceWorker();
    setupInstallPrompt();

    /* 由背景返回、或 bfcache 還原時，重新確認 iOS 音頻會話 */
    if (doc) {
      doc.addEventListener('visibilitychange', function () {
        if (!doc.hidden) { enableBackgroundPlayback(); }
      });
    }
    global.addEventListener('pageshow', enableBackgroundPlayback);
  }

  /* =========================================================
     19. 事件綁定
     ========================================================= */
  function bindEvents() {
    /* 分頁 */
    if (els.tabs) {
      els.tabs.addEventListener('click', function (event) {
        var tab = closestAttr(event.target, '[data-tab]');
        if (tab) { goTab(tab.getAttribute('data-tab'), true); }
      });
      els.tabs.addEventListener('keydown', function (event) {
        if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') { return; }
        var buttons = Array.prototype.slice.call(els.tabs.querySelectorAll('[data-tab]'));
        var currentIndex = buttons.indexOf(doc.activeElement);
        if (currentIndex === -1) { return; }
        event.preventDefault();
        var step = event.key === 'ArrowRight' ? 1 : -1;
        var next = buttons[(currentIndex + step + buttons.length) % buttons.length];
        next.focus();
        next.click();
      });
    }

    /* 大字 */
    if (els.fontsizeToggle) {
      els.fontsizeToggle.addEventListener('click', function () {
        state.settings.bigText = !state.settings.bigText;
        saveState();
        applySettings();
      });
    }

    /* 搜尋 */
    if (els.searchInput) {
      els.searchInput.addEventListener('input', function () {
        libFilter.query = els.searchInput.value || '';
        renderLibrary();
      });
    }

    /* 計數器 */
    if (els.counterBtn) { els.counterBtn.addEventListener('click', incrementCounter); }
    if (els.counterReset) { els.counterReset.addEventListener('click', resetCounter); }
    if (els.counterSound) { els.counterSound.addEventListener('click', toggleBeep); }
    if (els.counterLog) { els.counterLog.addEventListener('click', logPractice); }

    /* 功課紀錄 */
    if (els.recordsMarkToday) { els.recordsMarkToday.addEventListener('click', toggleTodayRecord); }
    if (els.recordsReset) { els.recordsReset.addEventListener('click', onResetRecords); }

    /* 詳情視窗 */
    if (els.modalClose) { els.modalClose.addEventListener('click', closeMantraModal); }

    /* 全域點擊（資料行動、跳頁、類別篩選、日曆格） */
    doc.addEventListener('click', function (event) {
      var target = event.target;

      var closeTrigger = closestAttr(target, '[data-close-modal]');
      if (closeTrigger) { closeMantraModal(); }

      var actionButton = closestAttr(target, '[data-action]');
      if (actionButton) {
        var action = actionButton.getAttribute('data-action');
        if (action === 'detail') {
          openMantraModal(actionButton.getAttribute('data-id'));
        } else if (action === 'play-track' || action === 'playlist') {
          var index = Number(actionButton.getAttribute('data-track'));
          if (!isNaN(index) && index >= 0) { loadTrack(index, true); }
        } else if (action === 'play-mantra') {
          var trackIndex = firstTrackIndexForMantra(actionButton.getAttribute('data-id'));
          if (trackIndex >= 0) { loadTrack(trackIndex, true); }
        }
      }

      var gotoButton = closestAttr(target, '[data-goto]');
      if (gotoButton) { handleGotoButton(gotoButton); }

      var dayToggle = closestAttr(target, '[data-day-toggle]');
      if (dayToggle) {
        var dayNumber = Number(dayToggle.getAttribute('data-day-toggle'));
        if (!isNaN(dayNumber)) {
          openDays[dayNumber] = !openDays[dayNumber];
          renderPractice();
          var head = doc.querySelector('[data-day-card="' + dayNumber + '"] .day-head');
          if (head) { try { head.focus(); } catch (e) { /* ignore */ } }
        }
      }

      var chip = closestAttr(target, '[data-category]');
      if (chip) {
        libFilter.category = chip.getAttribute('data-category') || '全部';
        renderLibrary();
      }

      var historyCell = closestAttr(target, '[data-date]');
      if (historyCell) {
        toggleRecord(historyCell.getAttribute('data-date'));
      }
    });

    /* 次第勾選 */
    if (els.curriculumList) {
      els.curriculumList.addEventListener('change', function (event) {
        var checkbox = event.target;
        if (!checkbox || checkbox.className.indexOf('step-check') === -1) { return; }
        var dayNumber = Number(checkbox.getAttribute('data-step-day'));
        var stepIndex = Number(checkbox.getAttribute('data-step-index'));
        if (isNaN(dayNumber) || isNaN(stepIndex)) { return; }
        setStepChecked(dayNumber, stepIndex, checkbox.checked);
        var actionLine = checkbox.parentNode ? checkbox.parentNode.querySelector('.step-action') : null;
        if (actionLine && actionLine.classList) {
          actionLine.classList.toggle('is-checked', checkbox.checked);
        }
        updateDayCardProgress(dayNumber);
        var day = findDay(dayNumber);
        if (checkbox.checked && day && day.steps.length) {
          var checkedAll = day.steps.every(function (step, index) {
            return isStepChecked(dayNumber, index);
          });
          if (checkedAll) {
            showToast('第 ' + dayNumber + ' 日步驟已全部完成，隨喜。');
          }
        }
      });
    }

    /* 鍵盤：空白鍵計數、Esc 關閉 */
    doc.addEventListener('keydown', function (event) {
      var key = event.key;
      if (key === 'Escape' || key === 'Esc') {
        if (els.mantraModal && !els.mantraModal.hidden) {
          event.preventDefault();
          closeMantraModal();
          return;
        }
        if (els.playlistDrawer && !els.playlistDrawer.hidden) {
          closePlaylistDrawer();
          return;
        }
        return;
      }
      if (key !== ' ' && key !== 'Spacebar' && event.code !== 'Space') { return; }
      var target = event.target;
      if (!target) { return; }
      var tag = (target.tagName || '').toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
        return;
      }
      if (target.closest && target.closest('a[href], button, [role="button"], summary, [contenteditable="true"]')) {
        return;
      }
      if (els.mantraModal && !els.mantraModal.hidden) { return; }
      if (currentTab !== 'practice') { return; }
      event.preventDefault();
      incrementCounter();
    });

    bindPlayerEvents();
  }

  /* =========================================================
     20. 日期／跨日檢查
     ========================================================= */
  function onTick() {
    if (!state) { return; }
    setTodayLabel();
    var today = todayISO();
    if (state.counter.date !== today) {
      ensureToday();
      renderAll();
      showToast('新的一日，計數已重新開始。');
      return;
    }
    if (currentTab === 'home' && els.homeDate) {
      var now = new Date();
      els.homeDate.textContent = formatZhDate(now);
      if (els.homeGreeting) { els.homeGreeting.textContent = greetingTitle(now); }
    }
  }

  /* =========================================================
     21. 全站重繪
     ========================================================= */
  function renderAll() {
    renderHome();
    renderLibrary();
    renderPractice();
    renderRecords();
    renderAbout();
    renderPlaylistDrawer();
    updatePlaylistCurrent();
  }

  /* =========================================================
     22. 測試鉤子（僅 Node 測試用；瀏覽器不會用到）
     ========================================================= */
  var TEST_HOOKS = {
    normalizeData: normalizeData,
    normalizeBenefit: normalizeBenefit,
    normalizeBenefits: normalizeBenefits,
    normalizeAudio: normalizeAudio,
    normalizeState: normalizeState,
    filterMantras: filterMantras,
    buildPlaylist: buildPlaylist,
    categoryList: categoryList,
    computeStreak: computeStreak,
    recordStats: recordStats,
    suggestedDayNumber: suggestedDayNumber,
    trackUrl: trackUrl,
    isoDate: isoDate,
    parseISO: parseISO,
    defaultState: defaultState,
    FO_DEMO: FO_DEMO
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { __test: TEST_HOOKS };
  }
  global.FO_DEMO = FO_DEMO;
  global.FO_TEST_HOOKS = TEST_HOOKS;

  /* =========================================================
     23. 啟動
     ========================================================= */
  if (doc) {
    if (doc.readyState === 'loading') {
      doc.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

})(typeof window !== 'undefined' ? window : globalThis);
