/* =============================================================
   佛音靈氣 — app.js（黑金・四語版）
   15 首；單一完整音檔；原生 loop；唸誦次數；Google 同步
   語言：粵語 / 普通話 / English / Tiếng Việt
   ============================================================= */
(function () {
  'use strict';

  var DATA = window.FY_DATA;
  var tracks = (DATA && DATA.tracks) || [];
  var audio = (window.NativeAudio && window.NativeAudio.available())
    ? window.NativeAudio.create('audio')
    : document.getElementById('audio');
  var $ = function (id) { return document.getElementById(id); };

  var state = { index: -1, loopMode: 'all' };
  try {
    var savedLoop = localStorage.getItem('foxue.loopMode') || '';
    if (['all', 'one', 'off'].indexOf(savedLoop) >= 0) { state.loopMode = savedLoop; }
  } catch (e) {}
  var seeking = false;
  var lastT = 0;
  var wantPlay = false;
  var suppressResume = false;

  var COUNTS_KEY = 'foxue.fy.counts';
  var LANG_KEY = 'foxue.lang';
  var LOOP_KEY = 'foxue.loopMode';
  var TRACK_KEY = 'foxue.track';
  var THEME_KEY = 'foxue.theme';
  var counts = {};
  try { counts = JSON.parse(localStorage.getItem(COUNTS_KEY) || '{}') || {}; } catch (e) { counts = {}; }

  var auth = window.FY_AUTH || null;
  var db = window.FY_DB || null;
  var currentUser = null;
  var pushTimer = null;

  /* ---------- 四語 ---------- */
  var I18N = {
    yue: {
      appSub: '佛音唱誦・靈氣修持',
      topNote: '15 首・單一完整音檔・鎖屏原生循環',
      login: '用 Google 登入同步', logout: '登出',
      notLoggedIn: '未登入', loggedIn: '已登入',
      syncing: '同步中…', synced: '已同步',
      localOnly: '未登入：唸誦次數只存本機。',
      reading: '讀取雲端紀錄中…', uploading: '上載中…',
      uploadFail: '上載失敗：', readFail: '讀取失敗：',
      tracksTitle: '曲目', tracksUnit: '首', total: '總計', times: '次',
      nowPlaying: '現正播放', play: '播放', pause: '暫停',
      loopOn: '循環：開', loopOff: '循環：關', plus: '+1 次',
      themeLight: '淺色', themeDark: '深色',
      intro: '簡介', source: '出處', mantra: '咒文',
      benefits: '功德利益', howTo: '持誦要點', caution: '注意',
      sutra: '經說', tradition: '傳統說法', other: '其他',
      textNote: '', warning: '此條目標示為非正典／待考／民間流通，請與佛教正典分開理解。',
      footer: '佛音靈氣 · 內容僅供學修參考 · 原音檔完整保留',
      verse: '願以此功德，普及於一切；我等與眾生，皆共成佛道。',
      catMantra: '真言', catDharani: '陀羅尼', catRitual: '儀軌', catOpening: '序', catTeaching: '開示'
    },
    cmn: {
      appSub: '佛音唱诵・灵气修持',
      topNote: '15 首・单一完整音档・锁屏原生循环',
      login: '用 Google 登录同步', logout: '退出',
      notLoggedIn: '未登录', loggedIn: '已登录',
      syncing: '同步中…', synced: '已同步',
      localOnly: '未登录：念诵次数只存本机。',
      reading: '读取云端记录中…', uploading: '上传中…',
      uploadFail: '上传失败：', readFail: '读取失败：',
      tracksTitle: '曲目', tracksUnit: '首', total: '总计', times: '次',
      nowPlaying: '正在播放', play: '播放', pause: '暂停',
      loopOn: '循环：开', loopOff: '循环：关', plus: '+1 次',
      themeLight: '浅色', themeDark: '深色',
      intro: '简介', source: '出处', mantra: '咒文',
      benefits: '功德利益', howTo: '持诵要点', caution: '注意',
      sutra: '经说', tradition: '传统说法', other: '其他',
      textNote: '咒文原文保留汉文；简介、出处、功德、要点、注意已转为简体。',
      warning: '此条目标示为非正典／待考／民间流通，请与佛教正典分开理解。',
      footer: '佛音灵气 · 内容仅供学修参考 · 原音档完整保留',
      verse: '愿以此功德，普及于一切；我等与众生，皆共成佛道。',
      catMantra: '真言', catDharani: '陀罗尼', catRitual: '仪轨', catOpening: '序', catTeaching: '开示'
    },
    en: {
      appSub: 'Chanting & Reiki Practice',
      topNote: '15 tracks · single complete files · native loop',
      login: 'Sign in with Google', logout: 'Sign out',
      notLoggedIn: 'Not signed in', loggedIn: 'Signed in',
      syncing: 'Syncing…', synced: 'Synced',
      localOnly: 'Not signed in: counts are stored on this device only.',
      reading: 'Reading cloud counts…', uploading: 'Uploading…',
      uploadFail: 'Upload failed: ', readFail: 'Read failed: ',
      tracksTitle: 'Tracks', tracksUnit: 'tracks', total: 'Total', times: 'times',
      nowPlaying: 'Now playing', play: 'Play', pause: 'Pause',
      loopOn: 'Loop: On', loopOff: 'Loop: Off', plus: '+1',
      themeLight: 'Light', themeDark: 'Dark',
      intro: 'Introduction', source: 'Source', mantra: 'Mantra',
      benefits: 'Benefits', howTo: 'Practice notes', caution: 'Caution',
      sutra: 'Sutta', tradition: 'Tradition', other: 'Other',
      textNote: 'Mantra remains in Chinese. Summary, source, benefits, practice notes and cautions are translated; the Chinese original prevails.',
      warning: 'This entry is marked as non-canonical / pending verification / folk tradition; please distinguish it from the Buddhist canon.',
      footer: 'Buddhist Sound · Reiki · For study and practice only · Source audio preserved',
      verse: 'May this merit be shared with all beings; may we together attain Buddhahood.',
      catMantra: 'Mantra', catDharani: 'Dhāraṇī', catRitual: 'Ritual', catOpening: 'Opening', catTeaching: 'Teaching'
    },
    vi: {
      appSub: 'Tụng niệm & Tu tập Linh khí',
      topNote: '15 bài · một tệp hoàn chỉnh · lặp gốc',
      login: 'Đăng nhập bằng Google', logout: 'Đăng xuất',
      notLoggedIn: 'Chưa đăng nhập', loggedIn: 'Đã đăng nhập',
      syncing: 'Đang đồng bộ…', synced: 'Đã đồng bộ',
      localOnly: 'Chưa đăng nhập: số lần tụng chỉ lưu trên máy này.',
      reading: 'Đang đọc dữ liệu đám mây…', uploading: 'Đang tải lên…',
      uploadFail: 'Tải lên thất bại: ', readFail: 'Đọc thất bại: ',
      tracksTitle: 'Bài tụng', tracksUnit: 'bài', total: 'Tổng', times: 'lần',
      nowPlaying: 'Đang phát', play: 'Phát', pause: 'Tạm dừng',
      loopOn: 'Lặp: Bật', loopOff: 'Lặp: Tắt', plus: '+1 lần',
      themeLight: 'Sáng', themeDark: 'Tối',
      intro: 'Giới thiệu', source: 'Nguồn', mantra: 'Chân ngôn',
      benefits: 'Công đức', howTo: 'Cách tụng', caution: 'Lưu ý',
      sutra: 'Kinh', tradition: 'Truyền thống', other: 'Khác',
      textNote: 'Chân ngôn giữ nguyên Hán văn. Phần giới thiệu, nguồn, công đức, cách tụng và lưu ý đã được dịch; bản Hán văn là chuẩn.',
      warning: 'Mục này được ghi là phi chính điển / cần khảo chứng / lưu truyền dân gian; hãy phân biệt với chính điển Phật giáo.',
      footer: 'Phật Âm Linh Khí · Chỉ để học tu · Giữ nguyên toàn bộ file gốc',
      verse: 'Nguyện đem công đức này, hồi hướng khắp mọi loài; chúng sinh và ta đều thành Phật đạo.',
      catMantra: 'Chân ngôn', catDharani: 'Đà-la-ni', catRitual: 'Nghi quỹ', catOpening: 'Mở đầu', catTeaching: 'Giảng dạy'
    }
  };
  var EXTRA_I18N = {
    yue: {
      appSub: '佛音唱誦・佛學修持',
      topNote: '15 首・四語・Google 同步・全輯／單曲／不循環',
      switchAccount: '切換帳號',
      loopAll: '全輯循環', loopOne: '單曲循環', loopOff: '不循環',
      tts: '朗讀', ttsStop: '停止朗讀', ttsUnsupported: '此裝置不支援語音朗讀',
      library: '咒音庫・次第', guangming: '光明真言專修', androidApp: 'Android App',
      footer: '佛音靈氣・佛學系統 · 內容僅供學修參考 · 原音檔完整保留'
    },
    cmn: {
      appSub: '佛音唱诵・佛学修持',
      topNote: '15 首・四语・Google 同步・全辑／单曲／不循环',
      switchAccount: '切换账号',
      loopAll: '全辑循环', loopOne: '单曲循环', loopOff: '不循环',
      tts: '朗读', ttsStop: '停止朗读', ttsUnsupported: '此设备不支持语音朗读',
      library: '咒音库・次第', guangming: '光明真言专修', androidApp: 'Android App',
      footer: '佛音灵气・佛学系统 · 内容仅供学修参考 · 原音档完整保留'
    },
    en: {
      appSub: 'Chanting & Buddhist Study',
      topNote: '15 tracks · four languages · Google sync · all / single / no loop',
      switchAccount: 'Switch account',
      loopAll: 'All tracks', loopOne: 'Single track', loopOff: 'No loop',
      tts: 'Read aloud', ttsStop: 'Stop reading', ttsUnsupported: 'Speech is not supported on this device',
      library: 'Library & Sequence', guangming: 'Mantra of Light', androidApp: 'Android App',
      footer: 'Buddhist Sound · Buddhist Study · For study and practice only · Source audio preserved'
    },
    vi: {
      appSub: 'Tụng niệm & Tu học Phật pháp',
      topNote: '15 bài · bốn ngôn ngữ · đồng bộ Google · toàn bộ / một bài / không lặp',
      switchAccount: 'Đổi tài khoản',
      loopAll: 'Toàn bộ', loopOne: 'Một bài', loopOff: 'Không lặp',
      tts: 'Đọc', ttsStop: 'Dừng đọc', ttsUnsupported: 'Thiết bị này không hỗ trợ đọc tiếng',
      library: 'Thư viện & Thứ tự', guangming: 'Chân ngôn Quang Minh', androidApp: 'Android App',
      footer: 'Phật Âm Linh Khí · Tu học Phật pháp · Chỉ để học tu · Giữ nguyên toàn bộ file gốc'
    }
  };
  Object.keys(EXTRA_I18N).forEach(function (code) {
    Object.keys(EXTRA_I18N[code]).forEach(function (key) { I18N[code][key] = EXTRA_I18N[code][key]; });
  });

  var LI = { yue: 0, cmn: 1, en: 2, vi: 3 };
  var lang = 'yue';
  try { lang = localStorage.getItem(LANG_KEY) || 'yue'; } catch (e) {}
  if (!I18N[lang]) { lang = 'yue'; }

  function T(k) { return (I18N[lang] && I18N[lang][k]) || I18N.yue[k] || k; }
  function trackName(t) { return (t.name && t.name[LI[lang]]) || t.title; }
  function trackSub(t) { return (t.subI18n && t.subI18n[LI[lang]]) || t.sub || ''; }
  function catName(c) {
    if (!c) { return ''; }
    var map = { '真言': 'catMantra', '陀羅尼': 'catDharani', '儀軌': 'catRitual', '序': 'catOpening', '開示': 'catTeaching' };
    return map[c] ? T(map[c]) : c;
  }
  function tr(line) {
    var m = window.FY_TEXT_I18N || {};
    return (m[line] && m[line][lang]) || line;
  }
  function benefitParts(b) {
    if (b && typeof b === 'object') { return { type: b.type || 'other', text: b.text || '' }; }
    var s = String(b || '');
    if (/^(經說|经说)：/.test(s)) { return { type: 'sutra', text: s.slice(3) }; }
    if (/^(傳統說法|传统说法)：/.test(s)) { return { type: 'tradition', text: s.slice(5) }; }
    return { type: 'other', text: s };
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function fmt(sec) {
    var t = Math.max(0, Math.floor(Number(sec) || 0));
    var h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    return h > 0 ? h + ':' + pad2(m) + ':' + pad2(s) : m + ':' + pad2(s);
  }
  function setStatus(msg) { $('status').textContent = msg || ''; }
  function setSync(msg) { $('sync-status').textContent = msg || ''; }

  function enableBg() {
    try { if (navigator.audioSession) { navigator.audioSession.type = 'playback'; } } catch (e) {}
  }
  function setPlayLabel(playing) {
    $('play').textContent = playing ? T('pause') : T('play');
    $('play').setAttribute('aria-label', playing ? T('pause') : T('play'));
  }
  function clear(node) { while (node.firstChild) { node.removeChild(node.firstChild); } }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (text != null) { n.textContent = String(text); }
    return n;
  }

  /* ---------- 次數 ---------- */
  function saveCounts() {
    try { localStorage.setItem(COUNTS_KEY, JSON.stringify(counts)); } catch (e) {}
  }
  function totalCount() {
    var n = 0;
    Object.keys(counts).forEach(function (k) { n += Number(counts[k]) || 0; });
    return n;
  }
  function renderCounts() {
    $('total-count').textContent = String(totalCount());
    var buttons = document.querySelectorAll('.track');
    for (var i = 0; i < buttons.length; i++) {
      var c = buttons[i].querySelector('.count');
      if (c && tracks[i]) { c.textContent = '×' + (Number(counts[tracks[i].id]) || 0); }
    }
  }
  function bump() {
    if (state.index < 0) { return; }
    var id = tracks[state.index].id;
    counts[id] = (Number(counts[id]) || 0) + 1;
    saveCounts();
    renderCounts();
    schedulePush();
  }

  /* ---------- 同步 ---------- */
  function schedulePush() {
    if (!currentUser) { return; }
    if (pushTimer) { clearTimeout(pushTimer); }
    pushTimer = setTimeout(push, 1500);
  }
  function pull() {
    if (!db || !currentUser) { return Promise.resolve(); }
    setSync(T('reading'));
    return db.collection('users').doc(currentUser.uid).get().then(function (doc) {
      if (doc.exists) {
        var remote = (doc.data() || {}).foxueCounts || {};
        var changed = false;
        Object.keys(remote).forEach(function (k) {
          var rv = Number(remote[k]) || 0;
          if (rv > (Number(counts[k]) || 0)) { counts[k] = rv; changed = true; }
        });
        if (changed) { saveCounts(); renderCounts(); }
      }
      setSync(T('synced') + '（' + totalCount() + '）');
    }).catch(function (e) {
      setSync(T('readFail') + (e && e.code ? e.code : ''));
    });
  }
  function push() {
    if (!db || !currentUser) { return Promise.resolve(); }
    setSync(T('uploading'));
    return db.collection('users').doc(currentUser.uid).set({
      foxueCounts: counts,
      foxueUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).then(function () {
      setSync(T('synced') + '（' + totalCount() + '）');
    }).catch(function (e) {
      setSync(T('uploadFail') + (e && e.code ? e.code : ''));
    });
  }

  if (auth) {
    auth.getRedirectResult().catch(function () {});
    auth.onAuthStateChanged(function (user) {
      currentUser = user || null;
      var loginBtn = $('google-login'), logoutBtn = $('google-logout'), userEl = $('sync-user');
      var avatar = $('user-avatar');
      if (avatar) { avatar.addEventListener('error', function () { avatar.hidden = true; }); }
      if (user) {
        loginBtn.hidden = true;
        logoutBtn.hidden = false;
        if ($('google-switch')) { $('google-switch').hidden = false; }
        if (avatar) {
          if (user.photoURL) { avatar.src = user.photoURL; avatar.hidden = false; }
          else { avatar.hidden = true; avatar.removeAttribute('src'); }
        }
        userEl.textContent = user.displayName || T('loggedIn');
        pull().then(push);
      } else {
        loginBtn.hidden = false;
        logoutBtn.hidden = true;
        if ($('google-switch')) { $('google-switch').hidden = true; }
        if (avatar) { avatar.hidden = true; avatar.removeAttribute('src'); }
        userEl.textContent = T('notLoggedIn');
        setSync(T('localOnly'));
      }
    });
  } else {
    $('google-login').disabled = true;
    setSync('Firebase 未載入，請檢查網絡。');
  }

  var loginBusy = false;
  $('google-login').addEventListener('click', function () {
    if (!auth) { setSync('Firebase 未載入，請檢查網絡。'); return; }
    if (loginBusy) { return; }
    loginBusy = true;
    var provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    auth.signInWithPopup(provider).then(function () {
      loginBusy = false;
    }).catch(function (e) {
      loginBusy = false;
      var code = e && e.code ? e.code : '';
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        auth.signInWithRedirect(provider);
        return;
      }
      if (code === 'auth/cancelled-popup-request' || code === 'auth/popup-closed-by-user') {
        setSync('登入已取消。');
        return;
      }
      setSync('登入失敗：' + (code || '未知'));
    });
  });
  $('google-logout').addEventListener('click', function () {
    if (auth) { auth.signOut(); }
  });
  var switchBtn = $('google-switch');
  if (switchBtn) {
    switchBtn.addEventListener('click', function () {
      if (!auth) { setSync('Firebase 未載入，請檢查網絡。'); return; }
      var provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      auth.signInWithPopup(provider).catch(function (e) {
        setSync('登入失敗：' + ((e && e.code) || '未知'));
      });
    });
  }

  /* ---------- 曲目列表 ---------- */
  function renderList() {
    var box = $('list');
    clear(box);
    tracks.forEach(function (t, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'track' + (i === state.index ? ' active' : '');
      b.setAttribute('data-i', String(i));

      b.appendChild(el('span', 'idx', String(i + 1)));
      var body = el('span', 'body');
      body.appendChild(el('span', 't', trackName(t)));
      body.appendChild(el('span', 's', trackSub(t)));
      b.appendChild(body);

      var meta = el('span', 'meta', fmt(t.dur));
      meta.appendChild(el('span', 'count', '×0'));
      meta.appendChild(el('span', 'cat', catName(t.cat)));
      b.appendChild(meta);

      b.addEventListener('click', function () { select(i, true); });
      box.appendChild(b);
    });
    $('list-count').textContent = tracks.length + ' ' + T('tracksUnit');
    renderCounts();
  }

  /* ---------- 文字 ---------- */
  function renderText(t) {
    var panel = $('text-panel');
    clear(panel);
    if (!t) {
      panel.appendChild(el('p', 'empty', '—'));
      return;
    }

    panel.appendChild(el('h2', null, trackName(t)));
    panel.appendChild(el('p', 'sub', trackSub(t) + (t.cat ? '・' + catName(t.cat) : '')));

    if (T('textNote')) {
      panel.appendChild(el('p', 'text-note', T('textNote')));
    }

    var text = t.text || {};
    var summaryText = (text.summaryI18n && text.summaryI18n[lang]) || text.summary || '';
    var sourceText = (text.sourceI18n && text.sourceI18n[lang]) || text.source || '（待考）';
    if (summaryText) {
      var sum = el('section', 'sec');
      sum.appendChild(el('h3', null, T('intro')));
      sum.appendChild(el('p', null, summaryText));
      panel.appendChild(sum);
    }

    var src = el('section', 'sec');
    src.appendChild(el('h3', null, T('source')));
    src.appendChild(el('p', null, sourceText));
    panel.appendChild(src);

    if (text.mantraHan || text.mantraRoman) {
      var man = el('section', 'sec');
      man.appendChild(el('h3', null, T('mantra')));
      if (text.mantraHan) { man.appendChild(el('p', 'mantra', text.mantraHan)); }
      if (text.mantraRoman) { man.appendChild(el('p', 'roman', text.mantraRoman)); }
      panel.appendChild(man);
    }

    var benefitsList = (text.benefitsI18n && text.benefitsI18n[lang]) || text.benefits || [];
    if (benefitsList.length) {
      var ben = el('section', 'sec');
      ben.appendChild(el('h3', null, T('benefits')));
      benefitsList.forEach(function (b) {
        var p = benefitParts(b);
        var row = el('div', 'benefit');
        var label = p.type === 'sutra' ? T('sutra') : (p.type === 'tradition' ? T('tradition') : T('other'));
        var tag = el('span', 'tag' + (p.type === 'sutra' ? ' sutra' : (p.type === 'tradition' ? ' trad' : '')), label);
        row.appendChild(tag);
        row.appendChild(el('span', null, p.text));
        ben.appendChild(row);
      });
      panel.appendChild(ben);
    }

    if (text.howTo && text.howTo.length) {
      var how = el('section', 'sec');
      how.appendChild(el('h3', null, T('howTo')));
      var ul = el('ul', 'how');
      text.howTo.forEach(function (x) { ul.appendChild(el('li', null, tr(x))); });
      how.appendChild(ul);
      panel.appendChild(how);
    }

    if (text.caution && text.caution.length) {
      var cau = el('section', 'sec');
      cau.appendChild(el('h3', null, T('caution')));
      var ul2 = el('ul', 'cau');
      text.caution.forEach(function (x) { ul2.appendChild(el('li', null, tr(x))); });
      cau.appendChild(ul2);
      panel.appendChild(cau);
    }

    if (/非佛教|民間|待考|一貫道/.test(text.source || '')) {
      panel.appendChild(el('p', 'warn', T('warning')));
    }
  }

  /* ---------- 播放器 ---------- */
  function updateMedia(t) {
    if (!('mediaSession' in navigator) || !t) { return; }
    try {
      if (window.MediaMetadata) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: trackName(t),
          artist: '佛音靈氣',
          album: catName(t.cat) || '佛音'
        });
      }
      navigator.mediaSession.setActionHandler('play', function () { play(); });
      navigator.mediaSession.setActionHandler('pause', function () { wantPlay = false; audio.pause(); });
      navigator.mediaSession.setActionHandler('previoustrack', function () { step(-1); });
      navigator.mediaSession.setActionHandler('nexttrack', function () { step(1); });
    } catch (e) {}
  }

  function select(i, autoplay) {
    if (i < 0 || i >= tracks.length) { i = 0; }
    state.index = i;
    var t = tracks[i];
    suppressResume = true;
    if (!autoplay) { wantPlay = false; }
    audio.pause();
    audio.src = t.audio;
    audio.loop = state.loopMode === 'one';
    lastT = 0;
    try { audio.load(); } catch (e) {}
    setTimeout(function () { suppressResume = false; }, 600);
    $('now-title').textContent = trackName(t);
    $('now-sub').textContent = trackSub(t) + (t.cat ? '・' + catName(t.cat) : '');
    $('seek').max = Math.floor(t.dur || 0);
    $('dur').textContent = fmt(t.dur);
    $('cur').textContent = '0:00';
    $('seek').value = 0;
    setStatus('');
    renderList();
    renderText(t);
    updateMedia(t);
    try { localStorage.setItem(TRACK_KEY, String(i)); } catch (e) {}
    if (autoplay) { play(); }
  }

  function play() {
    wantPlay = true;
    enableBg();
    setStatus('');
    var p;
    try { p = audio.play(); } catch (e) { setStatus('—'); return; }
    if (p && p.catch) { p.catch(function () { setStatus('—'); setPlayLabel(false); }); }
  }

  function tryResume() {
    if (!wantPlay || suppressResume || !audio.paused) { return; }
    enableBg();
    try { audio.play().catch(function () { /* 等下一次機會 */ }); } catch (e) { /* 忽略 */ }
  }
  function step(delta) {
    if (!tracks.length) { return; }
    select((state.index + delta + tracks.length) % tracks.length, true);
  }
  function skip(delta) {
    if (!isFinite(audio.duration) || audio.duration <= 0) { return; }
    try { audio.currentTime = Math.min(audio.duration, Math.max(0, audio.currentTime + delta)); } catch (e) {}
  }

  audio.addEventListener('play', function () {
    wantPlay = true;
    enableBg();
    setPlayLabel(true);
    if ('mediaSession' in navigator) { try { navigator.mediaSession.playbackState = 'playing'; } catch (e) {} }
  });
  audio.addEventListener('pause', function () {
    setPlayLabel(false);
    if ('mediaSession' in navigator) { try { navigator.mediaSession.playbackState = 'paused'; } catch (e) {} }
    if (wantPlay && !suppressResume) {
      setTimeout(tryResume, 400);
      setTimeout(tryResume, 1500);
    }
  });
  audio.addEventListener('loadedmetadata', function () {
    if (isFinite(audio.duration)) {
      $('seek').max = Math.floor(audio.duration);
      $('dur').textContent = fmt(audio.duration);
    }
  });
  audio.addEventListener('timeupdate', function () {
    if (!isFinite(audio.duration) || audio.duration <= 0) { return; }
    if (!seeking) { $('seek').value = Math.floor(audio.currentTime); }
    $('cur').textContent = fmt(audio.currentTime);
    if ('mediaSession' in navigator && navigator.mediaSession.setPositionState) {
      try {
        navigator.mediaSession.setPositionState({
          duration: audio.duration,
          playbackRate: audio.playbackRate || 1,
          position: Math.min(audio.currentTime, audio.duration)
        });
      } catch (e) {}
    }
    if (audio.loop && lastT > 5 && audio.currentTime < 1 && audio.currentTime < lastT - 1) { bump(); }
    lastT = audio.currentTime;
  });
  audio.addEventListener('ended', function () {
    bump();
    if (state.loopMode === 'all') { step(1); }
    else if (state.loopMode === 'off') {
      if (state.index < tracks.length - 1) { step(1); }
      else { wantPlay = false; setPlayLabel(false); }
    }
  });
  audio.addEventListener('error', function () { setStatus('—'); });

  $('seek').addEventListener('input', function () {
    seeking = true;
    $('cur').textContent = fmt($('seek').value);
  });
  $('seek').addEventListener('change', function () {
    try { audio.currentTime = Number($('seek').value); } catch (e) {}
    seeking = false;
    lastT = audio.currentTime;
  });

  $('play').addEventListener('click', function () {
    if (audio.paused) { play(); } else { wantPlay = false; audio.pause(); }
  });
  $('prev').addEventListener('click', function () { step(-1); });
  $('next').addEventListener('click', function () { step(1); });
  $('plus').addEventListener('click', bump);
  $('loop').addEventListener('click', function () {
    state.loopMode = state.loopMode === 'all' ? 'one' : (state.loopMode === 'one' ? 'off' : 'all');
    try { localStorage.setItem(LOOP_KEY, state.loopMode); } catch (e) {}
    applyLoopMode();
  });
  $('tts').addEventListener('click', speakCurrent);

  document.addEventListener('keydown', function (e) {
    if (e.code !== 'Space' && e.key !== ' ') { return; }
    var tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'BUTTON' || tag === 'TEXTAREA') { return; }
    e.preventDefault();
    if (audio.paused) { play(); } else { wantPlay = false; audio.pause(); }
  });

  function loopLabel(mode) {
    return mode === 'all' ? T('loopAll') : (mode === 'one' ? T('loopOne') : T('loopOff'));
  }
  function applyLoopMode() {
    audio.loop = state.loopMode === 'one';
    var b = $('loop');
    if (b) {
      b.textContent = loopLabel(state.loopMode);
      b.setAttribute('aria-pressed', state.loopMode === 'off' ? 'false' : 'true');
    }
  }

  var TTS_LANG = { yue: 'yue-Hant-HK', cmn: 'zh-CN', en: 'en-US', vi: 'vi-VN' };
  var speaking = false;
  function pickVoice(code) {
    if (!('speechSynthesis' in window)) { return null; }
    var list = window.speechSynthesis.getVoices() || [];
    var exact = null, near = null, prefix = String(code).split('-')[0].toLowerCase();
    list.forEach(function (v) {
      var vl = String(v.lang || '').toLowerCase();
      if (vl === String(code).toLowerCase()) { exact = v; }
      if (!near && vl.indexOf(prefix) === 0) { near = v; }
    });
    return exact || near || null;
  }
  function speakCurrent() {
    if (!('speechSynthesis' in window)) { setStatus(T('ttsUnsupported')); return; }
    if (speaking) {
      window.speechSynthesis.cancel();
      speaking = false;
      $('tts').textContent = T('tts');
      return;
    }
    if (state.index < 0) { return; }
    var t = tracks[state.index];
    var text = t.text || {};
    var parts = [trackName(t)];
    var summary = (text.summaryI18n && text.summaryI18n[lang]) || text.summary || '';
    if (summary) { parts.push(summary); }
    var source = (text.sourceI18n && text.sourceI18n[lang]) || text.source || '';
    if (source) { parts.push(source); }
    var benefits = (text.benefitsI18n && text.benefitsI18n[lang]) || text.benefits || [];
    benefits.forEach(function (b) { var p = benefitParts(b); if (p.text) { parts.push(p.text); } });
    (text.howTo || []).forEach(function (x) { parts.push(tr(x)); });
    (text.caution || []).forEach(function (x) { parts.push(tr(x)); });
    var u = new SpeechSynthesisUtterance(parts.join('\n'));
    var code = TTS_LANG[lang] || 'zh-HK';
    var voice = pickVoice(code);
    u.lang = voice ? voice.lang : code;
    if (voice) { u.voice = voice; }
    u.rate = 0.92;
    u.onend = u.onerror = function () { speaking = false; $('tts').textContent = T('tts'); };
    speaking = true;
    $('tts').textContent = T('ttsStop');
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }

  /* ---------- 光暗 ---------- */

  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    var b = $('theme-toggle');
    if (b) {
      b.textContent = t === 'dark' ? T('themeLight') : T('themeDark');
      b.setAttribute('aria-label', t === 'dark' ? T('themeLight') : T('themeDark'));
    }
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) { m.setAttribute('content', t === 'dark' ? '#050505' : '#f6f0e1'); }
  }
  var savedTheme = 'dark';
  try { savedTheme = localStorage.getItem(THEME_KEY) || 'dark'; } catch (e) {}
  applyTheme(savedTheme);
  $('theme-toggle').addEventListener('click', function () {
    var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    applyTheme(next);
  });

  /* ---------- 語言切換 ---------- */
  function applyLang() {
    document.documentElement.lang = lang === 'yue' ? 'zh-Hant-HK' : (lang === 'cmn' ? 'zh-CN' : (lang === 'en' ? 'en' : 'vi'));
    $('brand-sub').textContent = T('appSub');
    $('top-note').textContent = T('topNote');
    $('google-login').textContent = T('login');
    $('google-logout').textContent = T('logout');
    $('list-title').textContent = T('tracksTitle');
    $('total-label').textContent = T('total');
    $('times-label').textContent = T('times');
    $('eyebrow').textContent = T('nowPlaying');
    $('plus').textContent = T('plus');
    $('footer-text').textContent = T('footer');
    $('footer-verse').textContent = T('verse');
    if (!currentUser) { $('sync-user').textContent = T('notLoggedIn'); setSync(T('localOnly')); }
    applyLoopMode();
    setPlayLabel(!audio.paused);
    if ($('google-switch')) { $('google-switch').textContent = T('switchAccount'); }
    var navLib = $('nav-library'); if (navLib) { navLib.textContent = T('library'); }
    var navGm = $('nav-guangming'); if (navGm) { navGm.textContent = T('guangming'); }
    var navApk = $('nav-apk'); if (navApk) { navApk.textContent = T('androidApp'); }
    var footerVer = $('footer-version'); if (footerVer) { footerVer.textContent = '佛音靈氣・佛學系統 v' + (DATA.meta.version || ''); }
    var brandVer = $('brand-version'); if (brandVer) { brandVer.textContent = 'v' + (DATA.meta.version || ''); }
    if (!speaking && $('tts')) { $('tts').textContent = T('tts'); }
    applyTheme(document.documentElement.getAttribute('data-theme') || 'dark');
    Array.prototype.forEach.call(document.querySelectorAll('[data-lang]'), function (b) {
      b.classList.toggle('on', b.getAttribute('data-lang') === lang);
    });
    renderList();
    if (state.index >= 0) {
      var t = tracks[state.index];
      $('now-title').textContent = trackName(t);
      $('now-sub').textContent = trackSub(t) + (t.cat ? '・' + catName(t.cat) : '');
      renderText(t);
      updateMedia(t);
    }
  }
  Array.prototype.forEach.call(document.querySelectorAll('[data-lang]'), function (b) {
    b.addEventListener('click', function () {
      var next = b.getAttribute('data-lang');
      if (!I18N[next]) { return; }
      lang = next;
      if (speaking && window.speechSynthesis) { window.speechSynthesis.cancel(); speaking = false; }
      try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
      applyLang();
    });
  });

  /* ---------- 啟動 ---------- */
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js', { scope: './' }).catch(function () {});
  }
  applyLoopMode();
  renderList();
  renderCounts();

  var saved = -1;
  try { saved = Number(localStorage.getItem(TRACK_KEY)); } catch (e) {}
  if (isFinite(saved) && saved >= 0 && saved < tracks.length) { select(saved, false); }
  else { select(0, false); }
  applyLang();

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) {
      enableBg();
      if (wantPlay && audio.paused) { tryResume(); }
      if (currentUser) { pull(); }
    }
  });
  window.addEventListener('pageshow', function () {
    if (wantPlay && audio.paused) { tryResume(); }
  });
  setInterval(function () {
    if (wantPlay && audio.paused) { tryResume(); }
  }, 8000);
})();
