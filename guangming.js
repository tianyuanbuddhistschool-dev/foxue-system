/* =============================================================
   光明真言・專修頁
   - 資料來源：data.js（window.FO_DATA）內 guangming-zhenyan.practice
   - 紀錄只存 localStorage（本機瀏覽器），不上傳
   - 播放 108 遍音檔時按時長比例自動計次；可手動 +1
   ============================================================= */
(function () {
  'use strict';

  var STORAGE_KEY = 'foguang.guangming.v1';
  var MAIN_KEY = 'foguang.foxue.state.v1';
  var TARGET = 108;
  var FALLBACK_PER = 751 / 108; /* 12:31 ÷ 108 遍，約 6.95 秒 */
  var DATA = (window.FO_DATA && Array.isArray(window.FO_DATA.mantras)) ? window.FO_DATA : null;
  var mantra = null;
  if (DATA) {
    for (var mi = 0; mi < DATA.mantras.length; mi++) {
      if (DATA.mantras[mi] && DATA.mantras[mi].id === 'guangming-zhenyan') {
        mantra = DATA.mantras[mi];
        break;
      }
    }
  }
  var practice = (mantra && mantra.practice && typeof mantra.practice === 'object') ? mantra.practice : null;

  /* ---------------- 小工具 ---------------- */
  function $(id) { return document.getElementById(id); }
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function asText(value) { return value == null ? '' : String(value); }
  function pad2(n) { return n < 10 ? '0' + n : String(n); }
  function todayISO(date) {
    var d = date || new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function dateOffset(days) {
    var d = new Date();
    d.setDate(d.getDate() + days);
    return todayISO(d);
  }
  function dateFromKey(key) {
    var parts = String(key).split('-');
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }
  function fmtTime(seconds) {
    var s = Number(seconds);
    if (!isFinite(s) || s < 0) { s = 0; }
    var m = Math.floor(s / 60);
    var sec = Math.floor(s % 60);
    return m + ':' + pad2(sec);
  }
  function weekdayCN(date) {
    return ['日', '一', '二', '三', '四', '五', '六'][date.getDay()];
  }
  function toast(message) {
    var root = $('toast-root');
    if (!root) { return; }
    var node = document.createElement('div');
    node.className = 'toast';
    node.textContent = message;
    node.setAttribute('data-no-i18n', '');
    node.textContent = trText(message);
    root.appendChild(node);
    while (root.children.length > 3) { root.removeChild(root.firstChild); }
    setTimeout(function () {
      if (node.parentNode) { node.parentNode.removeChild(node); }
    }, 3200);
  }

  /* ---------------- 音檔路徑編碼（與 app.js 相同做法） ---------------- */
  function isEncodedSegment(segment) {
    if (!/%[0-9A-Fa-f]{2}/.test(segment)) { return false; }
    if (/[^\x21-\x7E]/.test(segment)) { return false; }
    if (/[\\?#]/.test(segment)) { return false; }
    return /^(?:[A-Za-z0-9\-._~!$&'()*+,;=:@]|%[0-9A-Fa-f]{2})+$/.test(segment);
  }
  function trackUrl(file) {
    var path = asText(file).trim();
    if (!path) { return ''; }
    if (/^[a-z][a-z0-9+.-]*:/i.test(path) || path.indexOf('//') === 0) { return path; }
    path = path.replace(/\\/g, '/');
    return path.split('/').map(function (segment) {
      if (!segment) { return segment; }
      if (isEncodedSegment(segment)) { return segment; }
      return encodeURIComponent(segment);
    }).join('/');
  }

  /* ---------------- 狀態 ---------------- */
  function defaultState() {
    return {
      version: 1,
      days: {},
      passageNotes: {},
      /* 2026-11-18 v2.4.1：預設改「單曲循環」。
         全輯循環要靠 JS 嘅 ended 事件換段；手機熄屏後 JS 會被系統凍結，
         12:31 播完就停（用家回報嘅「熄屏後背景播音停止」根因之一）。
         單曲循環用瀏覽器原生 loop，唔靠 JS，鎖屏照轉。 */
      settings: { loop: true, loopMode: 'one', track: 0, bgFix: 2 },
      updated: ''
    };
  }
  function normalizeState(raw) {
    var safe = defaultState();
    if (!raw || typeof raw !== 'object') { return safe; }
    if (raw.passageNotes && typeof raw.passageNotes === 'object') {
      Object.keys(raw.passageNotes).forEach(function (key) {
        var value = raw.passageNotes[key];
        if (typeof value === 'string' && value.trim()) {
          safe.passageNotes[key] = value.slice(0, 5000);
        }
      });
    }
    if (raw.days && typeof raw.days === 'object') {
      Object.keys(raw.days).forEach(function (key) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) { return; }
        var item = raw.days[key];
        if (!item || typeof item !== 'object') { return; }
        var auto = Math.max(0, Math.floor(Number(item.auto) || 0));
        var manual = Math.max(0, Math.floor(Number(item.manual) || 0));
        var note = typeof item.note === 'string' ? item.note.slice(0, 4000) : '';
        var checked = item.checked === true;
        if (auto || manual || note || checked) {
          safe.days[key] = { auto: auto, manual: manual, note: note, checked: checked };
        }
      });
    }
    if (raw.settings && typeof raw.settings === 'object') {
      safe.settings.loop = raw.settings.loop !== false;
      var mode = raw.settings.loopMode;
      if (mode === 'all' || mode === 'one' || mode === 'off') {
        safe.settings.loopMode = mode;
      } else {
        safe.settings.loopMode = safe.settings.loop ? 'all' : 'off';
      }
      safe.settings.track = Number(raw.settings.track) === 1 ? 1 : 0;
      /* 一次性由「全輯」遷去「單曲」：舊存檔嘅全輯模式喺鎖屏時會停。
         用家之後仍可自己撳返全輯，唔會再被強制改。 */
      if (Number(raw.settings.bgFix) !== 2) {
        if (safe.settings.loopMode === 'all') {
          safe.settings.loopMode = 'one';
          safe.settings.bgMigrated = true;
        }
        safe.settings.bgFix = 2;
      }
    }
    safe.updated = typeof raw.updated === 'string' ? raw.updated : '';
    return safe;
  }
  function loadState() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? normalizeState(JSON.parse(raw)) : defaultState();
    } catch (e) {
      return defaultState();
    }
  }
  var state = loadState();
  var auth = window.FY_AUTH || null;
  var db = window.FY_DB || null;
  var currentUser = null;
  var pushTimer = null;
  var googleBusy = false;
  var storageBroken = false;

  /* ---------------- 四語介面 ---------------- */
  var LANG_KEY = 'guangming.lang';
  var LANG_TARGET = { yue: 'yue', cmn: 'zh', en: 'en', vi: 'vi' };
  var LANG_HTML = { yue: 'zh-Hant-HK', cmn: 'zh-Hans-CN', en: 'en', vi: 'vi' };
  var lang = 'yue';
  var calMonthOffset = 0;
  var lastStatus = { message: '', kind: '' };
  try {
    var savedLang = window.localStorage.getItem(LANG_KEY);
    if (savedLang && LANG_TARGET[savedLang]) { lang = savedLang; }
  } catch (e) { /* ignore */ }

  var ZH_TO_TRAD = {};
  var EN_TO_TRAD = {};
  var VI_TO_TRAD = {};
  if (window.GM_STRINGS) {
    Object.keys(window.GM_STRINGS).forEach(function (key) {
      var entry = window.GM_STRINGS[key];
      if (entry && entry.zh) { ZH_TO_TRAD[entry.zh] = key; }
      if (entry && entry.en) { EN_TO_TRAD[entry.en] = key; }
      if (entry && entry.vi) { VI_TO_TRAD[entry.vi] = key; }
    });
  }

  function resolveSource(text) {
    if (!text) { return null; }
    if (window.GM_STRINGS && window.GM_STRINGS[text]) { return text; }
    if (ZH_TO_TRAD[text]) { return ZH_TO_TRAD[text]; }
    if (EN_TO_TRAD[text]) { return EN_TO_TRAD[text]; }
    if (VI_TO_TRAD[text]) { return VI_TO_TRAD[text]; }
    return null;
  }

  function trText(source) {
    if (!source) { return source; }
    var key = resolveSource(source);
    if (!key) { return source; }
    if (lang === 'yue') { return key; }
    var entry = window.GM_STRINGS[key];
    return (entry && entry[LANG_TARGET[lang]]) || key;
  }

  function shouldSkipNode(node) {
    var parent = node.parentElement;
    if (!parent) { return true; }
    if (parent.closest('script,style,noscript')) { return true; }
    if (parent.closest('.gm-han,.gm-roman,.gm-variant,[lang="sa-Latn"],[data-no-i18n],td[lang="zh-Hant"],.gm-dh')) { return true; }
    return false;
  }

  function translateTextNode(node) {
    var current = String(node.nodeValue || '');
    var trimmed = current.trim();
    if (!trimmed) { return; }
    var key = resolveSource(trimmed);
    if (!key && node.__gmSource) {
      var original = String(node.__gmSource).trim();
      if (resolveSource(original)) {
        key = resolveSource(original);
        trimmed = String(node.__gmSource).trim();
        current = String(node.__gmSource);
      }
    }
    if (!key) { return; }
    if (node.__gmSource == null) { node.__gmSource = current; }
    var replacement = lang === 'yue' ? key : ((window.GM_STRINGS[key] && window.GM_STRINGS[key][LANG_TARGET[lang]]) || key);
    if (replacement === trimmed) { return; }
    node.nodeValue = current.replace(trimmed, replacement);
  }

  function translateAttributes(root) {
    var nodes = root.querySelectorAll('[title],[placeholder],[aria-label]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      ['title', 'placeholder', 'aria-label'].forEach(function (attr) {
        var value = el.getAttribute(attr);
        if (!value) { return; }
        if (!el.__gmAttr) { el.__gmAttr = {}; }
        if (el.__gmAttr[attr] == null) { el.__gmAttr[attr] = value; }
        var source = el.__gmAttr[attr];
        var replacement = trText(source);
        if (replacement !== value) { el.setAttribute(attr, replacement); }
      });
    }
  }

  function applyLanguage() {
    document.documentElement.lang = LANG_HTML[lang] || 'zh-Hant-HK';
    document.title = lang === 'cmn' ? '光明真言系统｜佛音灵气标准'
      : (lang === 'en' ? 'Mantra of Light System | Foyin Lingqi Standard'
      : (lang === 'vi' ? 'Hệ thống Chân ngôn Quang Minh | Tiêu chuẩn Phật Âm Linh Khí'
      : '光明真言系統｜佛音靈氣標準'));
    var target = LANG_TARGET[lang] || 'yue';
    var cells = document.querySelectorAll('.gm-lang[data-lang]');
    for (var i = 0; i < cells.length; i++) {
      cells[i].hidden = cells[i].getAttribute('data-lang') !== target;
    }
    var hideChinese = (lang === 'en' || lang === 'vi');
    var originals = document.querySelectorAll('.gm-han,.gm-variant,.gm-phrases,.gm-dh');
    for (var h = 0; h < originals.length; h++) { originals[h].hidden = hideChinese; }
    if (document.body) {
      var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
      var node;
      while ((node = walker.nextNode())) {
        if (!shouldSkipNode(node)) { translateTextNode(node); }
      }
      translateAttributes(document.body);
    }
    var buttons = document.querySelectorAll('[data-gmlang]');
    /* 使用者指定：粵語 UI「粵/普/EN/VI」；普通話 UI「粤/普/EN/VI」；
       English／越南文 UI 都用「粵/普/EN/VI」，不再顯示 英/越/YUE/Quảng。 */
    var langLabels = lang === 'cmn'
      ? { yue: '粤', cmn: '普', en: 'EN', vi: 'VI' }
      : { yue: '粵', cmn: '普', en: 'EN', vi: 'VI' };
    for (var j = 0; j < buttons.length; j++) {
      var code = buttons[j].getAttribute('data-gmlang');
      buttons[j].setAttribute('data-no-i18n', '');
      buttons[j].textContent = langLabels[code] || code.toUpperCase();
      buttons[j].classList.toggle('on', code === lang);
    }
    var title = $('gm-title');
    if (title) {
      title.setAttribute('data-no-i18n', '');
      title.textContent = lang === 'yue' ? '光明真言' : (lang === 'cmn' ? '光明真言' : (lang === 'en' ? 'Mantra of Light' : 'Chân ngôn Quang Minh'));
    }
    var foot = $('foot-version');
    if (foot) {
      var version = '2.4.1';
      foot.setAttribute('data-no-i18n', '');
      foot.textContent = lang === 'yue' ? '光明真言系統 v' + version
        : (lang === 'cmn' ? '光明真言系统 v' + version
        : (lang === 'en' ? 'Mantra of Light System v' + version
        : 'Hệ thống Chân ngôn Quang Minh v' + version));
    }
    if (lastStatus.message) {
      var statusEl = $('player-status');
      if (statusEl) {
        statusEl.setAttribute('data-no-i18n', '');
        statusEl.textContent = trText(lastStatus.message);
        statusEl.classList.toggle('is-error', lastStatus.kind === 'error');
        statusEl.classList.toggle('is-live', lastStatus.kind === 'live');
      }
    }
    setPlayButton();
    syncLoopButton();
    try { window.localStorage.setItem(LANG_KEY, lang); } catch (e) { /* ignore */ }
    updateTodayChip();
  }

  function setLanguage(next) {
    if (!LANG_TARGET[next]) { return; }
    lang = next;
    applyLanguage();
    /* 統計卡／紀錄摘要係即時組合字串，要跟語言重建。 */
    renderStats();
    renderRecordsSummary();
  }

  function updateTodayChip() {
    var chip = $('today-chip');
    if (!chip) { return; }
    var now = new Date();
    try {
      var locale = lang === 'yue' ? 'zh-HK' : (lang === 'cmn' ? 'zh-CN' : (lang === 'en' ? 'en-US' : 'vi-VN'));
      chip.textContent = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(now);
    } catch (e) {
      chip.textContent = now.getFullYear() + '-' + pad2(now.getMonth() + 1) + '-' + pad2(now.getDate());
    }
  }
  function saveState() {
    state.updated = new Date().toISOString();
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      if (!storageBroken) {
        storageBroken = true;
        toast('此瀏覽器唔准儲存紀錄（可能係私隱模式），今次紀錄重新整理後會消失。');
      }
    }
    schedulePush();
  }
  function dayData(key) {
    var k = key || todayISO();
    if (!state.days[k]) { state.days[k] = { auto: 0, manual: 0, note: '', checked: false }; }
    if (typeof state.days[k].checked !== 'boolean') { state.days[k].checked = false; }
    return state.days[k];
  }
  function dayTotal(item) {
    if (!item) { return 0; }
    return Math.max(0, Number(item.auto) || 0) + Math.max(0, Number(item.manual) || 0);
  }
  function todayTotal() { return dayTotal(state.days[todayISO()]); }
  function totals() {
    var keys = Object.keys(state.days);
    var total = 0;
    var today = todayTotal();
    var week = 0;
    var month = 0;
    var month30 = 0;
    var best = 0;
    var bestKey = '';
    var checkDays = 0;
    var checkMonth = 0;
    var ym = todayISO().slice(0, 7);
    keys.forEach(function (key) {
      var n = dayTotal(state.days[key]);
      total += n;
      if (key === todayISO()) { today = n; }
      if (key >= dateOffset(-6) && key <= todayISO()) { week += n; }
      if (key.indexOf(ym) === 0) { month += n; }
      if (key >= dateOffset(-29) && key <= todayISO()) { month30 += n; }
      if (n > best) { best = n; bestKey = key; }
      if (state.days[key] && state.days[key].checked) {
        checkDays++;
        if (key.indexOf(ym) === 0) { checkMonth++; }
      }
    });
    var streak = 0;
    var cursor = new Date();
    if (dayTotal(state.days[todayISO()]) === 0) { cursor.setDate(cursor.getDate() - 1); }
    while (dayTotal(state.days[todayISO(cursor)]) > 0) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    var checkStreak = 0;
    var ccur = new Date();
    if (!(state.days[todayISO()] && state.days[todayISO()].checked)) { ccur.setDate(ccur.getDate() - 1); }
    while (state.days[todayISO(ccur)] && state.days[todayISO(ccur)].checked) {
      checkStreak++;
      ccur.setDate(ccur.getDate() - 1);
    }
    return {
      total: total, today: today, week: week, month: month, month30: month30, streak: streak,
      best: best, bestKey: bestKey, days: keys.length,
      checkDays: checkDays, checkMonth: checkMonth, checkStreak: checkStreak
    };
  }

  /* ---------------- Google 登入／Firestore 同步 ---------------- */
  /* 登入／同步狀態係即時寫入，唔會經 applyLanguage 嘅文字掃描；
     所以要喺寫入一刻自己翻譯，否則 EN／VI 會殘留中文。 */
  function localizeStatus(message) {
    message = message || '';
    if (!message || lang === 'yue') { return message; }
    var m;
    if ((m = /^已同步：(\d+) 遍$/.exec(message))) {
      if (lang === 'cmn') { return '已同步：' + m[1] + ' 遍'; }
      if (lang === 'en') { return 'Synced: ' + m[1] + ' times'; }
      return 'Đã đồng bộ: ' + m[1] + ' lần';
    }
    if ((m = /^讀取失敗：(.+)$/.exec(message))) {
      if (lang === 'cmn') { return '读取失败：' + m[1]; }
      if (lang === 'en') { return 'Load failed: ' + m[1]; }
      return 'Tải thất bại: ' + m[1];
    }
    if ((m = /^上載失敗：(.+)$/.exec(message))) {
      if (lang === 'cmn') { return '上传失败：' + m[1]; }
      if (lang === 'en') { return 'Upload failed: ' + m[1]; }
      return 'Tải lên thất bại: ' + m[1];
    }
    if ((m = /^已登入：(.+)。紀錄會分開儲存。$/.exec(message))) {
      if (lang === 'cmn') { return '已登录：' + m[1] + '。记录会分开保存。'; }
      if (lang === 'en') { return 'Signed in: ' + m[1] + '. Records are kept separately.'; }
      return 'Đã đăng nhập: ' + m[1] + '. Ghi chép được lưu riêng.';
    }
    if (message === '讀取雲端紀錄中…') {
      if (lang === 'cmn') { return '读取云端记录中…'; }
      if (lang === 'en') { return 'Loading cloud records…'; }
      return 'Đang tải ghi chép trên đám mây…';
    }
    if (message === '上載中…') {
      if (lang === 'cmn') { return '上传中…'; }
      if (lang === 'en') { return 'Uploading…'; }
      return 'Đang tải lên…';
    }
    return trText(message);
  }
  function setAuthStatus(message) {
    var el = $('gm-sync-status');
    if (el) { el.textContent = localizeStatus(message); }
  }
  function schedulePush() {
    if (!db || !currentUser) { return; }
    if (pushTimer) { clearTimeout(pushTimer); }
    pushTimer = setTimeout(push, 1500);
  }
  function mergeRemoteDays(remote) {
    if (!remote || typeof remote !== 'object') { return false; }
    var changed = false;
    Object.keys(remote).forEach(function (key) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) { return; }
      var item = remote[key];
      if (!item || typeof item !== 'object') { return; }
      var local = state.days[key] || { auto: 0, manual: 0, note: '', checked: false };
      var auto = Math.max(Number(local.auto) || 0, Number(item.auto) || 0);
      var manual = Math.max(Number(local.manual) || 0, Number(item.manual) || 0);
      var note = local.note || (typeof item.note === 'string' ? item.note.slice(0, 4000) : '');
      var checked = local.checked === true || item.checked === true;
      if (auto !== (Number(local.auto) || 0) || manual !== (Number(local.manual) || 0) ||
          note !== (local.note || '') || checked !== (local.checked === true)) {
        state.days[key] = { auto: auto, manual: manual, note: note, checked: checked };
        changed = true;
      }
    });
    return changed;
  }
  function mergeRemotePassageNotes(remote) {
    if (!remote || typeof remote !== 'object') { return false; }
    var changed = false;
    Object.keys(remote).forEach(function (key) {
      if (!state.passageNotes[key] && typeof remote[key] === 'string' && remote[key].trim()) {
        state.passageNotes[key] = remote[key].slice(0, 5000);
        changed = true;
      }
    });
    return changed;
  }
  function pull() {
    if (!db || !currentUser) { return Promise.resolve(); }
    setAuthStatus('讀取雲端紀錄中…');
    return db.collection('users').doc(currentUser.uid).get().then(function (doc) {
      if (doc.exists) {
        var data = doc.data() || {};
        var changed = mergeRemoteDays(data.guangmingCounts);
        var notesChanged = mergeRemotePassageNotes(data.guangmingPassageNotes);
        if (changed || notesChanged) {
          saveState();
          renderStats();
          renderHistory();
          renderRecordsSummary();
          renderNote();
          if (notesChanged) { renderPassages(); }
        }
      }
      setAuthStatus('已同步：' + totals().total + ' 遍');
    }).catch(function (e) {
      setAuthStatus('讀取失敗：' + ((e && e.code) || '未知'));
    });
  }
  function push() {
    if (!db || !currentUser) { return Promise.resolve(); }
    setAuthStatus('上載中…');
    return db.collection('users').doc(currentUser.uid).set({
      guangmingCounts: state.days,
      guangmingPassageNotes: state.passageNotes,
      guangmingUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).then(function () {
      setAuthStatus('已同步：' + totals().total + ' 遍');
    }).catch(function (e) {
      setAuthStatus('上載失敗：' + ((e && e.code) || '未知'));
    });
  }
  function googleProvider() {
    var provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    return provider;
  }
  function authErrorText(code, prefix) {
    code = code || '';
    var host = location.hostname;
    if (code === 'auth/unauthorized-domain') {
      if (lang === 'cmn') { return '登录失败：域名 ' + host + ' 未加入 Firebase 授权域名（Firebase Console → Authentication → Settings → Authorized domains）。可先用本机记录或 APK。'; }
      if (lang === 'en') { return 'Sign-in failed: domain ' + host + ' is not in Firebase Authorized domains. Use local records or the APK meanwhile.'; }
      if (lang === 'vi') { return 'Đăng nhập thất bại: tên miền ' + host + ' chưa được thêm vào Firebase Authorized domains. Tạm dùng ghi chép cục bộ hoặc APK.'; }
      return '登入失敗：網域 ' + host + ' 未加入 Firebase 授權網域（Firebase Console → Authentication → Settings → Authorized domains）。可先用下方「+1 遍」及本機紀錄，或改用 APK。';
    }
    if (code === 'auth/operation-not-supported-in-this-environment' || code === 'auth/web-storage-unsupported') {
      if (lang === 'cmn') { return '登录失败：此浏览器（或 App 内建浏览器）封锁了 Google 登录。请用 Chrome／Safari 直接打开本页。'; }
      if (lang === 'en') { return 'Sign-in failed: this browser (or in-app browser) blocks Google sign-in. Open this page directly in Chrome or Safari.'; }
      if (lang === 'vi') { return 'Đăng nhập thất bại: trình duyệt này (hoặc trình duyệt trong ứng dụng) chặn đăng nhập Google. Hãy mở trang trực tiếp bằng Chrome hoặc Safari.'; }
      return '登入失敗：呢個瀏覽器（或 App 內建瀏覽器）封鎖咗 Google 登入。請用 Chrome／Safari 直接開本頁，唔好喺 WhatsApp／Facebook／微信入面開。';
    }
    if (code === 'auth/network-request-failed') {
      if (lang === 'cmn') { return '登录失败：连不到 Google（网络或 VPN 问题）。请检查网络后再试。'; }
      if (lang === 'en') { return 'Sign-in failed: cannot reach Google (network or VPN issue). Check your connection and try again.'; }
      if (lang === 'vi') { return 'Đăng nhập thất bại: không kết nối được Google (mạng hoặc VPN). Hãy kiểm tra kết nối rồi thử lại.'; }
      return '登入失敗：連唔到 Google（網絡或 VPN 問題）。請檢查網絡後再試。';
    }
    if (code === 'auth/too-many-requests') {
      if (lang === 'cmn') { return '登录失败：尝试次数太多，请稍后再试。'; }
      if (lang === 'en') { return 'Sign-in failed: too many attempts. Please wait and try again.'; }
      if (lang === 'vi') { return 'Đăng nhập thất bại: quá nhiều lần thử. Vui lòng đợi rồi thử lại.'; }
      return '登入失敗：嘗試次數太多，請等一陣再試。';
    }
    var base = prefix || (lang === 'en' ? 'Sign-in failed: ' : (lang === 'vi' ? 'Đăng nhập thất bại: ' : (lang === 'cmn' ? '登录失败：' : '登入失敗：')));
    return base + (code || (lang === 'en' ? 'unknown' : (lang === 'vi' ? 'không rõ' : (lang === 'cmn' ? '未知' : '未知'))));
  }
  function googleRedirect() {
    if (!auth) {
      setAuthStatus('Firebase 未載入，請檢查網絡。');
      return;
    }
    setAuthStatus('正在跳轉 Google 登入…');
    var provider = googleProvider();
    auth.signInWithRedirect(provider).catch(function (e) {
      setAuthStatus(authErrorText((e && e.code) || '', '跳轉登入失敗：'));
    });
  }
  function googleSignIn() {
    if (!auth) {
      setAuthStatus('Firebase 未載入，請檢查網絡。');
      return;
    }
    if (googleBusy) { return; }
    googleBusy = true;
    setAuthStatus('正在開啟 Google 登入彈窗…');
    var redirectBtn = $('gm-google-redirect');
    if (redirectBtn) { redirectBtn.hidden = false; }
    var popupTimer = setTimeout(function () {
      googleBusy = false;
      setAuthStatus('如果冇見到 Google 彈窗：請允許本站彈出視窗，或按「彈窗冇反應？改用跳轉登入」。');
    }, 2600);
    var provider = googleProvider();
    auth.signInWithPopup(provider).then(function () {
      clearTimeout(popupTimer);
      googleBusy = false;
    }).catch(function (e) {
      clearTimeout(popupTimer);
      googleBusy = false;
      var code = (e && e.code) || '';
      if (code === 'auth/popup-blocked') {
        setAuthStatus('彈窗被瀏覽器擋住，正在改用跳轉登入…');
        auth.signInWithRedirect(provider);
        return;
      }
      if (code === 'auth/unauthorized-domain') {
        setAuthStatus(authErrorText(code));
        return;
      }
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setAuthStatus('登入已取消。');
        return;
      }
      if (code === 'auth/operation-not-supported-in-this-environment' || code === 'auth/web-storage-unsupported' || code === 'auth/network-request-failed') {
        setAuthStatus(authErrorText(code));
        return;
      }
      setAuthStatus('登入失敗：' + (code || '未知') + '。可先用本機紀錄，或下載 APK 使用。');
    });
  }
  function initAuth() {
    var loginBtn = $('gm-google-login');
    var redirectBtn = $('gm-google-redirect');
    var switchBtn = $('gm-google-switch');
    var logoutBtn = $('gm-google-logout');
    var avatar = $('gm-avatar');
    var userEl = $('gm-sync-user');
    if (!auth) {
      if (loginBtn) { loginBtn.disabled = true; }
      setAuthStatus('Firebase 未載入（SDK 被阻擋或離線）。本機紀錄、播放、計次全部照用；登入只影響跨裝置同步。');
      return;
    }
    try { auth.useDeviceLanguage(); } catch (e) { /* ignore */ }
    /* 明確用 LOCAL persistence：手機瀏覽器／PWA 重開都保住登入，
       唔會每次返嚟都要重新彈 Google。 */
    if (auth.setPersistence && firebase.auth.Auth && firebase.auth.Auth.Persistence) {
      auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function () { /* ignore */ });
    }
    checkAuthDomain();
    auth.getRedirectResult().then(function (result) {
      if (result && result.user) {
        setAuthStatus('已由跳轉登入：' + (result.user.displayName || '已登入'));
      }
    }).catch(function (e) {
      setAuthStatus(authErrorText((e && e.code) || '', '跳轉登入失敗：'));
    });
    auth.onAuthStateChanged(function (user) {
      currentUser = user || null;
      if (user) {
        if (loginBtn) { loginBtn.hidden = true; }
        if (redirectBtn) { redirectBtn.hidden = true; }
        if (switchBtn) { switchBtn.hidden = false; }
        if (logoutBtn) { logoutBtn.hidden = false; }
        if (avatar) {
          if (user.photoURL) { avatar.src = user.photoURL; avatar.hidden = false; }
          else { avatar.hidden = true; avatar.removeAttribute('src'); }
        }
        if (userEl) { userEl.textContent = user.displayName || trText('已登入'); }
        pull().then(push);
      } else {
        if (loginBtn) { loginBtn.hidden = false; }
        if (redirectBtn) { redirectBtn.hidden = true; }
        if (switchBtn) { switchBtn.hidden = true; }
        if (logoutBtn) { logoutBtn.hidden = true; }
        if (avatar) { avatar.hidden = true; avatar.removeAttribute('src'); }
        if (userEl) { userEl.textContent = trText('未登入'); }
        if (!googleBusy) { setAuthStatus('未登入：紀錄只存本機。'); }
      }
    });
    if (loginBtn) { loginBtn.addEventListener('click', googleSignIn); }
    if (redirectBtn) { redirectBtn.addEventListener('click', googleRedirect); }
    if (switchBtn) { switchBtn.addEventListener('click', googleSignIn); }
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        if (auth) { auth.signOut(); }
      });
    }
    if (avatar) {
      avatar.addEventListener('error', function () { avatar.hidden = true; });
    }
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && currentUser) { pull(); }
    });
  }

  /* 登入網域自檢（2026-11-18 v2.4.1）
     用 Firebase createAuthUri 檢查目前網域有冇加入 Authorized domains。
     有啲「登入唔成功」其實係喺 file://、內建瀏覽器、或未授權網域發生，
     事先講清楚，唔好再令用家以為個掣壞。 */
  function checkAuthDomain() {
    var el = $('gm-auth-domain');
    if (!el) { return; }
    var cfg = window.FY_FIREBASE;
    if (!cfg || !cfg.apiKey) { el.textContent = '登入網域檢查：未讀到 firebase-config.js。'; return; }
    if (location.protocol === 'file:') {
      el.textContent = '登入網域檢查：本機檔案模式（file://）唔支援 Google 登入；請用上線網址或 APK。';
      return;
    }
    el.textContent = '登入網域檢查：檢查中…';
    var body = JSON.stringify({ providerId: 'google.com', continueUri: location.origin + '/' });
    fetch('https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=' + encodeURIComponent(cfg.apiKey), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body
    }).then(function (res) { return res.json(); }).then(function (json) {
      if (json && json.authUri) {
        el.textContent = '登入網域檢查：正常（' + location.hostname + ' 已授權）';
      } else {
        el.textContent = '登入網域檢查：未授權（' + location.hostname + '）。管理員可到 Firebase Console → Authentication → Settings → Authorized domains 加入。';
      }
    }).catch(function () {
      el.textContent = '登入網域檢查：連唔到 Firebase（離線或網絡封鎖）；本機紀錄照用。';
    });
  }

  /* ---------------- 共用渲染 ---------------- */
  var LANGS = (practice && practice.languages && practice.languages.length) ? practice.languages : [
    { id: 'yue', label: '粵語', tts: 'yue-Hant-HK' },
    { id: 'zh', label: '普通話', tts: 'zh-CN' },
    { id: 'en', label: 'English', tts: 'en-US' },
    { id: 'vi', label: 'Tiếng Việt', tts: 'vi-VN' }
  ];

  function statDaysNote(n) {
    n = Math.max(0, Math.floor(Number(n) || 0));
    if (lang === 'cmn') { return n + ' 日有记录'; }
    if (lang === 'en') { return n + (n === 1 ? ' day' : ' days') + ' recorded'; }
    if (lang === 'vi') { return n + ' ngày có ghi'; }
    return n + ' 日有紀錄';
  }
  function renderStats() {
    var box = $('gm-stats');
    if (!box) { return; }
    var t = totals();
    box.innerHTML =
      '<div class="stat-card"><span class="stat-label">今日遍數</span><span class="stat-value">' + t.today + '</span><span class="stat-note">自動＋手動</span></div>' +
      '<div class="stat-card"><span class="stat-label">累計遍數</span><span class="stat-value">' + t.total + '</span><span class="stat-note">' + statDaysNote(t.days) + '</span></div>' +
      '<div class="stat-card"><span class="stat-label">連續日數</span><span class="stat-value">' + t.streak + '</span><span class="stat-note">日</span></div>' +
      '<div class="stat-card"><span class="stat-label">最近 7 日</span><span class="stat-value">' + t.week + '</span><span class="stat-note">遍</span></div>';
    var today = t.today;
    var targetText = $('target-text');
    var bar = $('target-bar');
    var progress = $('target-progress');
    var big = $('today-count');
    if (big) { big.textContent = today; }
    if (targetText) { targetText.textContent = today + ' / ' + TARGET; }
    if (bar) { bar.style.width = Math.min(100, today / TARGET * 100) + '%'; }
    if (progress) { progress.setAttribute('aria-valuenow', String(Math.min(today, TARGET))); }
    renderCheckin();
    applyLanguage();
  }

  /* ---------------- 修行打卡（2026-11-18 v2.4.1） ---------------- */
  function checkinLocale() {
    return lang === 'cmn' ? 'zh-CN' : (lang === 'en' ? 'en-US' : (lang === 'vi' ? 'vi-VN' : 'zh-HK'));
  }
  function checkinWeekdays() {
    if (lang === 'en') { return ['S', 'M', 'T', 'W', 'T', 'F', 'S']; }
    if (lang === 'vi') { return ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']; }
    return ['日', '一', '二', '三', '四', '五', '六'];
  }
  function checkinHintText(checked, total) {
    var k = todayISO();
    if (lang === 'cmn') { return checked ? '今日（' + k + '）已打卡；今日 ' + total + ' 遍。' : '今日（' + k + '）还未打卡。'; }
    if (lang === 'en') { return checked ? 'Checked in for ' + k + '; ' + total + ' recitations today.' : 'Not checked in yet for ' + k + '.'; }
    if (lang === 'vi') { return checked ? 'Đã điểm danh ngày ' + k + '; hôm nay ' + total + ' lần.' : 'Hôm nay (' + k + ') chưa điểm danh.'; }
    return checked ? '今日（' + k + '）已打卡；今日 ' + total + ' 遍。' : '今日（' + k + '）仲未打卡。';
  }
  function renderCheckin() {
    var box = $('checkin-stats');
    if (!box) { return; }
    var t = totals();
    box.innerHTML =
      '<div class="stat-card"><span class="stat-label">' + esc(trText('連續打卡（日）')) + '</span><span class="stat-value">' + t.checkStreak + '</span><span class="stat-note">' + esc(trText('日')) + '</span></div>' +
      '<div class="stat-card"><span class="stat-label">' + esc(trText('累計打卡（日）')) + '</span><span class="stat-value">' + t.checkDays + '</span><span class="stat-note">' + esc(trText('日')) + '</span></div>' +
      '<div class="stat-card"><span class="stat-label">' + esc(trText('今月打卡（日）')) + '</span><span class="stat-value">' + t.checkMonth + '</span><span class="stat-note">' + esc(trText('日')) + '</span></div>';
    var todayItem = state.days[todayISO()];
    var checked = !!(todayItem && todayItem.checked);
    var total = dayTotal(todayItem);
    var btn = $('checkin-btn');
    if (btn) {
      btn.textContent = trText(checked ? '今日已打卡' : '今日打卡');
      btn.disabled = checked;
      btn.style.opacity = checked ? '.65' : '1';
    }
    var undo = $('checkin-undo');
    if (undo) { undo.hidden = !checked; }
    var hint = $('checkin-hint');
    if (hint) { hint.textContent = checkinHintText(checked, total); }

    var base = new Date();
    var d = new Date(base.getFullYear(), base.getMonth() + calMonthOffset, 1);
    var y = d.getFullYear(), m = d.getMonth();
    var title = $('cal-title');
    if (title) {
      try {
        title.textContent = new Intl.DateTimeFormat(checkinLocale(), { year: 'numeric', month: 'long' }).format(d);
      } catch (e) {
        title.textContent = y + ' 年 ' + (m + 1) + ' 月';
      }
    }
    var head = $('cal-head');
    if (head) {
      head.innerHTML = checkinWeekdays().map(function (w) { return '<div class="gm-cal-w">' + esc(w) + '</div>'; }).join('');
    }
    var grid = $('cal-grid');
    if (!grid) { return; }
    var first = new Date(y, m, 1).getDay();
    var days = new Date(y, m + 1, 0).getDate();
    var cells = '';
    for (var b = 0; b < first; b++) { cells += '<div class="gm-cal-day is-empty"></div>'; }
    for (var day = 1; day <= days; day++) {
      var key = y + '-' + pad2(m + 1) + '-' + pad2(day);
      var item = state.days[key];
      var n = dayTotal(item);
      var isChecked = !!(item && item.checked);
      var cls = 'gm-cal-day' + (isChecked ? ' is-checked' : '') + (key === todayISO() ? ' is-today' : '') + (key > todayISO() ? ' is-future' : '');
      var label = key + ' · ' + n + ' ' + trText('遍') + (isChecked ? ' · ' + trText('已打卡') : '');
      cells += '<div class="' + cls + '" title="' + esc(label) + '">' + day + (n ? '<span class="gm-cal-count">' + (n > 999 ? '999+' : n) + '</span>' : '') + '</div>';
    }
    grid.innerHTML = cells;
  }
  function setupCheckin() {
    var btn = $('checkin-btn');
    if (btn) {
      btn.addEventListener('click', function () {
        var item = dayData(todayISO());
        if (item.checked) { toast('今日已打咗卡'); return; }
        item.checked = true;
        saveState();
        renderStats();
        renderCheckin();
        toast('打卡成功');
      });
    }
    var undo = $('checkin-undo');
    if (undo) {
      undo.addEventListener('click', function () {
        var item = state.days[todayISO()];
        if (!item || !item.checked) { return; }
        if (!window.confirm(trText('確定撤銷今日打卡？'))) { return; }
        item.checked = false;
        saveState();
        renderStats();
        renderCheckin();
        toast('已撤銷今日打卡');
      });
    }
    var prev = $('cal-prev');
    var next = $('cal-next');
    if (prev) { prev.addEventListener('click', function () { calMonthOffset--; renderCheckin(); }); }
    if (next) { next.addEventListener('click', function () { calMonthOffset++; renderCheckin(); }); }
  }
  function reconcileCheckins() {
    var item = state.days[todayISO()];
    if (item && dayTotal(item) >= TARGET && !item.checked) {
      item.checked = true;
      saveState();
    }
  }
  /* 課誦模式：?mode=practice 只留計次／播放／打卡／紀錄。
     澳門上載版嘅大計次 UI，用呢個模式呈現，唔另開一套四語並列頁。 */
  function setupFocusMode() {
    var isPractice = /(?:^|[?&])mode=practice(?:&|$)/.test(location.search);
    if (!isPractice) { return; }
    document.body.classList.add('practice-mode');
    setTimeout(function () {
      var el = $('section-practice');
      if (el && el.scrollIntoView) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    }, 250);
  }

  function renderPassages() {
    var box = $('passages');
    if (!box || !practice) { return; }
    var html = '';
    (practice.passages || []).forEach(function (passage, index) {
      var pid = passage.id || ('p' + index);
      var pnote = state.passageNotes[pid] || '';
      html += '<article class="gm-passage" data-passage="' + esc(pid) + '">';
      html += '<div class="gm-passage-head"><h4 class="gm-passage-title">' + esc(passage.title || ('段落 ' + (index + 1))) + '</h4>';
      if (passage.roman) { html += '<span class="gm-roman" lang="sa-Latn">' + esc(passage.roman) + '</span>'; }
      html += '</div>';
      if (passage.han) { html += '<div class="gm-han" lang="zh-Hant">' + esc(passage.han) + '</div>'; }
      if (passage.variant) {
        html += '<div class="gm-variant"><span class="gm-variant-label">流通譯音（對照）</span><p lang="zh-Hant">' + esc(passage.variant) + '</p></div>';
      }
      if (passage.note) { html += '<p class="gm-passage-note">' + esc(passage.note) + '</p>'; }
      html += '<div class="gm-lang-grid">';
      LANGS.forEach(function (lang) {
        var value = passage[lang.id] || '';
        if (!value) { return; }
        html += '<div class="gm-lang" data-lang="' + esc(lang.id) + '"><div class="gm-lang-head"><span class="gm-lang-name">' + esc(lang.label) + '</span>' +
          '<button class="gm-tts" type="button" data-tts="' + index + '" data-lang="' + esc(lang.id) + '" aria-pressed="false">朗讀</button></div>' +
          '<p lang="' + esc(lang.tts || '') + '" data-no-i18n>' + esc(value) + '</p></div>';
      });
      html += '</div>';
      html += '<div class="gm-pnote"><button class="btn btn-quiet" type="button" data-pnote-toggle="' + esc(pid) + '">' +
        esc(trText(pnote ? '修改逐段筆記' : '逐段筆記')) + '</button>' +
        '<div class="gm-pnote-edit" data-pnote-edit="' + esc(pid) + '" hidden>' +
        '<textarea maxlength="5000" data-pnote-input="' + esc(pid) + '" placeholder="' + esc(trText('寫低呢一段嘅心得…')) + '">' + esc(pnote) + '</textarea>' +
        '<div class="gm-pnote-actions">' +
        '<button class="btn btn-quiet" type="button" data-pnote-save="' + esc(pid) + '">' + esc(trText('儲存')) + '</button>' +
        '<button class="btn btn-quiet" type="button" data-pnote-clear="' + esc(pid) + '">' + esc(trText('清除')) + '</button>' +
        '<span class="gm-pnote-status" data-pnote-status="' + esc(pid) + '"></span>' +
        '</div></div></div>';
      html += '</article>';
    });
    box.innerHTML = html;
    renderPassageNotes();
  }

  function passageById(id) {
    if (!practice) { return null; }
    for (var i = 0; i < practice.passages.length; i++) {
      if ((practice.passages[i].id || ('p' + i)) === id) { return practice.passages[i]; }
    }
    return null;
  }
  function renderPassageNotes() {
    var box = $('passage-notes');
    if (!box) { return; }
    var keys = Object.keys(state.passageNotes || {}).filter(function (key) { return state.passageNotes[key]; });
    if (!keys.length) {
      box.innerHTML = '<p class="muted">' + esc(trText('尚未有逐段筆記')) + '</p>';
      return;
    }
    box.innerHTML = keys.map(function (key) {
      var p = passageById(key);
      return '<div class="gm-note-row"><span class="gm-note-date">' + esc(p ? p.title : key) + '</span><p>' + esc(state.passageNotes[key]) + '</p></div>';
    }).join('');
  }
  function savePassageNote(id, value, silent) {
    if (!id) { return; }
    value = String(value || '').trim().slice(0, 5000);
    if (value) { state.passageNotes[id] = value; } else { delete state.passageNotes[id]; }
    saveState();
    renderPassageNotes();
    var toggle = document.querySelector('[data-pnote-toggle="' + id + '"]');
    if (toggle) { toggle.textContent = trText(value ? '修改逐段筆記' : '逐段筆記'); }
    if (!silent) { toast(value ? '逐段筆記已儲存' : '逐段筆記已清除'); }
    var status = document.querySelector('[data-pnote-status="' + id + '"]');
    if (status) {
      var tm = new Date().toLocaleTimeString(checkinLocale(), { hour: '2-digit', minute: '2-digit' });
      status.textContent = (lang === 'cmn' ? '已保存 ' : (lang === 'en' ? 'Saved ' : (lang === 'vi' ? 'Đã lưu ' : '已儲存 '))) + tm;
    }
  }
  function setupPassageNotes() {
    var box = $('passages');
    if (!box) { return; }
    var timers = {};
    box.addEventListener('click', function (event) {
      var el = event.target;
      if (!el || !el.closest) { return; }
      var toggle = el.closest('[data-pnote-toggle]');
      if (toggle) {
        var id = toggle.getAttribute('data-pnote-toggle');
        var editor = document.querySelector('[data-pnote-edit="' + id + '"]');
        if (editor) {
          editor.hidden = !editor.hidden;
          if (!editor.hidden) {
            var ta = editor.querySelector('textarea');
            if (ta) { ta.focus(); }
          }
        }
        return;
      }
      var save = el.closest('[data-pnote-save]');
      if (save) {
        var sid = save.getAttribute('data-pnote-save');
        var sed = document.querySelector('[data-pnote-edit="' + sid + '"]');
        var sta = sed ? sed.querySelector('textarea') : null;
        savePassageNote(sid, sta ? sta.value : '', false);
        return;
      }
      var clear = el.closest('[data-pnote-clear]');
      if (clear) {
        var cid = clear.getAttribute('data-pnote-clear');
        var ced = document.querySelector('[data-pnote-edit="' + cid + '"]');
        var cta = ced ? ced.querySelector('textarea') : null;
        if (cta) { cta.value = ''; }
        savePassageNote(cid, '', false);
      }
    });
    box.addEventListener('input', function (event) {
      var ta = event.target;
      if (!ta || !ta.closest || !ta.closest('[data-pnote-input]')) { return; }
      var id = ta.getAttribute('data-pnote-input');
      clearTimeout(timers[id]);
      timers[id] = setTimeout(function () { savePassageNote(id, ta.value, true); }, 800);
    });
  }

  function renderPhrases() {
    var body = $('phrase-body');
    if (!body || !practice) { return; }
    var html = '';
    (practice.phrases || []).forEach(function (item) {
      html += '<tr><td lang="zh-Hant">' + esc(item.han) + '</td><td lang="sa-Latn">' + esc(item.roman) + '</td><td>' + esc(item.gloss) + '</td></tr>';
    });
    body.innerHTML = html;
    var note = $('phrases-note');
    if (note) { note.textContent = practice.phrasesNote || ''; }
  }

  function renderMudras() {
    var box = $('mudras');
    if (!box || !practice) { return; }
    var html = '';
    (practice.mudras || []).forEach(function (item) {
      html += '<article class="gm-mudra"><h4>' + esc(item.title) + '</h4>';
      if (item.subtitle) { html += '<p class="gm-mudra-sub">' + esc(item.subtitle) + '</p>'; }
      html += '<ol class="gm-steps">';
      (item.steps || []).forEach(function (step) { html += '<li>' + esc(step) + '</li>'; });
      html += '</ol>';
      if (item.note) { html += '<p class="gm-mudra-note">' + esc(item.note) + '</p>'; }
      html += '</article>';
    });
    box.innerHTML = html;
  }

  function renderEssentials() {
    var box = $('essentials');
    if (!box || !practice) { return; }
    box.innerHTML = (practice.essentials || []).map(function (line) { return '<li>' + esc(line) + '</li>'; }).join('');
  }

  function renderPlans() {
    var box = $('plans');
    if (!box || !practice) { return; }
    box.innerHTML = (practice.plans || []).map(function (plan) {
      return '<article class="gm-plan"><div class="gm-plan-top"><span class="gm-plan-label">' + esc(plan.label) + '</span>' +
        '<span class="gm-plan-target">' + esc(plan.target) + '<small> 遍</small></span></div>' +
        '<p>' + esc(plan.desc) + '</p></article>';
    }).join('');
  }

  function renderBenefits() {
    var box = $('benefits');
    if (!box || !mantra) { return; }
    var html = '';
    (mantra.benefits || []).forEach(function (line) {
      var text = asText(line);
      var idx = text.indexOf('：');
      var label = idx > 0 ? text.slice(0, idx) : '其他';
      var body = idx > 0 ? text.slice(idx + 1) : text;
      var type = label.indexOf('經說') !== -1 ? 'sutra' : (label.indexOf('傳統') !== -1 ? 'tradition' : 'other');
      html += '<li class="gm-benefit"><span class="gm-tag' + (type === 'sutra' ? ' is-sutra' : (type === 'tradition' ? ' is-tradition' : '')) + '">' +
        esc(label) + '</span><span>' + esc(body) + '</span></li>';
    });
    box.innerHTML = html;
  }

  function renderSources() {
    var box = $('sources');
    if (!box || !practice) { return; }
    box.innerHTML = (practice.sources || []).map(function (source) {
      var url = asText(source.url);
      var link = /^https?:\/\//i.test(url) ? '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(source.label) + '</a>' : '<span>' + esc(source.label) + '</span>';
      var note = source.note ? '<span class="gm-source-note">' + esc(source.note) + '</span>' : '';
      return '<li>' + link + note + '</li>';
    }).join('');
  }

  function renderPreliminary() {
    var box = $('preliminary');
    if (!box || !practice || !practice.preliminary) { return; }
    var pre = practice.preliminary;
    box.innerHTML = '<summary>' + esc(pre.title) + '（展開）</summary>' +
      '<p>' + esc(pre.intro) + '</p>' +
      '<div class="gm-dh" lang="zh-Hant">' + esc(pre.text) + '</div>' +
      '<p>' + esc(pre.note) + '</p>';
  }

  function renderCautions() {
    var box = $('cautions');
    if (!box || !mantra) { return; }
    box.innerHTML = (mantra.caution || []).map(function (line) { return '<li>' + esc(line) + '</li>'; }).join('');
  }

  function renderDedication() {
    var box = $('dedication');
    if (box) { box.textContent = (practice && practice.dedication) || '願以此功德，普及於一切；我等與眾生，皆共成佛道。'; }
  }

  /* ---------------- 語音朗讀 ---------------- */
  var speakingButton = null;
  var speechToken = 0;
  var nativeTts = window.NativeTts || null;
  /* 只要 APK 有注入 NativeTts 物件就用它，唔可以靠 isAvailable() 做唯一判斷：
     Android TextToSpeech 初始化係非同步，頁面載入後頭一兩秒 isAvailable() 會係 false，
     但 Java 端會將 speak() 存入 pendingTtsText，等引擎就緒即刻補播。
     如果呢度因為 isAvailable() 一時 false 而退回 Web Speech，WebView 根本冇
     speechSynthesis，就會彈「此瀏覽器不支援語音朗讀」。 */
  function hasNativeTts() {
    try {
      if (!nativeTts) { return false; }
      if (typeof nativeTts.speak === 'function') { return true; }
      return !!(nativeTts.isAvailable && nativeTts.isAvailable());
    } catch (e) { return false; }
  }
  function inWebViewShell() {
    try {
      var ua = navigator.userAgent || '';
      return /;\s*wv\)/.test(ua) || /Version\/\d+\.\d+.*Chrome\/\d+/.test(ua) && !/Chrome\/\d+.*Mobile Safari/.test(ua);
    } catch (e) { return false; }
  }
  function stopSpeak() {
    speechToken++;
    if (window.speechSynthesis) { window.speechSynthesis.cancel(); }
    try { if (nativeTts && nativeTts.stop) { nativeTts.stop(); } } catch (e) { /* ignore */ }
    if (speakingButton) {
      speakingButton.setAttribute('aria-pressed', 'false');
      speakingButton.textContent = trText('朗讀');
      speakingButton = null;
    }
  }
  function voiceFor(lang) {
    if (!window.speechSynthesis) { return null; }
    var voices = window.speechSynthesis.getVoices() || [];
    var exact = null;
    var near = null;
    var prefix = String(lang).split('-')[0].toLowerCase();
    voices.forEach(function (voice) {
      var vlang = String(voice.lang || '').toLowerCase();
      if (vlang === String(lang).toLowerCase()) { exact = voice; }
      if (!near && vlang.indexOf(prefix) === 0) { near = voice; }
    });
    return exact || near || null;
  }
  function speakText(text, lang, button) {
    if (!text) { toast(trText('呢段冇嘢可以朗讀')); return; }
    if (hasNativeTts()) {
      stopSpeak();
      speakingButton = button || null;
      if (button) {
        button.setAttribute('aria-pressed', 'true');
        button.textContent = trText('朗讀中');
      }
      try {
        nativeTts.speak(text, lang || 'zh-HK');
        toast(trText('朗讀') + ' ' + lang);
      } catch (e) {
        toast(trText('朗讀失敗：呢部機可能冇合適語音'));
        stopSpeak();
      }
      return;
    }
    if (!('speechSynthesis' in window)) {
      toast(inWebViewShell()
        ? '呢個 App 版本未支援朗讀：請到官網下載最新 APK（v1.1.0 或以上）'
        : trText('呢個瀏覽器唔支援語音朗讀'));
      return;
    }
    stopSpeak();
    var token = speechToken;
    var utterance = new SpeechSynthesisUtterance(text);
    var voice = voiceFor(lang);
    utterance.lang = voice ? voice.lang : lang;
    if (voice) { utterance.voice = voice; }
    utterance.rate = 0.92;
    utterance.onend = function () {
      if (token !== speechToken) { return; }
      if (button) { button.setAttribute('aria-pressed', 'false'); button.textContent = trText('朗讀'); }
      if (speakingButton === button) { speakingButton = null; }
    };
    utterance.onerror = function () {
      if (token !== speechToken) { return; }
      if (button) { button.setAttribute('aria-pressed', 'false'); button.textContent = trText('朗讀'); }
      if (speakingButton === button) { speakingButton = null; }
      toast(trText('朗讀失敗：呢部機可能冇合適語音'));
    };
    speakingButton = button || null;
    if (button) { button.setAttribute('aria-pressed', 'true'); button.textContent = trText('朗讀中'); }
    window.speechSynthesis.speak(utterance);
    toast(voice ? ('朗讀：' + lang) : ('朗讀：' + lang + '（系統預設語音）'));
  }

  window.__nativeTtsEvent = function (type, message) {
    if (type !== 'done' && type !== 'error') { return; }
    if (speakingButton) {
      speakingButton.setAttribute('aria-pressed', 'false');
      speakingButton.textContent = trText('朗讀');
      speakingButton = null;
    }
    if (type === 'error') {
      toast('朗讀失敗：' + (message || '系統語音錯誤'));
    }
  };

  /* ---------------- 播放與自動計次 ---------------- */
  var audio = (window.NativeAudio && window.NativeAudio.available())
    ? window.NativeAudio.create('gm-audio')
    : $('gm-audio');
  var playBtn = $('play-btn');
  var loopBtn = $('loop-btn');
  var plusBtn = $('plus-btn');
  var wakeBtn = $('wake-btn');
  var trackTabs = $('track-tabs');
  var trackBadge = $('track-badge');
  var seek = $('seek');
  var curTime = $('cur-time');
  var durTime = $('dur-time');
  var statusEl = $('player-status');
  var tracks = (mantra && Array.isArray(mantra.audio)) ? mantra.audio.slice() : [];

  var trackIndex = state.settings.track === 1 ? 1 : 0;
  if (trackIndex >= tracks.length) { trackIndex = 0; }
  var sessionLoops = 0;
  var credited = 0;
  var lastTime = 0;
  var duration = 0;
  var per = FALLBACK_PER;
  var seeking = false;
  var lastSeekAt = 0;
  var nativeWrap = false;
  var wakeLock = null;
  var wakeOn = false;
  var pendingPlay = false;
  var userWantsPlay = false;

  /* ===== 2026-11-18 v2.4.1：鎖屏背景播放加固 =====
     根因（兩層）：
     ① 舊預設「全輯循環」用 JS ended 事件換段；手機熄屏後 JS 被凍結，
        12:31 播完冇人換段 → 停。已改預設「單曲循環」用原生 loop。
     ② 舊版靠網絡串流 12 MB 音檔；手機入 Doze／訊號弱時會斷供。
        新增 Blob 預載：成個檔落本機後再播，斷網、鎖屏都唔受影響。
     另加看門狗 + pause 自癒 + MediaSession positionState（見下面）。 */
  var nativePlayer = !!(window.NativeAudio && window.NativeAudio.available && window.NativeAudio.available());
  var blobCache = {};       /* file -> blob URL */
  var blobPending = {};     /* file -> true */
  var blobProgress = {};    /* file -> 0..100 */
  var blobFailed = {};      /* file -> message */
  var lastResumeAttempt = 0;
  var BG_KEY = 'foguang.gm.bgdiag.v1';
  var bgDiag = { sysPause: 0, rescue: 0, last: 0 };
  try {
    var savedBg = JSON.parse(window.localStorage.getItem(BG_KEY) || 'null');
    if (savedBg && typeof savedBg === 'object') {
      bgDiag.sysPause = Math.max(0, Number(savedBg.sysPause) || 0);
      bgDiag.rescue = Math.max(0, Number(savedBg.rescue) || 0);
      bgDiag.last = Math.max(0, Number(savedBg.last) || 0);
    }
  } catch (e) { /* ignore */ }

  function bumpBg(kind) {
    bgDiag[kind] = (bgDiag[kind] || 0) + 1;
    bgDiag.last = Date.now();
    try { window.localStorage.setItem(BG_KEY, JSON.stringify(bgDiag)); } catch (e) { /* ignore */ }
    updateBgDiag();
  }
  function updateBgDiag() {
    var el = $('gm-bgdiag');
    if (!el) { return; }
    var src = (audio && /^blob:/.test(String(audio.src || ''))) ? '本機檔' : (nativePlayer ? '原生播放' : '網絡串流');
    el.textContent = '背景自癒：救回 ' + bgDiag.rescue + ' 次 · 系統暫停 ' + bgDiag.sysPause + ' 次 · 音源：' + src;
  }
  function updatePrefetchLine() {
    var el = $('gm-prefetch');
    if (!el) { return; }
    if (nativePlayer) { el.textContent = '本機預載：APK 原生播放器，由 MediaPlayer 直接讀檔，唔需要網頁預載。'; return; }
    if (!tracks.length) { el.textContent = '本機預載：未配對音檔。'; return; }
    var parts = [];
    tracks.forEach(function (track, index) {
      var key = track.file;
      var label = index === 0 ? '108 遍' : '功德';
      if (blobCache[key]) { parts.push(label + '：已存本機'); }
      else if (blobPending[key]) { parts.push(label + '：' + (blobProgress[key] || 0) + '%'); }
      else if (blobFailed[key]) { parts.push(label + '：' + blobFailed[key]); }
      else { parts.push(label + '：未預載'); }
    });
    el.textContent = '本機預載（' + parts.join(' · ') + '）';
  }
  function prefetchTrack(index, manual) {
    if (nativePlayer || !tracks[index]) { updatePrefetchLine(); return; }
    if (location.protocol === 'file:') { updatePrefetchLine(); return; }
    var track = tracks[index];
    var key = track.file;
    if (!key || blobCache[key] || blobPending[key] || blobFailed[key]) { updatePrefetchLine(); return; }
    if (!manual && navigator.connection && (navigator.connection.saveData || /(^|-)2g$/.test(navigator.connection.effectiveType || ''))) {
      blobFailed[key] = '省數據模式略過';
      updatePrefetchLine();
      return;
    }
    var url = trackUrl(key);
    if (!url) { return; }
    blobPending[key] = true;
    blobProgress[key] = 0;
    updatePrefetchLine();
    fetch(url, { cache: 'force-cache' }).then(function (res) {
      if (!res.ok) { throw new Error('HTTP ' + res.status); }
      var total = Number(res.headers.get('content-length')) || 0;
      if (!res.body || !res.body.getReader) {
        return res.arrayBuffer().then(function (buf) { return { buffer: buf, size: buf.byteLength, total: total }; });
      }
      var reader = res.body.getReader();
      var chunks = [];
      var got = 0;
      function pump() {
        return reader.read().then(function (chunk) {
          if (chunk.done) {
            var out = new Uint8Array(got);
            var off = 0;
            chunks.forEach(function (c) { out.set(c, off); off += c.length; });
            return { buffer: out.buffer, size: got, total: total };
          }
          chunks.push(chunk.value);
          got += chunk.value.length;
          if (total) {
            blobProgress[key] = Math.min(99, Math.round(got / total * 100));
            updatePrefetchLine();
          }
          return pump();
        });
      }
      return pump();
    }).then(function (data) {
      var blob = new Blob([data.buffer], { type: 'audio/mpeg' });
      blobCache[key] = URL.createObjectURL(blob);
      blobPending[key] = false;
      blobProgress[key] = 100;
      updatePrefetchLine();
      /* 如果而家呢一段係暫停狀態，直接換本機檔，保留播放位置。
         播放中就唔打斷，等用家撳暫停或者下次再播先用。 */
      if (index === trackIndex && audio && audio.paused && !userWantsPlay) {
        var pos = audio.currentTime || 0;
        audio.src = blobCache[key];
        audio.load();
        try {
          audio.addEventListener('loadedmetadata', function once() {
            audio.removeEventListener('loadedmetadata', once);
            try { audio.currentTime = pos; } catch (e) { /* ignore */ }
          });
        } catch (e) { /* ignore */ }
      }
      updateBgDiag();
    }).catch(function (error) {
      blobPending[key] = false;
      blobFailed[key] = '預載失敗（' + ((error && error.message) || '網絡') + '）';
      updatePrefetchLine();
    });
  }
  function maybeSwapToBlob() {
    if (nativePlayer || !audio || !audio.paused || userWantsPlay) { return; }
    var track = currentTrack();
    if (!track) { return; }
    var key = track.file;
    if (!blobCache[key] || audio.src === blobCache[key]) { return; }
    var pos = audio.currentTime || 0;
    audio.src = blobCache[key];
    audio.load();
    try {
      audio.addEventListener('loadedmetadata', function once() {
        audio.removeEventListener('loadedmetadata', once);
        try { audio.currentTime = pos; } catch (e) { /* ignore */ }
        syncBaseline();
      });
    } catch (e) { /* ignore */ }
    toast('已改用本機音檔（離線可播）');
  }
  function resumePlayback(reason) {
    if (!audio || !userWantsPlay || audio.ended) { return; }
    if (!audio.paused) { return; }
    var now = Date.now();
    if (now - lastResumeAttempt < 2500) { return; }
    lastResumeAttempt = now;
    var promise;
    try { promise = audio.play(); } catch (e) { return; }
    if (promise && promise.then) {
      promise.then(function () {
        bumpBg('rescue');
        setStatus('播放中：' + (currentTrack() ? currentTrack().label : ''), 'live');
      }).catch(function () { /* 等下一次 watchdog／返前景再試 */ });
    }
  }

  function syncLoopButton() {
    if (!audio || !loopBtn) { return; }
    var mode = state.settings.loopMode || 'one';
    audio.loop = mode === 'one';
    loopBtn.setAttribute('data-no-i18n', '');
    loopBtn.textContent = trText(mode === 'all' ? '全輯循環' : (mode === 'one' ? '單曲循環' : '不循環'));
    loopBtn.setAttribute('aria-pressed', mode === 'off' ? 'false' : 'true');
  }

  function setPlayButton() {
    if (!playBtn) { return; }
    playBtn.setAttribute('data-no-i18n', '');
    playBtn.textContent = trText(audio && !audio.paused ? '暫停' : '播放');
  }

  function setStatus(message, kind) {
    if (!statusEl) { return; }
    lastStatus = { message: message || '', kind: kind || '' };
    statusEl.setAttribute('data-no-i18n', '');
    statusEl.textContent = trText(message || '');
    statusEl.classList.toggle('is-error', kind === 'error');
    statusEl.classList.toggle('is-live', kind === 'live');
  }

  function currentTrack() { return tracks[trackIndex] || null; }

  function updateTrackUI() {
    if (trackTabs) {
      Array.prototype.forEach.call(trackTabs.querySelectorAll('[data-track]'), function (button) {
        var isActive = Number(button.getAttribute('data-track')) === trackIndex;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });
    }
    if (trackBadge) {
      trackBadge.textContent = trackIndex === 0 ? '108 遍' : '功德開示・不計次';
    }
    var current = currentTrack();
    if (playBtn) { playBtn.disabled = !current; }
    if (plusBtn) { plusBtn.disabled = !current; }
  }

  function renderTrackTabs() {
    if (!trackTabs) { return; }
    if (!tracks.length) {
      trackTabs.innerHTML = '<span class="gm-status is-error">未配對音檔，請檢查 data.js。</span>';
      return;
    }
    trackTabs.innerHTML = tracks.map(function (track, index) {
      return '<button class="gm-track' + (index === trackIndex ? ' is-active' : '') + '" type="button" data-track="' + index + '" aria-pressed="' + (index === trackIndex ? 'true' : 'false') + '">' +
        esc(track.label || ('音檔 ' + (index + 1))) + '</button>';
    }).join('');
  }

  function resetSession() {
    sessionLoops = 0;
    credited = 0;
    lastTime = 0;
    duration = 0;
    per = FALLBACK_PER;
    if (seek) { seek.max = 0; seek.value = 0; }
    if (curTime) { curTime.textContent = '0:00'; }
    if (durTime) { durTime.textContent = '0:00'; }
  }

  function syncBaseline() {
    var now = audio ? (audio.currentTime || 0) : 0;
    if (!duration || !isFinite(duration) || duration <= 0) {
      credited = 0;
      lastTime = now;
      return;
    }
    var inLoop = Math.min(TARGET, Math.floor(now / per));
    credited = sessionLoops * TARGET + inLoop;
    lastTime = now;
  }

  function addCount(amount, source) {
    var n = Math.max(0, Math.floor(Number(amount) || 0));
    if (!n) { return; }
    var item = dayData(todayISO());
    if (source === 'manual') { item.manual += n; }
    else { item.auto += n; }
    /* 滿 108 遍自動打卡：唔使另外撳，亦唔會重複。 */
    var justChecked = false;
    if (dayTotal(item) >= TARGET && !item.checked) {
      item.checked = true;
      justChecked = true;
    }
    saveState();
    renderStats();
    renderHistory();
    renderCheckin();
    if (justChecked) { toast('今日滿 108 遍，已自動打卡'); }
  }

  function autoCredit(now) {
    if (!duration || !isFinite(duration) || duration <= 0) { return; }
    var wrapped = lastTime > duration - 1.5 && now < 1.5;
    var jumpedBack = lastTime > 30 && now < lastTime - 30;
    if ((wrapped || jumpedBack) && Date.now() - lastSeekAt > 1200) { sessionLoops++; }
    lastTime = now;
    var inLoop = Math.min(TARGET, Math.floor(now / per));
    var totalNow = sessionLoops * TARGET + inLoop;
    if (totalNow > credited) {
      var delta = totalNow - credited;
      credited = totalNow;
      if (delta <= 5) { addCount(delta, 'auto'); }
    } else if (totalNow < credited - 5) {
      credited = totalNow;
    }
  }

  function updateMediaSession() {
    if (!('mediaSession' in navigator)) { return; }
    try {
      if (window.MediaMetadata) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: trackIndex === 0 ? '光明真言 108 遍' : '光明真言功德開示',
          artist: '佛音靈氣・佛學系統',
          album: '光明真言・專修',
          artwork: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }
          ]
        });
      }
      navigator.mediaSession.playbackState = audio && !audio.paused ? 'playing' : 'paused';
    } catch (e) { /* 唔支援就跳過 */ }
  }

  function enableAudioSession() {
    try {
      if (navigator.audioSession) { navigator.audioSession.type = 'playback'; }
    } catch (e) { /* ignore */ }
  }

  function loadTrack(index, autoplay) {
    var track = tracks[index];
    if (!track) { return; }
    trackIndex = index;
    state.settings.track = index;
    saveState();
    sessionLoops = 0;
    credited = 0;
    lastTime = 0;
    duration = 0;
    per = FALLBACK_PER;
    try { audio.pause(); } catch (e) { /* ignore */ }
    audio.src = blobCache[track.file] || trackUrl(track.file);
    audio.loop = (state.settings.loopMode === 'one');
    audio.load();
    updateTrackUI();
    updateMediaSession();
    setStatus('已選擇：' + (track.label || '音檔') + '；撳「播放」開始。');
    prefetchTrack(index, false);
    pendingPlay = !!autoplay;
    if (!autoplay) { userWantsPlay = false; }
    if (autoplay) { playAudio(); }
  }

  function playAudio() {
    if (!audio || !currentTrack()) { return; }
    if (!audio.src) { loadTrack(trackIndex, false); }
    userWantsPlay = true;
    enableAudioSession();
    var promise = audio.play();
    if (promise && promise.then) {
      promise.then(function () {
        pendingPlay = false;
        updateMediaSession();
      }).catch(function (error) {
        setStatus('播放失敗：' + (error && error.message ? error.message : '瀏覽器阻止播放'), 'error');
      });
    }
  }

  function setupPlayer() {
    if (!audio) { return; }
    renderTrackTabs();
    updateTrackUI();
    syncLoopButton();
    if (tracks.length) { loadTrack(trackIndex, false); }
    else { setStatus('未配對音檔，請檢查 data.js。', 'error'); }

    audio.addEventListener('loadedmetadata', function () {
      duration = (isFinite(audio.duration) && audio.duration > 0) ? audio.duration : 0;
      if (trackIndex === 0 && duration) { per = duration / TARGET; }
      if (durTime) { durTime.textContent = fmtTime(duration); }
      if (seek) { seek.max = Math.floor(duration || 0); }
      if (trackIndex === 0) {
        setStatus('已載入 108 遍音檔（' + fmtTime(duration) + '）；每遍約 ' + (per ? per.toFixed(2) : '6.95') + ' 秒，循環預設開啟。');
      } else {
        setStatus('已載入功德開示（' + fmtTime(duration) + '）；此音檔不計次。');
      }
      updateMediaSession();
    });

    audio.addEventListener('canplay', function () {
      if (pendingPlay) {
        pendingPlay = false;
        playAudio();
      }
    });

    audio.addEventListener('play', function () {
      syncBaseline();
      enableAudioSession();
      setPlayButton();
      setStatus('播放中：' + (currentTrack() ? currentTrack().label : ''), 'live');
      updateMediaSession();
      updateBgDiag();
    });

    audio.addEventListener('pause', function (event) {
      if (event && event.user) { userWantsPlay = false; }
      setPlayButton();
      updateMediaSession();
      if (userWantsPlay && !audio.ended) {
        /* 系統／省電策略主動 pause：唔等 watchdog，即刻排隊救返。 */
        bumpBg('sysPause');
        setStatus('背景播放被系統暫停，正在自動恢復…');
        setTimeout(function () { resumePlayback('pause'); }, 700);
      } else if (!audio.ended) {
        setStatus('已暫停；再撳「播放」可繼續。');
        maybeSwapToBlob();
      }
    });

    audio.addEventListener('timeupdate', function () {
      var now = audio.currentTime || 0;
      if (curTime) { curTime.textContent = fmtTime(now); }
      if (!seeking && seek && isFinite(duration) && duration > 0) {
        seek.value = String(Math.floor(now));
      }
      if (seeking && Date.now() - lastSeekAt > 2000) {
        seeking = false;
        syncBaseline();
      }
      if (trackIndex === 0) { autoCredit(now); }
    });

    audio.addEventListener('seeking', function () {
      var now = audio.currentTime || 0;
      /* 原生 loop 回捲：部分瀏覽器會喺 0 秒 fire seeking／seeked。
         喺呢度先結算上一輪最後一兩遍，避免 seeked 嘅 syncBaseline 沖走 credited。 */
      if (trackIndex === 0 && duration && now < 1 && lastTime > duration - 3) {
        var loopBase = sessionLoops * TARGET;
        var inLoopCredited = credited - loopBase;
        if (inLoopCredited >= TARGET - 2) {
          var remaining = TARGET - inLoopCredited;
          sessionLoops++;
          credited = sessionLoops * TARGET;
          lastTime = 0;
          seeking = false;
          nativeWrap = true;
          if (remaining > 0 && remaining <= 2) { addCount(remaining, 'auto'); }
          return;
        }
      }
      seeking = true;
      lastSeekAt = Date.now();
    });
    audio.addEventListener('seeked', function () {
      if (nativeWrap) {
        nativeWrap = false;
        seeking = false;
        return;
      }
      seeking = false;
      syncBaseline();
      if (trackIndex === 0) { setStatus('已跳到 ' + fmtTime(audio.currentTime || 0) + '；計次由呢度重新對齊。'); }
    });

    audio.addEventListener('ended', function () {
      if (trackIndex === 0) {
        var now = audio.currentTime || 0;
        autoCredit(now);
      }
      var mode = state.settings.loopMode || 'one';
      if (mode === 'all') {
        if (tracks.length) {
          loadTrack((trackIndex + 1) % tracks.length, true);
        }
      } else if (mode === 'off') {
        userWantsPlay = false;
        setPlayButton();
        setStatus('已播完；不循環，唔會自動續播。');
      }
    });

    audio.addEventListener('error', function () {
      setStatus('音檔載入失敗：請確認檔案存在，或用 Chrome／Edge 開啟；上線版需網絡。', 'error');
    });

    if (playBtn) {
      playBtn.addEventListener('click', function () {
        if (audio.paused) {
          playAudio();
        } else {
          userWantsPlay = false;
          audio.pause();
        }
      });
    }

    if (loopBtn) {
      loopBtn.addEventListener('click', function () {
        var modes = ['all', 'one', 'off'];
        var current = modes.indexOf(state.settings.loopMode);
        var next = modes[(current < 0 ? 0 : current + 1) % modes.length];
        state.settings.loopMode = next;
        state.settings.loop = next !== 'off';
        saveState();
        syncLoopButton();
        toast(next === 'all' ? '全輯循環' : (next === 'one' ? '單曲循環' : '不循環'));
      });
    }

    if (plusBtn) {
      plusBtn.addEventListener('click', function () {
        addCount(1, 'manual');
        toast('今日 +1 遍');
      });
    }

    if (seek) {
      seek.addEventListener('input', function () {
        if (!duration || !isFinite(duration)) { return; }
        seeking = true;
        lastSeekAt = Date.now();
        try { audio.currentTime = Number(seek.value) || 0; } catch (e) { /* ignore */ }
      });
      seek.addEventListener('change', function () {
        seeking = false;
        syncBaseline();
      });
    }

    if (trackTabs) {
      trackTabs.addEventListener('click', function (event) {
        var button = event.target && event.target.closest ? event.target.closest('[data-track]') : null;
        if (!button) { return; }
        var index = Number(button.getAttribute('data-track'));
        if (index === trackIndex) {
          if (audio.paused) { playAudio(); }
          return;
        }
        var wasPlaying = !audio.paused;
        loadTrack(index, wasPlaying);
      });
    }

    if (wakeBtn) {
      wakeBtn.addEventListener('click', function () {
        setWake(!wakeOn);
      });
    }

    setupMediaSession();
    updateBgDiag();
    updatePrefetchLine();
    /* 兩段都預載：108 遍 12 MB、功德 1.8 MB。第一次上網落完之後，
       鎖屏、斷網、入 Doze 都照播。 */
    prefetchTrack(0, false);
    prefetchTrack(1, false);
    setInterval(function () {
      if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) { return; }
      if (!duration || !isFinite(duration)) { return; }
      try {
        navigator.mediaSession.setPositionState({
          duration: duration,
          playbackRate: audio.playbackRate || 1,
          position: Math.min(audio.currentTime || 0, duration)
        });
      } catch (e) { /* ignore */ }
    }, 5000);
    /* 看門狗：標記「想播」但實際停咗，每 4 秒救一次。 */
    setInterval(function () {
      if (userWantsPlay && audio && audio.paused && !audio.ended) { resumePlayback('watchdog'); }
    }, 4000);
  }

  function exposeNativeHooks() {
    if (!window) { return; }
    window.__foxueIsPlayingWanted = function () { return !!userWantsPlay; };
    window.__foxueResumeAudio = function () { resumePlayback('native-hook'); };
    window.__foxueBgDiag = function () { return { sysPause: bgDiag.sysPause, rescue: bgDiag.rescue, last: bgDiag.last }; };
  }

  function setupMediaSession() {
    if (!('mediaSession' in navigator)) { return; }
    try {
      navigator.mediaSession.setActionHandler('play', function () { playAudio(); });
      navigator.mediaSession.setActionHandler('pause', function () { userWantsPlay = false; if (audio) { audio.pause(); } });
      navigator.mediaSession.setActionHandler('seekbackward', function () {
        if (audio) { audio.currentTime = Math.max(0, (audio.currentTime || 0) - 15); }
      });
      navigator.mediaSession.setActionHandler('seekforward', function () {
        if (audio && duration) { audio.currentTime = Math.min(duration, (audio.currentTime || 0) + 15); }
      });
    } catch (e) { /* ignore */ }
  }

  /* ---------------- 保持螢幕 ---------------- */
  function updateWakeButton() {
    if (!wakeBtn) { return; }
    wakeBtn.textContent = wakeOn ? '保持螢幕：開' : '保持螢幕';
    wakeBtn.setAttribute('aria-pressed', wakeOn ? 'true' : 'false');
  }
  function setWake(on) {
    if (!('wakeLock' in navigator)) {
      toast('呢個瀏覽器唔支援保持螢幕');
      return;
    }
    if (!on) {
      if (wakeLock) { try { wakeLock.release(); } catch (e) { /* ignore */ } }
      wakeLock = null;
      wakeOn = false;
      updateWakeButton();
      toast('已關閉保持螢幕');
      return;
    }
    navigator.wakeLock.request('screen').then(function (lock) {
      wakeLock = lock;
      wakeOn = true;
      updateWakeButton();
      if (lock.addEventListener) {
        lock.addEventListener('release', function () {
          wakeLock = null;
          wakeOn = false;
          updateWakeButton();
        });
      }
      toast('已保持螢幕常亮（會用多啲電）');
    }).catch(function (error) {
      toast('保持螢幕開唔到：' + (error && error.message ? error.message : ''));
    });
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && wakeOn && !wakeLock) { setWake(true); }
    /* 返前景即查：系統 pause 咗就救返，順便更新診斷。 */
    if (document.visibilityState === 'visible' && userWantsPlay && audio && audio.paused && !audio.ended) {
      resumePlayback('visible');
    }
    updateBgDiag();
  });

  /* ---------------- 功課紀錄 ---------------- */
  function renderHistory() {
    var box = $('history');
    if (!box) { return; }
    var days = [];
    for (var i = 13; i >= 0; i--) { days.push(dateOffset(-i)); }
    var max = 1;
    days.forEach(function (key) {
      var n = dayTotal(state.days[key]);
      if (n > max) { max = n; }
    });
    box.innerHTML = days.map(function (key) {
      var n = dayTotal(state.days[key]);
      var height = n ? Math.max(6, Math.round(n / max * 88)) : 2;
      var date = dateFromKey(key);
      var label = (date.getMonth() + 1) + '/' + date.getDate();
      var cls = 'gm-day' + (n ? '' : ' is-empty') + (key === todayISO() ? ' is-today' : '');
      return '<div class="' + cls + '" title="' + esc(key + '：' + n + ' 遍') + '">' +
        '<span class="gm-day-count">' + (n || '') + '</span>' +
        '<div class="gm-day-bar" style="height:' + height + 'px"></div>' +
        '<span class="gm-day-label">' + esc(label) + '</span></div>';
    }).join('');
    applyLanguage();
  }

  function renderRecordsSummary() {
    var box = $('records-summary');
    if (!box) { return; }
    var t = totals();
    if (!t.total) {
      box.textContent = '本頁紀錄獨立儲存（與主系統功課紀錄分開）。尚未有紀錄；播放 108 遍音檔會自動計次，亦可撳「+1 遍」手動記錄。';
      applyLanguage();
      return;
    }
    var best = t.bestKey ? '（' + t.bestKey + '）' : '';
    if (lang === 'cmn') {
      box.textContent = '本页记录独立 · 最近 7 日 ' + t.week + ' 遍 · 最近 30 日 ' + t.month30 + ' 遍 · 最佳一日 ' + t.best + ' 遍' + best + ' · 连续 ' + t.streak + ' 日。';
    } else if (lang === 'en') {
      box.textContent = 'Records on this page are separate · Last 7 days: ' + t.week + ' · Last 30 days: ' + t.month30 +
        ' · Best day: ' + t.best + (t.bestKey ? ' (' + t.bestKey + ')' : '') + ' · Streak: ' + t.streak + ' days.';
    } else if (lang === 'vi') {
      box.textContent = 'Ghi chép trên trang này riêng biệt · 7 ngày qua: ' + t.week + ' · 30 ngày qua: ' + t.month30 +
        ' · Ngày tốt nhất: ' + t.best + (t.bestKey ? ' (' + t.bestKey + ')' : '') + ' · Chuỗi: ' + t.streak + ' ngày.';
    } else {
      box.textContent = '本頁紀錄獨立 · 最近 7 日 ' + t.week + ' 遍 · 最近 30 日 ' + t.month30 + ' 遍 · 最佳一日 ' + t.best + ' 遍' +
        best + ' · 連續 ' + t.streak + ' 日。';
    }
    applyLanguage();
  }

  function renderNote() {
    var input = $('note-input');
    if (!input) { return; }
    var item = state.days[todayISO()];
    input.value = item && item.note ? item.note : '';
    renderNoteHistory();
    applyLanguage();
  }
  function renderNoteHistory() {
    var box = $('note-history');
    if (!box) { return; }
    var keys = Object.keys(state.days).filter(function (key) {
      return state.days[key] && typeof state.days[key].note === 'string' && state.days[key].note.trim();
    }).sort().reverse().slice(0, 7);
    if (!keys.length) {
      box.innerHTML = '<p class="muted">' + esc(trText('尚未有札記')) + '</p>';
      return;
    }
    box.innerHTML = keys.map(function (key) {
      return '<div class="gm-note-row"><span class="gm-note-date">' + esc(key) + '</span><p>' + esc(state.days[key].note) + '</p></div>';
    }).join('');
  }

  function setSyncStatus(message, isError) {
    var box = $('sync-status');
    if (!box) { return; }
    box.textContent = localizeStatus(message);
    box.classList.toggle('is-error', !!isError);
    box.classList.toggle('is-live', !isError && !!message);
  }

  function syncToMain() {
    var total = todayTotal();
    var today = todayISO();
    if (total < TARGET) {
      setSyncStatus('今日未滿 108 遍（目前 ' + total + ' 遍）；主系統只記完成日，滿 108 遍再同步。', true);
      toast('未滿 108 遍，未同步');
      return;
    }
    var main = null;
    try {
      main = JSON.parse(window.localStorage.getItem(MAIN_KEY) || 'null');
    } catch (e) {
      main = null;
    }
    if (!main || typeof main !== 'object' || Array.isArray(main)) {
      main = {
        version: 1,
        counter: { date: today, count: 0 },
        records: {},
        curriculum: {},
        settings: { beep: true, bigText: false, lastTab: 'records', loop: false }
      };
    }
    if (!main.records || typeof main.records !== 'object' || Array.isArray(main.records)) { main.records = {}; }
    if (!main.curriculum || typeof main.curriculum !== 'object' || Array.isArray(main.curriculum)) { main.curriculum = {}; }
    if (!main.counter || typeof main.counter !== 'object' || Array.isArray(main.counter)) { main.counter = { date: today, count: 0 }; }
    if (!main.settings || typeof main.settings !== 'object' || Array.isArray(main.settings)) {
      main.settings = { beep: true, bigText: false, lastTab: 'records', loop: false };
    }
    var prev = main.records[today];
    var prevRounds = (prev && typeof prev === 'object' && isFinite(Number(prev.rounds))) ? Math.max(0, Math.floor(Number(prev.rounds))) : 0;
    var rounds = Math.floor(total / TARGET);
    main.records[today] = {
      done: true,
      rounds: Math.max(prevRounds, rounds),
      ts: new Date().toISOString(),
      source: 'guangming'
    };
    try {
      window.localStorage.setItem(MAIN_KEY, JSON.stringify(main));
    } catch (e) {
      setSyncStatus('同步失敗：瀏覽器唔准寫入。', true);
      toast('同步失敗：瀏覽器唔准寫入');
      return;
    }
    setSyncStatus('已同步：今日 ' + total + ' 遍（' + rounds + ' 輪）→ 主系統功課紀錄。', false);
    toast('已同步到主系統功課紀錄');
  }

  function saveNote(silent) {
    var input = $('note-input');
    if (!input) { return; }
    var value = input.value.trim().slice(0, 4000);
    var item = dayData(todayISO());
    item.note = value;
    saveState();
    if (!silent) { toast(value ? '札記已儲存' : '札記已清空'); }
    var status = $('note-status');
    if (status) {
      var tm = new Date().toLocaleTimeString(checkinLocale(), { hour: '2-digit', minute: '2-digit' });
      status.textContent = (lang === 'cmn' ? '已保存 ' : (lang === 'en' ? 'Saved ' : (lang === 'vi' ? 'Đã lưu ' : '已儲存 '))) + tm;
    }
    renderNoteHistory();
  }

  function exportRecords() {
    var payload = {
      app: 'foguang.guangming',
      version: 1,
      exportedAt: new Date().toISOString(),
      state: state
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = 'guangming-backup-' + todayISO() + '.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast('紀錄已匯出');
  }

  function importRecords(file) {
    if (!file) { return; }
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(reader.result);
        var raw = parsed && parsed.state ? parsed.state : parsed;
        if (!raw || typeof raw !== 'object') { throw new Error('bad'); }
        if (!window.confirm('匯入會覆蓋本頁現有紀錄，確定繼續？')) { return; }
        state = normalizeState(raw);
        saveState();
        syncLoopButton();
        renderStats();
        renderHistory();
        renderRecordsSummary();
        renderNote();
        toast('紀錄已匯入');
      } catch (e) {
        toast('匯入失敗：檔案格式唔啱');
      }
    };
    reader.readAsText(file);
  }

  function setupRecords() {
    renderHistory();
    renderRecordsSummary();
    renderNote();
    var saveBtn = $('save-note');
    if (saveBtn) { saveBtn.addEventListener('click', function () { saveNote(false); }); }
    var syncBtn = $('sync-btn');
    if (syncBtn) { syncBtn.addEventListener('click', syncToMain); }
    var noteInput = $('note-input');
    if (noteInput) {
      var timer = null;
      noteInput.addEventListener('input', function () {
        clearTimeout(timer);
        timer = setTimeout(function () { saveNote(true); }, 800);
      });
    }
    var exportBtn = $('export-btn');
    if (exportBtn) { exportBtn.addEventListener('click', exportRecords); }
    var importBtn = $('import-btn');
    var importFile = $('import-file');
    if (importBtn && importFile) {
      importBtn.addEventListener('click', function () { importFile.click(); });
      importFile.addEventListener('change', function () {
        importRecords(importFile.files && importFile.files[0]);
        importFile.value = '';
      });
    }
    var clearBtn = $('clear-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        if (!window.confirm('確定清除全部光明真言紀錄？此動作不能復原。')) { return; }
        state = defaultState();
        saveState();
        syncLoopButton();
        renderStats();
        renderHistory();
        renderRecordsSummary();
        renderNote();
        toast('紀錄已清除');
      });
    }
  }

  /* ---------------- 語音事件 ---------------- */
  function setupSpeech() {
    var box = $('passages');
    if (box) {
      box.addEventListener('click', function (event) {
        var button = event.target && event.target.closest ? event.target.closest('.gm-tts') : null;
        if (!button) { return; }
        var passage = (practice.passages || [])[Number(button.getAttribute('data-tts'))];
        var langId = button.getAttribute('data-lang');
        var lang = null;
        LANGS.forEach(function (item) { if (item.id === langId) { lang = item; } });
        if (!passage || !lang) { return; }
        speakText(passage[langId], lang.tts || 'zh-HK', button);
      });
    }
    var stopBtn = $('stop-speak');
    if (stopBtn) {
      stopBtn.addEventListener('click', function () {
        stopSpeak();
        toast(trText('已停止朗讀'));
      });
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = function () { /* 預熱語音清單 */ };
    }
  }

  /* ---------------- 啟動 ---------------- */
  function initChrome() {
    updateTodayChip();
    var foot = $('foot-version');
    if (foot) {
      foot.textContent = '光明真言系統 v2.4.1';
    }
    var brandVersion = $('brand-version');
    if (brandVersion) {
      brandVersion.textContent = 'v2.4.1';
    }
    var intro = $('gm-intro');
    if (intro && practice && practice.intro) { intro.textContent = practice.intro; }
    /* 舊存檔由全輯遷去單曲，講一聲，等用家知道可以自己改返。 */
    if (state.settings && state.settings.bgMigrated) {
      setTimeout(function () {
        toast('為咗鎖屏穩定，循環已改為「單曲」；想全輯可撳循環掣切換。');
      }, 1600);
    }
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) { return; }
    navigator.serviceWorker.register('sw.js').catch(function () { /* 離線快取失敗唔影響主功能 */ });
  }

  function init() {
    initChrome();
    initAuth();
    registerServiceWorker();
    var langButtons = document.querySelectorAll('[data-gmlang]');
    for (var li = 0; li < langButtons.length; li++) {
      langButtons[li].addEventListener('click', function () {
        setLanguage(this.getAttribute('data-gmlang'));
      });
    }
    if (!DATA || !mantra || !practice) {
      var box = $('passages');
      if (box) {
        box.innerHTML = '<p class="gm-status is-error">資料未載入：請確認 data.js 存在，並且 window.FO_DATA 內有 guangming-zhenyan.practice。</p>';
      }
      setStatus('資料未載入，播放器未能啟用。', 'error');
      return;
    }
    renderPassages();
    renderPhrases();
    renderMudras();
    renderEssentials();
    renderPlans();
    renderBenefits();
    renderSources();
    renderPreliminary();
    renderCautions();
    renderDedication();
    reconcileCheckins();
    renderStats();
    setupSpeech();
    setupPassageNotes();
    setupPlayer();
    exposeNativeHooks();
    setupRecords();
    setupCheckin();
    renderNoteHistory();
    setupFocusMode();
    var heroPlay = $('hero-play');
    if (heroPlay) {
      heroPlay.addEventListener('click', function () {
        if (audio && audio.paused) { playAudio(); }
      });
    }
    applyLanguage();
    /* theme.js 喺 DOMContentLoaded 才畫主題掣文字；再掃一次，確保 EN／VI 唔會殘留「主題：黑金」。 */
    setTimeout(applyLanguage, 80);
    var themeBtn = $('theme-toggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', function () { setTimeout(applyLanguage, 0); });
    }
  }

  init();
})();
