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
      settings: { loop: true, loopMode: 'all', track: 0 },
      updated: ''
    };
  }
  function normalizeState(raw) {
    var safe = defaultState();
    if (!raw || typeof raw !== 'object') { return safe; }
    if (raw.days && typeof raw.days === 'object') {
      Object.keys(raw.days).forEach(function (key) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) { return; }
        var item = raw.days[key];
        if (!item || typeof item !== 'object') { return; }
        var auto = Math.max(0, Math.floor(Number(item.auto) || 0));
        var manual = Math.max(0, Math.floor(Number(item.manual) || 0));
        var note = typeof item.note === 'string' ? item.note.slice(0, 4000) : '';
        if (auto || manual || note) {
          safe.days[key] = { auto: auto, manual: manual, note: note };
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
    if (!state.days[k]) { state.days[k] = { auto: 0, manual: 0, note: '' }; }
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
    var ym = todayISO().slice(0, 7);
    keys.forEach(function (key) {
      var n = dayTotal(state.days[key]);
      total += n;
      if (key === todayISO()) { today = n; }
      if (key >= dateOffset(-6) && key <= todayISO()) { week += n; }
      if (key.indexOf(ym) === 0) { month += n; }
      if (key >= dateOffset(-29) && key <= todayISO()) { month30 += n; }
      if (n > best) { best = n; bestKey = key; }
    });
    var streak = 0;
    var cursor = new Date();
    if (dayTotal(state.days[todayISO()]) === 0) { cursor.setDate(cursor.getDate() - 1); }
    while (dayTotal(state.days[todayISO(cursor)]) > 0) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return { total: total, today: today, week: week, month: month, month30: month30, streak: streak, best: best, bestKey: bestKey, days: keys.length };
  }

  /* ---------------- Google 登入／Firestore 同步 ---------------- */
  function setAuthStatus(message) {
    var el = $('gm-sync-status');
    if (el) { el.textContent = message || ''; }
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
      var local = state.days[key] || { auto: 0, manual: 0, note: '' };
      var auto = Math.max(Number(local.auto) || 0, Number(item.auto) || 0);
      var manual = Math.max(Number(local.manual) || 0, Number(item.manual) || 0);
      var note = local.note || (typeof item.note === 'string' ? item.note.slice(0, 4000) : '');
      if (auto !== (Number(local.auto) || 0) || manual !== (Number(local.manual) || 0) || note !== (local.note || '')) {
        state.days[key] = { auto: auto, manual: manual, note: note };
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
        var changed = mergeRemoteDays((doc.data() || {}).guangmingCounts);
        if (changed) {
          saveState();
          renderStats();
          renderHistory();
          renderRecordsSummary();
          renderNote();
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
  function googleRedirect() {
    if (!auth) {
      setAuthStatus('Firebase 未載入，請檢查網絡。');
      return;
    }
    setAuthStatus('正在跳轉 Google 登入…');
    var provider = googleProvider();
    auth.signInWithRedirect(provider).catch(function (e) {
      var code = (e && e.code) || '';
      setAuthStatus(code === 'auth/unauthorized-domain'
        ? '登入失敗：auth/unauthorized-domain（Firebase 授權網域未包含本站）'
        : '跳轉登入失敗：' + (code || '未知'));
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
        setAuthStatus('登入失敗：auth/unauthorized-domain（Firebase 授權網域未包含本站）');
        return;
      }
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setAuthStatus('登入已取消。');
        return;
      }
      setAuthStatus('登入失敗：' + (code || '未知'));
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
      setAuthStatus('Firebase 未載入，請檢查網絡。');
      return;
    }
    auth.getRedirectResult().catch(function () {});
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
        if (userEl) { userEl.textContent = user.displayName || '已登入'; }
        pull().then(push);
      } else {
        if (loginBtn) { loginBtn.hidden = false; }
        if (redirectBtn) { redirectBtn.hidden = true; }
        if (switchBtn) { switchBtn.hidden = true; }
        if (logoutBtn) { logoutBtn.hidden = true; }
        if (avatar) { avatar.hidden = true; avatar.removeAttribute('src'); }
        if (userEl) { userEl.textContent = '未登入'; }
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

  /* ---------------- 共用渲染 ---------------- */
  var LANGS = (practice && practice.languages && practice.languages.length) ? practice.languages : [
    { id: 'yue', label: '粵語', tts: 'yue-Hant-HK' },
    { id: 'zh', label: '普通話', tts: 'zh-CN' },
    { id: 'en', label: 'English', tts: 'en-US' },
    { id: 'vi', label: 'Tiếng Việt', tts: 'vi-VN' }
  ];

  function renderStats() {
    var box = $('gm-stats');
    if (!box) { return; }
    var t = totals();
    box.innerHTML =
      '<div class="stat-card"><span class="stat-label">今日遍數</span><span class="stat-value">' + t.today + '</span><span class="stat-note">自動＋手動</span></div>' +
      '<div class="stat-card"><span class="stat-label">累計遍數</span><span class="stat-value">' + t.total + '</span><span class="stat-note">' + t.days + ' 日有紀錄</span></div>' +
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
  }

  function renderPassages() {
    var box = $('passages');
    if (!box || !practice) { return; }
    var html = '';
    (practice.passages || []).forEach(function (passage, index) {
      html += '<article class="gm-passage" data-passage="' + esc(passage.id || index) + '">';
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
        html += '<div class="gm-lang"><div class="gm-lang-head"><span class="gm-lang-name">' + esc(lang.label) + '</span>' +
          '<button class="gm-tts" type="button" data-tts="' + index + '" data-lang="' + esc(lang.id) + '" aria-pressed="false">朗讀</button></div>' +
          '<p lang="' + esc(lang.tts || '') + '">' + esc(value) + '</p></div>';
      });
      html += '</div></article>';
    });
    box.innerHTML = html;
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
  function stopSpeak() {
    speechToken++;
    if (window.speechSynthesis) { window.speechSynthesis.cancel(); }
    if (speakingButton) {
      speakingButton.setAttribute('aria-pressed', 'false');
      speakingButton.textContent = '朗讀';
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
    if (!text) { toast('呢段冇嘢可以朗讀'); return; }
    if (!('speechSynthesis' in window)) { toast('呢個瀏覽器唔支援語音朗讀'); return; }
    stopSpeak();
    var token = speechToken;
    var utterance = new SpeechSynthesisUtterance(text);
    var voice = voiceFor(lang);
    utterance.lang = voice ? voice.lang : lang;
    if (voice) { utterance.voice = voice; }
    utterance.rate = 0.92;
    utterance.onend = function () {
      if (token !== speechToken) { return; }
      if (button) { button.setAttribute('aria-pressed', 'false'); button.textContent = '朗讀'; }
      if (speakingButton === button) { speakingButton = null; }
    };
    utterance.onerror = function () {
      if (token !== speechToken) { return; }
      if (button) { button.setAttribute('aria-pressed', 'false'); button.textContent = '朗讀'; }
      if (speakingButton === button) { speakingButton = null; }
      toast('朗讀失敗：呢部機可能冇合適語音');
    };
    speakingButton = button || null;
    if (button) { button.setAttribute('aria-pressed', 'true'); button.textContent = '朗讀中'; }
    window.speechSynthesis.speak(utterance);
    toast(voice ? ('朗讀：' + lang) : ('朗讀：' + lang + '（系統預設語音）'));
  }

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

  function syncLoopButton() {
    if (!audio || !loopBtn) { return; }
    var mode = state.settings.loopMode || 'all';
    audio.loop = mode === 'one';
    loopBtn.textContent = mode === 'all' ? '全輯循環' : (mode === 'one' ? '單曲循環' : '不循環');
    loopBtn.setAttribute('aria-pressed', mode === 'off' ? 'false' : 'true');
  }

  function setStatus(message, kind) {
    if (!statusEl) { return; }
    statusEl.textContent = message || '';
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
    saveState();
    renderStats();
    renderHistory();
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
    audio.src = trackUrl(track.file);
    audio.loop = (state.settings.loopMode === 'one');
    audio.load();
    updateTrackUI();
    updateMediaSession();
    setStatus('已選擇：' + (track.label || '音檔') + '；撳「播放」開始。');
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
      if (playBtn) { playBtn.textContent = '暫停'; }
      setStatus('播放中：' + (currentTrack() ? currentTrack().label : ''), 'live');
      updateMediaSession();
    });

    audio.addEventListener('pause', function (event) {
      if (event && event.user) { userWantsPlay = false; }
      if (playBtn) { playBtn.textContent = '播放'; }
      if (!audio.ended) { setStatus('已暫停；再撳「播放」可繼續。'); }
      updateMediaSession();
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
      var mode = state.settings.loopMode || 'all';
      if (mode === 'all') {
        if (tracks.length) {
          loadTrack((trackIndex + 1) % tracks.length, true);
        }
      } else if (mode === 'off') {
        userWantsPlay = false;
        if (playBtn) { playBtn.textContent = '播放'; }
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
  }

  function exposeNativeHooks() {
    if (!window) { return; }
    window.__foxueIsPlayingWanted = function () { return !!userWantsPlay; };
    window.__foxueResumeAudio = function () {
      if (userWantsPlay && audio && audio.paused) { playAudio(); }
    };
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
  }

  function renderRecordsSummary() {
    var box = $('records-summary');
    if (!box) { return; }
    var t = totals();
    if (!t.total) {
      box.textContent = '本頁紀錄獨立儲存（與主系統功課紀錄分開）。尚未有紀錄；播放 108 遍音檔會自動計次，亦可撳「+1 遍」手動記錄。';
      return;
    }
    box.textContent = '本頁紀錄獨立 · 最近 7 日 ' + t.week + ' 遍 · 最近 30 日 ' + t.month30 + ' 遍 · 最佳一日 ' + t.best + ' 遍' +
      (t.bestKey ? '（' + t.bestKey + '）' : '') + ' · 連續 ' + t.streak + ' 日。';
  }

  function renderNote() {
    var input = $('note-input');
    if (!input) { return; }
    var item = state.days[todayISO()];
    input.value = item && item.note ? item.note : '';
  }

  function setSyncStatus(message, isError) {
    var box = $('sync-status');
    if (!box) { return; }
    box.textContent = message || '';
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
    if (status) { status.textContent = '已儲存 ' + new Date().toLocaleTimeString('zh-HK', { hour: '2-digit', minute: '2-digit' }); }
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
        toast('已停止朗讀');
      });
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = function () { /* 預熱語音清單 */ };
    }
  }

  /* ---------------- 啟動 ---------------- */
  function initChrome() {
    var now = new Date();
    var chip = $('today-chip');
    if (chip) {
      chip.textContent = now.getFullYear() + ' 年 ' + (now.getMonth() + 1) + ' 月 ' + now.getDate() + ' 日・星期' + weekdayCN(now);
    }
    var foot = $('foot-version');
    if (foot) {
      foot.textContent = '光明真言系統 v2.2.1';
    }
    var brandVersion = $('brand-version');
    if (brandVersion) {
      brandVersion.textContent = 'v2.2.1';
    }
    var intro = $('gm-intro');
    if (intro && practice && practice.intro) { intro.textContent = practice.intro; }
  }

  function init() {
    initChrome();
    initAuth();
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
    renderStats();
    setupSpeech();
    setupPlayer();
    exposeNativeHooks();
    setupRecords();
    var heroPlay = $('hero-play');
    if (heroPlay) {
      heroPlay.addEventListener('click', function () {
        if (audio && audio.paused) { playAudio(); }
      });
    }
  }

  init();
})();
