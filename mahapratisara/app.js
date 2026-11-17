/* =============================================================
   大隨求陀羅尼・應用邏輯
   - 資料來源：window.MP_DATA（data.js）
   - 四語：粵語／普通話／English／Tiếng Việt
   - 播放：全部循環／單曲循環／不循環；audio.loop 永遠 false，由 ended 控制，
     避免全輯誤變單曲，亦可準確計次。
   - 計次：完整聽完主音檔（≥85% 時長）才自動 +324；手動 +108／+1。
   - 登入：Firebase Google popup（prompt=select_account）；切換帳號／登出；
     Firestore users/{uid}.mahapratisaraDays，合併取較大值。
   - 無 Firebase 時全部功能照用，只存本機。
   ============================================================= */
(function (global) {
  'use strict';

  var DATA = global.MP_DATA;
  var LANGS = ['yue', 'cmn', 'en', 'vi'];
  var LANG_LABEL = { yue: '粵語', cmn: '普通話', en: 'English', vi: 'Tiếng Việt' };
  var LANG_HTML = { yue: 'zh-Hant-HK', cmn: 'zh-CN', en: 'en', vi: 'vi' };
  var STORAGE_KEY = 'mahapratisara.state.v1';
  var FIREBASE_OPTIONS = {
    projectId: 'foyin-lingqi-app',
    apiKey: 'AIzaSyDsU4vkNL9K34cWkobGQ8L4qDkdPtzTJcw',
    authDomain: 'foyin-lingqi-app.firebaseapp.com',
    appId: '1:958708359043:web:dac69e63a7572ad67ea0b6'
  };
  var TARGET = 324;
  var VERSION = (DATA && DATA.meta && DATA.meta.version) ? DATA.meta.version : '1.0.0';
  var MODES = ['all', 'one', 'off'];

  if (!DATA || !DATA.i18n) {
    var main = document.getElementById('main');
    if (main) {
      main.innerHTML = '<section class="panel"><h3>資料載入失敗</h3><p>找不到 data.js 或格式不正確，請重新整理；若問題持續，請檢查 data.js 語法。</p></section>';
    }
    return;
  }

  /* ---------------- 小工具 ---------------- */
  function byId(id) { return document.getElementById(id); }
  function setText(id, text) {
    var node = byId(id);
    if (node) { node.textContent = text == null ? '' : String(text); }
  }
  function setHidden(id, hidden) {
    var node = byId(id);
    if (node) { node.classList.toggle('hidden', !!hidden); }
  }
  function pad2(n) { return n < 10 ? '0' + n : String(n); }
  function todayKey() { return dateKey(new Date()); }
  function dateKey(date) {
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
  }
  function dateKeyOffset(offset) {
    var d = new Date();
    d.setDate(d.getDate() + offset);
    return dateKey(d);
  }
  function fmtTime(seconds) {
    var s = Number(seconds);
    if (!isFinite(s) || s < 0) { s = 0; }
    var m = Math.floor(s / 60);
    var sec = Math.floor(s % 60);
    return m + ':' + pad2(sec);
  }
  function fmtNum(n) {
    var v = Math.max(0, Math.floor(Number(n) || 0));
    return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  function clampCount(n) {
    return Math.max(0, Math.min(999999999, Math.floor(Number(n) || 0)));
  }
  function toast(message) {
    var root = byId('toast-root');
    if (!root) { return; }
    var node = document.createElement('div');
    node.className = 'toast';
    node.textContent = message;
    root.appendChild(node);
    while (root.children.length > 3) { root.removeChild(root.firstChild); }
    setTimeout(function () {
      if (node.parentNode) { node.parentNode.removeChild(node); }
    }, 3400);
  }
  function isIOS() {
    var ua = navigator.userAgent || '';
    if (/iPad|iPhone|iPod/.test(ua)) { return true; }
    return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  }
  function isStandalone() {
    return (global.matchMedia && global.matchMedia('(display-mode: standalone)').matches) ||
      navigator.standalone === true;
  }

  /* ---------------- 狀態 ---------------- */
  function defaultState() {
    return {
      version: 1,
      lang: 'yue',
      theme: 'dark',
      days: {},
      settings: { loopMode: 'all', trackId: 'main', wake: false }
    };
  }

  function normalizeState(raw) {
    var safe = defaultState();
    if (!raw || typeof raw !== 'object') { return safe; }

    if (LANGS.indexOf(raw.lang) !== -1) { safe.lang = raw.lang; }
    if (raw.theme === 'light' || raw.theme === 'dark') { safe.theme = raw.theme; }

    if (raw.days && typeof raw.days === 'object') {
      Object.keys(raw.days).forEach(function (key) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) { return; }
        var item = raw.days[key];
        if (!item || typeof item !== 'object') { return; }
        var count = clampCount(item.count);
        if (!count) { return; }
        safe.days[key] = {
          count: count,
          auto: clampCount(item.auto),
          manual: clampCount(item.manual),
          ts: typeof item.ts === 'string' ? item.ts : ''
        };
      });
    }

    if (raw.settings && typeof raw.settings === 'object') {
      if (MODES.indexOf(raw.settings.loopMode) !== -1) { safe.settings.loopMode = raw.settings.loopMode; }
      if (typeof raw.settings.trackId === 'string' && raw.settings.trackId) { safe.settings.trackId = raw.settings.trackId; }
      safe.settings.wake = raw.settings.wake === true;
    }
    return safe;
  }

  var storageBroken = false;
  var storageNoticeShown = false;
  function loadState() {
    try {
      var raw = global.localStorage.getItem(STORAGE_KEY);
      return raw ? normalizeState(JSON.parse(raw)) : defaultState();
    } catch (e) {
      storageBroken = true;
      return defaultState();
    }
  }
  var state = loadState();

  function saveState() {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      storageBroken = true;
      if (!storageNoticeShown) {
        storageNoticeShown = true;
        toast('此瀏覽器唔准儲存紀錄（可能係私隱模式），今次紀錄重新整理後會消失。');
      }
    }
  }

  function countFor(key) {
    var item = state.days[key];
    return item ? clampCount(item.count) : 0;
  }
  function ensureDay(key) {
    if (!state.days[key]) {
      state.days[key] = { count: 0, auto: 0, manual: 0, ts: '' };
    }
    return state.days[key];
  }
  function totalCount() {
    var total = 0;
    Object.keys(state.days).forEach(function (key) { total += countFor(key); });
    return total;
  }
  function calculateStreak() {
    var streak = 0;
    var cursor = new Date();
    if (countFor(todayKey()) === 0) { cursor.setDate(cursor.getDate() - 1); }
    for (var i = 0; i < 3660; i++) {
      if (countFor(dateKey(cursor)) > 0) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  }

  /* ---------------- 全域 ---------------- */
  var L = DATA.i18n[state.lang] || DATA.i18n.yue;
  var els = {};
  var audio = null;
  var currentTrackIndex = 0;
  var currentMantraTab = 'common';
  var wantsPlay = false;
  var switching = false;
  var seeking = false;
  var listened = 0;
  var lastTime = 0;
  var completedGuard = false;
  var wakeLock = null;
  var installPrompt = null;
  var firebaseAuth = null;
  var firestore = null;
  var currentUser = null;
  var authSyncState = 'local';
  var authMessage = '';
  var pushTimer = null;

  function cacheEls() {
    els = {
      langSwitch: byId('lang-switch'),
      themeToggle: byId('theme-toggle'),
      installBtn: byId('install-btn'),
      installBtn2: byId('install-btn-2'),
      siteTitle: byId('site-title'),
      brandSub: byId('brand-sub'),
      versionPill: byId('version-pill'),
      heroBadge: byId('hero-badge'),
      heroTitle: byId('hero-title'),
      heroLead: byId('hero-lead'),
      heroPlay: byId('hero-play'),
      heroRead: byId('hero-read'),
      heroTalk: byId('hero-talk'),
      heroMeta: byId('hero-meta'),
      statTodayLabel: byId('stat-today-label'),
      statTotalLabel: byId('stat-total-label'),
      statStreakLabel: byId('stat-streak-label'),
      statToday: byId('stat-today'),
      statTotal: byId('stat-total'),
      statStreak: byId('stat-streak'),
      playerTitle: byId('player-title'),
      loopLabel: byId('loop-label'),
      trackTabs: byId('track-tabs'),
      playBtn: byId('play-btn'),
      playIcon: byId('play-icon'),
      playLabel: byId('play-label'),
      curTime: byId('cur-time'),
      seek: byId('seek'),
      durTime: byId('dur-time'),
      playerStatus: byId('player-status'),
      loopBtn: byId('loop-btn'),
      wakeBtn: byId('wake-btn'),
      countHint: byId('count-hint'),
      counterTitle: byId('counter-title'),
      targetPill: byId('target-pill'),
      todayCount: byId('today-count'),
      todayLabel: byId('today-label'),
      todayProgress: byId('today-progress'),
      todayBar: byId('today-bar'),
      roundsLabel: byId('rounds-label'),
      add108: byId('add-108'),
      add1: byId('add-1'),
      resetToday: byId('reset-today'),
      historyTitle: byId('history-title'),
      exportBtn: byId('export-btn'),
      importBtn: byId('import-btn'),
      clearBtn: byId('clear-btn'),
      importFile: byId('import-file'),
      history: byId('history'),
      recordsIntro: byId('records-intro'),
      mantraTitle: byId('mantra-title'),
      mantraSourcePill: byId('mantra-source-pill'),
      mantraIntro: byId('mantra-intro'),
      mantraTabs: byId('mantra-tabs'),
      mantraDisplay: byId('mantra-display'),
      meaningTitle: byId('meaning-title'),
      mantraMeaning: byId('mantra-meaning'),
      mantraNote: byId('mantra-note'),
      benefitsTitle: byId('benefits-title'),
      benefitGroups: byId('benefit-groups'),
      cautionTitle: byId('caution-title'),
      cautionList: byId('caution-list'),
      practiceTitle: byId('practice-title'),
      practiceIntro: byId('practice-intro'),
      practiceSteps: byId('practice-steps'),
      sourceTitle: byId('source-title'),
      sourceIntro: byId('source-intro'),
      sourceList: byId('source-list'),
      sourceNote: byId('source-note'),
      heartTitle: byId('heart-title'),
      heartIntro: byId('heart-intro'),
      heartSource: byId('heart-source'),
      heartDisplay: byId('heart-display'),
      faqTitle: byId('faq-title'),
      faqList: byId('faq-list'),
      accountTitle: byId('account-title'),
      syncState: byId('sync-state'),
      syncMessage: byId('sync-message'),
      avatar: byId('avatar'),
      signIn: byId('sign-in'),
      switchAccount: byId('switch-account'),
      signOut: byId('sign-out'),
      footerVersion: byId('footer-version'),
      footerSources: byId('footer-sources'),
      footerDisclaimer: byId('footer-disclaimer'),
      footerDedication: byId('footer-dedication'),
      skipLink: byId('skip-link'),
      toastRoot: byId('toast-root')
    };
  }

  /* ---------------- 語言／主題 ---------------- */
  function setLang(code) {
    if (LANGS.indexOf(code) === -1 || code === state.lang) { return; }
    state.lang = code;
    saveState();
    renderAll();
  }

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', state.theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) { meta.setAttribute('content', state.theme === 'dark' ? '#050505' : '#f7f1e3'); }
    var btn = els.themeToggle;
    if (btn) {
      btn.textContent = L.theme + '：' + (state.theme === 'dark' ? L.themeDark : L.themeLight);
      btn.setAttribute('aria-pressed', state.theme === 'dark' ? 'true' : 'false');
    }
  }

  function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    saveState();
    applyTheme();
  }

  function renderLangSwitch() {
    if (!els.langSwitch) { return; }
    els.langSwitch.innerHTML = '';
    els.langSwitch.setAttribute('aria-label', '語言');
    LANGS.forEach(function (code) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'lang-btn';
      btn.textContent = LANG_LABEL[code];
      btn.setAttribute('aria-pressed', code === state.lang ? 'true' : 'false');
      btn.addEventListener('click', function () { setLang(code); });
      els.langSwitch.appendChild(btn);
    });
  }

  /* ---------------- 靜態文字 ---------------- */
  function renderStatic() {
    setText('skip-link', L.skip);
    document.title = L.hero.title + ' v' + VERSION;
    setText('site-title', L.hero.title);
    setText('brand-sub', DATA.meta.lineage[state.lang] || L.hero.badge);
    setText('version-pill', 'v' + VERSION);
    setText('hero-badge', L.hero.badge);
    setText('hero-title', L.hero.title);
    setText('hero-lead', L.hero.lead);
    setText('hero-play', L.hero.start);
    setText('hero-read', L.hero.read);
    setText('hero-talk', L.hero.talk);
    setText('hero-meta', DATA.meta.sourceShort[state.lang] || '');
    setText('stat-today-label', L.counter.today);
    setText('stat-total-label', L.counter.total);
    setText('stat-streak-label', L.counter.streak);
    setText('player-title', L.player.title);
    setText('count-hint', L.player.countHint);
    setText('counter-title', L.counter.title);
    setText('today-label', L.counter.today);
    setText('target-pill', L.counter.target);
    setText('add-108', L.counter.plus108);
    setText('add-1', L.counter.plus1);
    setText('reset-today', L.counter.reset);
    setText('history-title', L.counter.history);
    setText('export-btn', L.counter.export);
    setText('import-btn', L.counter.import);
    setText('clear-btn', L.counter.clear);
    setText('records-intro', L.records.intro);
    setText('mantra-title', L.mantra.title);
    setText('mantra-intro', L.mantra.intro);
    setText('meaning-title', DATA.mantra.labels[state.lang].meaning);
    setText('mantra-note', DATA.mantra.note[state.lang]);
    setText('benefits-title', L.benefits.title);
    setText('caution-title', L.benefits.cautionTitle);
    setText('practice-title', L.practice.title);
    setText('practice-intro', L.practice.intro);
    setText('source-title', L.source.title);
    setText('source-intro', L.source.intro);
    setText('source-note', L.source.note);
    setText('faq-title', L.faq.title);
    setText('account-title', L.auth.title);
    setText('sign-in', L.auth.signIn);
    setText('switch-account', L.auth.switch);
    setText('sign-out', L.auth.signOut);
    setText('footer-version', L.hero.title + ' v' + VERSION);
    setText('footer-sources', L.footer.sources);
    setText('footer-disclaimer', L.footer.disclaimer);
    setText('footer-dedication', L.footer.dedication);
    setText('install-btn', L.install);
    setText('install-btn-2', L.install);
    if (els.trackTabs) { els.trackTabs.setAttribute('aria-label', L.player.switchTrack); }
  }

  /* ---------------- 咒文 ---------------- */
  function renderMantra() {
    var labels = DATA.mantra.labels[state.lang];
    var tabs = [
      { key: 'canon', label: labels.canon },
      { key: 'common', label: labels.common },
      { key: 'roman', label: labels.roman },
      { key: 'sanskrit', label: labels.sanskrit }
    ];
    if (tabs.map(function (t) { return t.key; }).indexOf(currentMantraTab) === -1) {
      currentMantraTab = 'common';
    }

    els.mantraTabs.innerHTML = '';
    tabs.forEach(function (tab) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mantra-tab';
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', tab.key === currentMantraTab ? 'true' : 'false');
      btn.tabIndex = tab.key === currentMantraTab ? 0 : -1;
      btn.textContent = tab.label;
      btn.addEventListener('click', function () {
        currentMantraTab = tab.key;
        renderMantra();
      });
      els.mantraTabs.appendChild(btn);
    });

    var text = '';
    if (currentMantraTab === 'canon') { text = DATA.mantra.canonHan; }
    else if (currentMantraTab === 'common') { text = DATA.mantra.commonHan; }
    else if (currentMantraTab === 'roman') { text = DATA.mantra.roman; }
    else { text = DATA.mantra.sanskrit; }

    els.mantraDisplay.innerHTML = '';
    var textNode = document.createElement('div');
    textNode.className = 'mantra-text';
    if (currentMantraTab === 'roman') { textNode.className += ' roman'; }
    if (currentMantraTab === 'sanskrit') { textNode.className += ' sanskrit'; }
    textNode.textContent = text;
    els.mantraDisplay.appendChild(textNode);
    setText('mantra-source-pill', labels[currentMantraTab]);
    setText('mantra-meaning', DATA.mantra.meaning[state.lang]);
  }

  /* ---------------- 功德 ---------------- */
  function renderBenefits() {
    els.benefitGroups.innerHTML = '';
    L.benefits.groups.forEach(function (group) {
      var wrap = document.createElement('div');
      wrap.className = 'benefit-group';
      var title = document.createElement('h4');
      var badge = document.createElement('span');
      badge.className = 'type-badge ' + (group.type === 'sutra' ? 'type-sutra' : 'type-tradition');
      badge.textContent = group.type === 'sutra' ? L.benefits.sutra : L.benefits.tradition;
      title.appendChild(badge);
      wrap.appendChild(title);
      var list = document.createElement('ul');
      list.className = 'benefit-list';
      group.items.forEach(function (item) {
        var li = document.createElement('li');
        li.textContent = item;
        list.appendChild(li);
      });
      wrap.appendChild(list);
      els.benefitGroups.appendChild(wrap);
    });

    els.cautionList.innerHTML = '';
    L.benefits.cautions.forEach(function (item) {
      var li = document.createElement('li');
      li.textContent = item;
      els.cautionList.appendChild(li);
    });
  }

  /* ---------------- 實修 ---------------- */
  function renderPractice() {
    els.practiceSteps.innerHTML = '';
    L.practice.steps.forEach(function (step) {
      var li = document.createElement('li');
      li.className = 'step';
      var body = document.createElement('div');
      var h = document.createElement('h4');
      h.textContent = step.title;
      var p = document.createElement('p');
      p.textContent = step.text;
      body.appendChild(h);
      body.appendChild(p);
      li.appendChild(body);
      els.practiceSteps.appendChild(li);
    });
  }

  /* ---------------- 出處 ---------------- */
  function renderSources() {
    els.sourceList.innerHTML = '';
    DATA.sources.forEach(function (source) {
      var li = document.createElement('li');
      li.className = 'source-item';
      if (source.url) {
        var a = document.createElement('a');
        a.href = source.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = source.label;
        li.appendChild(a);
      } else {
        li.appendChild(document.createTextNode(source.label));
      }
      if (source.note) {
        var p = document.createElement('p');
        p.textContent = source.note;
        li.appendChild(p);
      }
      els.sourceList.appendChild(li);
    });
  }

  /* ---------------- 佛心經附錄 ---------------- */
  function renderHeart() {
    setText('heart-title', DATA.heart.title[state.lang]);
    setText('heart-intro', DATA.heart.intro[state.lang]);
    setText('heart-source', DATA.heart.source[state.lang]);
    els.heartDisplay.innerHTML = '';
    var labels = (DATA.heart.labels && DATA.heart.labels[state.lang]) || { han: '漢譯', roman: '羅馬轉寫' };
    [
      { label: labels.han, text: DATA.heart.han, roman: false },
      { label: labels.roman, text: DATA.heart.roman, roman: true }
    ].forEach(function (item) {
      var lab = document.createElement('div');
      lab.className = 'muted';
      lab.textContent = item.label;
      var p = document.createElement('p');
      p.className = 'mantra-text' + (item.roman ? ' roman' : '');
      p.style.margin = '0 0 .8rem';
      p.textContent = item.text;
      els.heartDisplay.appendChild(lab);
      els.heartDisplay.appendChild(p);
    });
  }

  /* ---------------- FAQ ---------------- */
  function renderFaq() {
    els.faqList.innerHTML = '';
    L.faq.items.forEach(function (item) {
      var details = document.createElement('details');
      details.className = 'faq-item';
      var summary = document.createElement('summary');
      summary.textContent = item.q;
      var p = document.createElement('p');
      p.textContent = item.a;
      details.appendChild(summary);
      details.appendChild(p);
      els.faqList.appendChild(details);
    });
  }

  /* ---------------- 計數 ---------------- */
  function addCount(n, kind) {
    var add = clampCount(n);
    if (!add) { return; }
    var day = ensureDay(todayKey());
    day.count = clampCount(day.count + add);
    if (kind === 'auto') { day.auto = clampCount(day.auto + add); }
    else { day.manual = clampCount(day.manual + add); }
    day.ts = new Date().toISOString();
    saveState();
    renderCounters();
    renderHistory();
    schedulePush();
  }

  function resetToday() {
    if (!global.confirm(L.counter.confirmReset)) { return; }
    delete state.days[todayKey()];
    saveState();
    renderCounters();
    renderHistory();
    schedulePush();
  }

  function clearAllRecords() {
    if (!global.confirm(L.counter.confirmClear)) { return; }
    state.days = {};
    saveState();
    renderCounters();
    renderHistory();
    schedulePush();
  }

  function renderCounters() {
    var today = countFor(todayKey());
    var total = totalCount();
    var streak = calculateStreak();
    var rounds = Math.floor(today / TARGET);

    setText('stat-today', fmtNum(today));
    setText('stat-total', fmtNum(total));
    setText('stat-streak', String(streak));
    setText('today-count', fmtNum(today));
    setText('rounds-label', L.counter.rounds + '：' + rounds);
    if (els.todayProgress) {
      els.todayProgress.setAttribute('aria-valuenow', String(Math.min(today, TARGET)));
      els.todayProgress.setAttribute('aria-valuemax', String(TARGET));
    }
    if (els.todayBar) {
      els.todayBar.style.width = Math.min(100, (today / TARGET) * 100) + '%';
    }
  }

  function renderHistory() {
    if (!els.history) { return; }
    var list = [];
    for (var i = 13; i >= 0; i--) {
      var date = new Date();
      date.setDate(date.getDate() - i);
      var key = dateKey(date);
      list.push({ key: key, date: date, count: countFor(key) });
    }
    var max = TARGET;
    list.forEach(function (item) { if (item.count > max) { max = item.count; } });
    var hasAny = false;
    list.forEach(function (item) { if (item.count > 0) { hasAny = true; } });

    els.history.innerHTML = '';
    if (!hasAny) {
      var empty = document.createElement('p');
      empty.className = 'muted';
      empty.style.gridColumn = '1 / -1';
      empty.textContent = L.counter.noHistory;
      els.history.appendChild(empty);
      return;
    }

    list.forEach(function (item) {
      var day = document.createElement('div');
      day.className = 'history-day';
      day.title = item.key + '：' + fmtNum(item.count) + ' ' + L.counter.today;
      day.setAttribute('aria-label', item.key + '：' + fmtNum(item.count));

      var bar = document.createElement('div');
      bar.className = 'history-bar' + (item.count ? '' : ' empty');
      bar.style.height = (item.count ? Math.max(6, Math.round((item.count / max) * 64)) : 3) + 'px';
      day.appendChild(bar);

      var dateLabel = document.createElement('span');
      dateLabel.className = 'history-date';
      dateLabel.textContent = (item.date.getMonth() + 1) + '/' + item.date.getDate();
      day.appendChild(dateLabel);

      var value = document.createElement('span');
      value.className = 'history-value';
      value.textContent = item.count ? fmtNum(item.count) : '';
      day.appendChild(value);

      els.history.appendChild(day);
    });
  }

  /* ---------------- 播放器 ---------------- */
  function currentTrack() {
    return DATA.audio[currentTrackIndex] || DATA.audio[0] || null;
  }
  function audioSrc(track) {
    if (!track) { return ''; }
    /* file:// 直接讀工作區原始音檔；http(s)（包括本機測試、GitHub Pages）用上線包音檔。 */
    return global.location.protocol === 'file:' ? track.file : (track.deploy || track.file);
  }
  function loopLabel() {
    if (state.settings.loopMode === 'one') { return L.player.modeOne; }
    if (state.settings.loopMode === 'off') { return L.player.modeOff; }
    return L.player.modeAll;
  }
  function setStatus(text) {
    setText('player-status', text);
  }

  function updateTimes() {
    if (!audio) { return; }
    var track = currentTrack();
    var duration = (isFinite(audio.duration) && audio.duration > 0) ? audio.duration : (track ? track.duration : 0);
    var current = isFinite(audio.currentTime) ? audio.currentTime : 0;
    setText('cur-time', fmtTime(current));
    setText('dur-time', fmtTime(duration));
    if (els.seek) {
      var max = Math.max(0, Math.floor(duration));
      if (els.seek.max !== String(max)) { els.seek.max = String(max); }
      if (!seeking) { els.seek.value = String(Math.min(Math.floor(current), max)); }
    }
  }

  function renderPlayerText() {
    if (!audio) { return; }
    var playing = !audio.paused && !audio.ended;
    setText('play-icon', playing ? '❚❚' : '▶');
    setText('play-label', playing ? L.player.pause : L.player.play);
    if (els.playBtn) {
      els.playBtn.setAttribute('aria-label', playing ? L.player.pause : L.player.play);
      els.playBtn.classList.toggle('is-playing', playing);
    }
    setText('loop-label', loopLabel());
    setText('loop-btn', loopLabel());
    setText('wake-btn', state.settings.wake ? L.player.wakeOn : L.player.wake);
    if (els.wakeBtn) { els.wakeBtn.setAttribute('aria-pressed', state.settings.wake ? 'true' : 'false'); }

    if (audio.error) {
      setStatus(L.player.error);
    } else if (playing) {
      setStatus(L.player.statusPlaying);
    } else if (audio.ended) {
      setStatus(L.player.statusEnded);
    } else if ((audio.currentTime || 0) > 0) {
      setStatus(L.player.statusPaused);
    } else {
      setStatus(L.player.statusReady);
    }
  }

  function renderTrackTabs() {
    if (!els.trackTabs) { return; }
    els.trackTabs.innerHTML = '';
    DATA.audio.forEach(function (track, index) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'track-tab';
      btn.textContent = track.label[state.lang];
      btn.setAttribute('aria-pressed', index === currentTrackIndex ? 'true' : 'false');
      btn.addEventListener('click', function () {
        if (index === currentTrackIndex) { return; }
        var wasPlaying = !audio.paused;
        selectTrack(index, wasPlaying);
      });
      els.trackTabs.appendChild(btn);
    });
  }

  function selectTrack(index, autoplay) {
    if (!DATA.audio.length) { return; }
    if (index < 0 || index >= DATA.audio.length) { index = 0; }
    var track = DATA.audio[index];
    switching = true;
    if (audio) {
      try { audio.pause(); } catch (e) {}
      currentTrackIndex = index;
      state.settings.trackId = track.id;
      saveState();
      listened = 0;
      lastTime = 0;
      completedGuard = false;
      audio.loop = false;
      audio.src = audioSrc(track);
      audio.load();
    }
    renderTrackTabs();
    updateTimes();
    if (autoplay) {
      playAudio();
    } else {
      setStatus(L.player.statusReady);
      renderPlayerText();
    }
    switching = false;
  }

  function playAudio() {
    if (!audio || !DATA.audio.length) { return; }
    if (!audio.src) { selectTrack(currentTrackIndex, false); }
    wantsPlay = true;
    var promise;
    try {
      promise = audio.play();
    } catch (e) {
      wantsPlay = false;
      setStatus(L.player.error);
      renderPlayerText();
      return;
    }
    if (promise && promise.then) {
      promise.then(function () {
        setStatus(L.player.statusPlaying);
        renderPlayerText();
        if (state.settings.wake) { requestWake(); }
      }).catch(function () {
        wantsPlay = false;
        setStatus(L.player.error);
        renderPlayerText();
        releaseWake();
      });
    } else {
      setStatus(L.player.statusPlaying);
      renderPlayerText();
    }
  }

  function pauseAudio() {
    wantsPlay = false;
    if (audio) {
      try { audio.pause(); } catch (e) {}
    }
    setStatus(L.player.statusPaused);
    renderPlayerText();
    releaseWake();
  }

  function togglePlay() {
    if (!audio) { return; }
    if (audio.paused || audio.ended) { playAudio(); }
    else { pauseAudio(); }
  }

  function cycleLoop() {
    var index = MODES.indexOf(state.settings.loopMode);
    state.settings.loopMode = MODES[(index + 1) % MODES.length];
    saveState();
    renderPlayerText();
  }

  function handleEnded() {
    var track = currentTrack();
    if (track && track.kind === 'main' && !completedGuard) {
      var duration = (isFinite(audio.duration) && audio.duration > 0) ? audio.duration : track.duration;
      if (duration && listened >= duration * 0.85) {
        addCount(track.count || TARGET, 'auto');
        completedGuard = true;
      }
    }
    listened = 0;
    lastTime = 0;

    if (state.settings.loopMode === 'one') {
      completedGuard = false;
      try { audio.currentTime = 0; } catch (e) {}
      playAudio();
      return;
    }
    if (state.settings.loopMode === 'all') {
      selectTrack((currentTrackIndex + 1) % DATA.audio.length, true);
      return;
    }
    if (currentTrackIndex < DATA.audio.length - 1) {
      selectTrack(currentTrackIndex + 1, true);
    } else {
      wantsPlay = false;
      renderPlayerText();
      setStatus(L.player.statusEnded);
      releaseWake();
    }
  }

  function updateMediaMetadata() {
    if (!('mediaSession' in navigator)) { return; }
    try {
      var track = currentTrack();
      var trackName = track ? track.label[state.lang] : L.player.title;
      if (typeof MediaMetadata !== 'undefined') {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: L.hero.title + ' · ' + trackName,
          artist: L.hero.title,
          album: 'Mahāpratisarā'
        });
      }
    } catch (e) {}
  }

  function initMediaSession() {
    if (!('mediaSession' in navigator)) { return; }
    try {
      navigator.mediaSession.setActionHandler('play', function () { playAudio(); });
      navigator.mediaSession.setActionHandler('pause', function () { pauseAudio(); });
      navigator.mediaSession.setActionHandler('seekbackward', function (details) {
        if (!audio) { return; }
        audio.currentTime = Math.max(0, (audio.currentTime || 0) - ((details && details.seekOffset) || 10));
      });
      navigator.mediaSession.setActionHandler('seekforward', function (details) {
        if (!audio) { return; }
        var d = (isFinite(audio.duration) ? audio.duration : currentTrack().duration);
        audio.currentTime = Math.min(d, (audio.currentTime || 0) + ((details && details.seekOffset) || 10));
      });
      navigator.mediaSession.setActionHandler('seekto', function (details) {
        if (!audio || !details || details.seekTime == null) { return; }
        audio.currentTime = details.seekTime;
      });
      navigator.mediaSession.setActionHandler('previoustrack', function () {
        selectTrack(Math.max(0, currentTrackIndex - 1), !audio.paused);
      });
      navigator.mediaSession.setActionHandler('nexttrack', function () {
        selectTrack(Math.min(DATA.audio.length - 1, currentTrackIndex + 1), !audio.paused);
      });
    } catch (e) {}
  }

  /* ---------------- 保持螢幕 ---------------- */
  function requestWake() {
    if (!('wakeLock' in navigator) || wakeLock) { return; }
    try {
      navigator.wakeLock.request('screen').then(function (lock) {
        wakeLock = lock;
        lock.addEventListener('release', function () { wakeLock = null; });
      }).catch(function () {});
    } catch (e) {}
  }
  function releaseWake() {
    if (wakeLock) {
      try { wakeLock.release().catch(function () {}); } catch (e) {}
      wakeLock = null;
    }
  }
  function toggleWake() {
    state.settings.wake = !state.settings.wake;
    saveState();
    if (state.settings.wake) {
      if (!('wakeLock' in navigator)) {
        toast(L.toast.notSupported);
      } else if (audio && !audio.paused) {
        requestWake();
      }
    } else {
      releaseWake();
    }
    renderPlayerText();
  }

  /* ---------------- 匯出／匯入 ---------------- */
  function exportRecords() {
    if (!Object.keys(state.days).length) {
      toast(L.counter.exportEmpty);
      return;
    }
    var payload = {
      app: 'mahapratisara',
      version: VERSION,
      exportedAt: new Date().toISOString(),
      days: state.days
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'mahapratisara-records-' + todayKey() + '.json';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      try { URL.revokeObjectURL(url); } catch (e) {}
      if (a.parentNode) { a.parentNode.removeChild(a); }
    }, 2500);
  }

  function mergeDays(incoming) {
    if (!incoming || typeof incoming !== 'object') { return false; }
    var changed = false;
    Object.keys(incoming).forEach(function (key) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) { return; }
      var item = incoming[key];
      var count = 0;
      if (typeof item === 'number') { count = item; }
      else if (item && typeof item === 'object') { count = Number(item.count) || 0; }
      count = clampCount(count);
      if (!count) { return; }
      var local = state.days[key];
      if (!local) {
        state.days[key] = {
          count: count,
          auto: 0,
          manual: count,
          ts: (item && typeof item === 'object' && typeof item.ts === 'string') ? item.ts : ''
        };
        changed = true;
        return;
      }
      if (count > local.count) {
        local.count = count;
        local.manual = clampCount(Math.max(local.manual || 0, count - (local.auto || 0)));
        changed = true;
      }
    });
    return changed;
  }

  function importRecords(file) {
    if (!file) { return; }
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var payload = JSON.parse(String(reader.result || '{}'));
        if (payload && payload.app && payload.app !== 'mahapratisara') {
          toast(L.counter.importError);
          return;
        }
        var incoming = payload && payload.days ? payload.days : payload;
        var changed = mergeDays(incoming);
        if (changed) {
          saveState();
          renderCounters();
          renderHistory();
          schedulePush();
        }
        toast(L.counter.imported);
      } catch (e) {
        toast(L.counter.importError);
      }
    };
    reader.onerror = function () { toast(L.counter.importError); };
    reader.readAsText(file);
  }

  /* ---------------- Google 登入／同步 ---------------- */
  function schedulePush() {
    if (!firestore || !currentUser) { return; }
    if (pushTimer) { clearTimeout(pushTimer); }
    pushTimer = setTimeout(function () { push(); }, 1800);
  }

  function renderSyncState() {
    if (!els.syncState) { return; }
    var text;
    if (!currentUser) {
      text = L.auth.localOnly;
    } else if (authSyncState === 'synced') {
      text = L.auth.synced + ' · ' + fmtNum(totalCount());
    } else if (authSyncState === 'error') {
      text = L.auth.syncError;
    } else {
      text = L.auth.syncing;
    }
    els.syncState.textContent = text;
    if (els.syncMessage) { els.syncMessage.textContent = authMessage || ''; }
  }

  function renderAuth() {
    if (!els.signIn) { return; }
    if (currentUser) {
      if (currentUser.photoURL) {
        els.avatar.src = currentUser.photoURL;
        els.avatar.alt = L.auth.avatarAlt;
        els.avatar.classList.remove('hidden');
        els.avatar.onerror = function () { els.avatar.classList.add('hidden'); };
      } else {
        els.avatar.classList.add('hidden');
      }
      els.signIn.classList.add('hidden');
      els.switchAccount.classList.remove('hidden');
      els.signOut.classList.remove('hidden');
    } else {
      els.avatar.classList.add('hidden');
      els.signIn.classList.remove('hidden');
      els.switchAccount.classList.add('hidden');
      els.signOut.classList.add('hidden');
      if (authSyncState !== 'local') { authSyncState = 'local'; }
    }
    els.signIn.disabled = !firebaseAuth;
    els.switchAccount.disabled = !firebaseAuth;
    els.signOut.disabled = !firebaseAuth;
    renderSyncState();
  }

  function pull() {
    if (!currentUser) { return Promise.resolve(false); }
    if (!firestore) {
      authSyncState = 'error';
      authMessage = L.auth.syncError;
      renderAuth();
      return Promise.resolve(false);
    }
    authSyncState = 'syncing';
    authMessage = '';
    renderAuth();
    return firestore.collection('users').doc(currentUser.uid).get().then(function (doc) {
      if (doc.exists) {
        var data = doc.data() || {};
        if (mergeDays(data.mahapratisaraDays)) {
          saveState();
          renderCounters();
          renderHistory();
        }
      }
      authSyncState = 'synced';
      authMessage = '';
      renderAuth();
      return true;
    }).catch(function () {
      authSyncState = 'error';
      authMessage = L.auth.syncError;
      renderAuth();
      return false;
    });
  }

  function push() {
    if (!currentUser) { return Promise.resolve(false); }
    if (!firestore) {
      authSyncState = 'error';
      authMessage = L.auth.syncError;
      renderAuth();
      return Promise.resolve(false);
    }
    var timestamp = new Date().toISOString();
    if (global.firebase && global.firebase.firestore && global.firebase.firestore.FieldValue) {
      try { timestamp = global.firebase.firestore.FieldValue.serverTimestamp(); } catch (e) {}
    }
    var payload = {
      mahapratisaraDays: state.days,
      mahapratisaraUpdatedAt: timestamp
    };
    return firestore.collection('users').doc(currentUser.uid).set(payload, { merge: true }).then(function () {
      authSyncState = 'synced';
      authMessage = '';
      renderAuth();
      return true;
    }).catch(function () {
      authSyncState = 'error';
      authMessage = L.auth.syncError;
      renderAuth();
      return false;
    });
  }

  function signInWithGoogle() {
    if (!firebaseAuth) {
      toast(L.toast.notSupported);
      return;
    }
    authMessage = L.auth.syncing;
    authSyncState = 'syncing';
    renderAuth();
    var provider = new global.firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    firebaseAuth.signInWithPopup(provider).catch(function (err) {
      var code = (err && err.code) || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        authMessage = '';
        authSyncState = currentUser ? 'synced' : 'local';
        renderAuth();
        return;
      }
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        firebaseAuth.signInWithRedirect(provider).catch(function (err2) {
          authSyncState = 'error';
          authMessage = L.auth.syncError + ' (' + ((err2 && err2.code) || code) + ')';
          renderAuth();
        });
        return;
      }
      authSyncState = 'error';
      authMessage = L.auth.syncError + ' (' + code + ')';
      renderAuth();
    });
  }

  function signOutGoogle() {
    if (!firebaseAuth) { return; }
    firebaseAuth.signOut().catch(function () {});
  }

  function setupAuth() {
    renderAuth();
    if (!firebaseAuth) { return; }
    if (firebaseAuth.getRedirectResult) {
      firebaseAuth.getRedirectResult().catch(function () {});
    }
    firebaseAuth.onAuthStateChanged(function (user) {
      currentUser = user || null;
      if (currentUser) {
        authSyncState = 'syncing';
        authMessage = '';
        renderAuth();
        pull().then(function () { return push(); });
      } else {
        authSyncState = 'local';
        authMessage = '';
        renderAuth();
      }
    });
  }

  function initAuth() {
    /* 先畫本機 UI；Firebase 只係可選加強，唔阻塞頁面。 */
    renderAuth();
    if (global.FY_AUTH) {
      firebaseAuth = global.FY_AUTH;
      firestore = global.FY_DB || null;
      setupAuth();
      return;
    }
    var attempts = 0;
    function waitForFirebase() {
      if (global.firebase && global.firebase.auth && global.firebase.firestore) {
        try {
          if (!global.firebase.apps || !global.firebase.apps.length) {
            global.firebase.initializeApp(FIREBASE_OPTIONS);
          }
          global.FY_AUTH = global.firebase.auth();
          global.FY_DB = global.firebase.firestore();
          firebaseAuth = global.FY_AUTH;
          firestore = global.FY_DB;
          setupAuth();
          return;
        } catch (e) {
          /* 初始化失敗：保持本機模式，最多再試一次 */
        }
      }
      attempts++;
      if (attempts < 80) { setTimeout(waitForFirebase, 250); }
    }
    waitForFirebase();
  }

  /* ---------------- PWA ---------------- */
  function updateInstallButtons() {
    var show = !isStandalone() && (!!installPrompt || isIOS());
    if (els.installBtn) { els.installBtn.classList.toggle('hidden', !show); }
    if (els.installBtn2) { els.installBtn2.classList.toggle('hidden', !show); }
    if (els.installBtn) { els.installBtn.textContent = L.install; }
    if (els.installBtn2) { els.installBtn2.textContent = L.install; }
  }

  function installApp() {
    if (installPrompt) {
      installPrompt.prompt();
      var choice = installPrompt.userChoice;
      if (choice && choice.then) {
        choice.then(function () {
          installPrompt = null;
          updateInstallButtons();
        });
      } else {
        installPrompt = null;
        updateInstallButtons();
      }
      return;
    }
    toast(L.toast.installHint);
  }

  function initPWA() {
    updateInstallButtons();
    global.addEventListener('beforeinstallprompt', function (event) {
      event.preventDefault();
      installPrompt = event;
      updateInstallButtons();
    });
    global.addEventListener('appinstalled', function () {
      installPrompt = null;
      updateInstallButtons();
      toast(L.toast.installed);
    });
    if ('serviceWorker' in navigator && global.location.protocol.indexOf('http') === 0) {
      global.addEventListener('load', function () {
        navigator.serviceWorker.register('sw.js').catch(function () {});
      });
    }
  }

  /* ---------------- 事件 ---------------- */
  function bindGlobal() {
    if (els.themeToggle) { els.themeToggle.addEventListener('click', toggleTheme); }
    if (els.heroPlay) {
      els.heroPlay.addEventListener('click', function () {
        if (currentTrackIndex !== 0) { selectTrack(0, true); }
        else { playAudio(); }
      });
    }
    if (els.heroTalk) {
      els.heroTalk.addEventListener('click', function () {
        var index = -1;
        for (var i = 0; i < DATA.audio.length; i++) {
          if (DATA.audio[i].kind === 'talk') { index = i; break; }
        }
        if (index >= 0) { selectTrack(index, true); }
      });
    }
    if (els.playBtn) { els.playBtn.addEventListener('click', togglePlay); }
    if (els.loopBtn) { els.loopBtn.addEventListener('click', cycleLoop); }
    if (els.wakeBtn) { els.wakeBtn.addEventListener('click', toggleWake); }
    if (els.add108) { els.add108.addEventListener('click', function () { addCount(108, 'manual'); }); }
    if (els.add1) { els.add1.addEventListener('click', function () { addCount(1, 'manual'); }); }
    if (els.resetToday) { els.resetToday.addEventListener('click', resetToday); }
    if (els.exportBtn) { els.exportBtn.addEventListener('click', exportRecords); }
    if (els.importBtn && els.importFile) {
      els.importBtn.addEventListener('click', function () { els.importFile.click(); });
      els.importFile.addEventListener('change', function () {
        var file = els.importFile.files && els.importFile.files[0];
        if (file) { importRecords(file); }
        els.importFile.value = '';
      });
    }
    if (els.clearBtn) { els.clearBtn.addEventListener('click', clearAllRecords); }
    if (els.signIn) { els.signIn.addEventListener('click', signInWithGoogle); }
    if (els.switchAccount) { els.switchAccount.addEventListener('click', signInWithGoogle); }
    if (els.signOut) { els.signOut.addEventListener('click', signOutGoogle); }
    if (els.installBtn) { els.installBtn.addEventListener('click', installApp); }
    if (els.installBtn2) { els.installBtn2.addEventListener('click', installApp); }

    if (els.seek) {
      els.seek.addEventListener('input', function () {
        if (!audio || !isFinite(audio.duration)) { return; }
        audio.currentTime = Number(els.seek.value) || 0;
        listened = 0;
        lastTime = audio.currentTime;
        completedGuard = false;
        updateTimes();
      });
    }

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && wantsPlay && audio && audio.paused && !audio.ended) {
        playAudio();
      }
      if (document.visibilityState === 'visible' && state.settings.wake && wantsPlay) {
        requestWake();
      }
    });
    global.addEventListener('focus', function () {
      if (wantsPlay && audio && audio.paused && !audio.ended) { playAudio(); }
    });

    setInterval(function () {
      if (!audio) { return; }
      if (wantsPlay && audio.paused && !audio.ended) {
        try {
          var p = audio.play();
          if (p && p.catch) { p.catch(function () {}); }
        } catch (e) {}
      }
      if (wantsPlay && state.settings.wake && !wakeLock) { requestWake(); }
    }, 6000);
  }

  function initPlayer() {
    audio = byId('audio');
    if (!audio) { return; }
    audio.loop = false;
    audio.preload = 'metadata';

    var initialId = state.settings.trackId;
    currentTrackIndex = 0;
    for (var i = 0; i < DATA.audio.length; i++) {
      if (DATA.audio[i].id === initialId) { currentTrackIndex = i; break; }
    }
    if (DATA.audio.length) {
      audio.src = audioSrc(DATA.audio[currentTrackIndex]);
      audio.load();
    }

    audio.addEventListener('play', function () {
      wantsPlay = true;
      renderPlayerText();
      setStatus(L.player.statusPlaying);
      if (state.settings.wake) { requestWake(); }
    });
    audio.addEventListener('pause', function () {
      renderPlayerText();
      releaseWake();
    });
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('timeupdate', function () {
      if (!audio) { return; }
      var t = isFinite(audio.currentTime) ? audio.currentTime : 0;
      if (!audio.paused && !seeking) {
        var delta = t - lastTime;
        /* 背景播放時 timeupdate 可能被節流；8 秒內仍視為正常收聽。 */
        if (delta > 0 && delta < 8) { listened += delta; }
        else if (delta < 0) { listened = 0; }
        var known = (isFinite(audio.duration) && audio.duration > 0) ? audio.duration : 0;
        if (known && listened > known) { listened = known; }
      }
      lastTime = t;
      updateTimes();
    });
    audio.addEventListener('loadedmetadata', function () {
      updateTimes();
      if (audio.paused) { setStatus(L.player.statusReady); }
    });
    audio.addEventListener('seeking', function () {
      seeking = true;
      listened = 0;
      lastTime = audio.currentTime;
      completedGuard = false;
    });
    audio.addEventListener('seeked', function () {
      seeking = false;
      lastTime = audio.currentTime;
      updateTimes();
    });
    audio.addEventListener('error', function () {
      wantsPlay = false;
      setStatus(L.player.error);
      renderPlayerText();
    });
    audio.addEventListener('waiting', function () {
      if (wantsPlay) { setStatus(L.player.loading); }
    });
    audio.addEventListener('canplay', function () {
      if (!audio.paused) { setStatus(L.player.statusPlaying); }
    });

    updateTimes();
    setStatus(L.player.statusReady);
  }

  function safeRender(fn, name) {
    try { fn(); }
    catch (e) {
      if (global.console && global.console.warn) {
        global.console.warn('[大隨求] 渲染失敗：' + name, e);
      }
    }
  }

  function renderAll() {
    L = DATA.i18n[state.lang] || DATA.i18n.yue;
    document.documentElement.lang = LANG_HTML[state.lang] || 'zh-Hant-HK';
    safeRender(applyTheme, 'theme');
    safeRender(renderLangSwitch, 'lang');
    safeRender(renderStatic, 'static');
    safeRender(renderMantra, 'mantra');
    safeRender(renderBenefits, 'benefits');
    safeRender(renderPractice, 'practice');
    safeRender(renderSources, 'sources');
    safeRender(renderHeart, 'heart');
    safeRender(renderFaq, 'faq');
    safeRender(renderCounters, 'counters');
    safeRender(renderHistory, 'history');
    safeRender(renderTrackTabs, 'tracks');
    safeRender(renderPlayerText, 'player');
    safeRender(renderAuth, 'auth');
    safeRender(updateInstallButtons, 'install');
    safeRender(updateMediaMetadata, 'media');
  }

  function boot() {
    cacheEls();
    L = DATA.i18n[state.lang] || DATA.i18n.yue;
    applyTheme();
    initPlayer();
    initAuth();
    bindGlobal();
    renderAll();
    initPWA();
    initMediaSession();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
