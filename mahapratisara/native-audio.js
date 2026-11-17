/* =============================================================
   佛音靈氣・佛學系統 —— 原生播放器 JS 轉接器
   只在 Android WebView（window.NativePlayer 存在）啟用；
   普通瀏覽器完全唔會載入呢個 object，會照用 <audio>。
   ============================================================= */
(function () {
  'use strict';
  if (!window.NativePlayer) {
    window.NativeAudio = {
      available: function () { return false; },
      create: function () { return null; }
    };
    return;
  }

  var instances = [];

  function absoluteUrl(url) {
    try {
      return new URL(url, window.location.href).href;
    } catch (e) {
      return String(url || '');
    }
  }

  function ranges(duration) {
    return {
      length: duration > 0 ? 1 : 0,
      start: function () { return 0; },
      end: function () { return duration; }
    };
  }

  function NativeAudio(id) {
    this.id = id || 'native-audio';
    this._src = '';
    this._currentTime = 0;
    this._duration = 0;
    this._paused = true;
    this._ended = false;
    this._loop = false;
    this._ready = false;
    this._volume = 1;
    this._muted = false;
    this._playbackRate = 1;
    this._error = null;
    this._listeners = {};
    this._pendingPlay = null;
    this._userPaused = false;
    instances.push(this);

    try {
      var state = JSON.parse(window.NativePlayer.getState() || '{}');
      if (state && typeof state === 'object') {
        if (typeof state.currentTime === 'number') { this._currentTime = state.currentTime; }
        if (typeof state.duration === 'number') { this._duration = state.duration; }
        if (typeof state.paused === 'boolean') { this._paused = state.paused; }
        if (typeof state.loop === 'boolean') { this._loop = state.loop; }
        if (typeof state.url === 'string') { this._src = state.url; }
        this._ready = this._duration > 0;
      }
    } catch (e) { /* 未準備好 */ }
  }

  NativeAudio.prototype.addEventListener = function (type, handler) {
    if (typeof handler !== 'function') { return; }
    if (!this._listeners[type]) { this._listeners[type] = []; }
    this._listeners[type].push(handler);
  };

  NativeAudio.prototype.removeEventListener = function (type, handler) {
    var list = this._listeners[type];
    if (!list) { return; }
    var index = list.indexOf(handler);
    if (index >= 0) { list.splice(index, 1); }
  };

  NativeAudio.prototype._emit = function (type, extra) {
    var event = { type: type, target: this, currentTarget: this, timeStamp: Date.now() };
    if (extra) {
      Object.keys(extra).forEach(function (key) { event[key] = extra[key]; });
    }
    var list = (this._listeners[type] || []).slice();
    var self = this;
    list.forEach(function (handler) {
      try { handler.call(self, event); } catch (e) {
        if (window.console && window.console.error) { window.console.error(e); }
      }
    });
  };

  Object.defineProperties(NativeAudio.prototype, {
    src: {
      get: function () { return this._src; },
      set: function (value) {
        this._src = String(value || '');
        this._currentTime = 0;
        this._duration = 0;
        this._ended = false;
        this._paused = true;
        this._ready = false;
      }
    },
    currentSrc: { get: function () { return this._src ? absoluteUrl(this._src) : ''; } },
    currentTime: {
      get: function () { return this._currentTime; },
      set: function (value) {
        var seconds = Number(value) || 0;
        this._currentTime = seconds;
        this._emit('seeking');
        try { window.NativePlayer.seek(seconds); } catch (e) { /* ignore */ }
        var self = this;
        setTimeout(function () { self._emit('seeked'); }, 120);
      }
    },
    duration: { get: function () { return this._duration; } },
    paused: { get: function () { return this._paused; } },
    ended: { get: function () { return this._ended; } },
    loop: {
      get: function () { return this._loop; },
      set: function (value) {
        this._loop = !!value;
        try { window.NativePlayer.setLoop(this._loop); } catch (e) { /* ignore */ }
      }
    },
    volume: {
      get: function () { return this._volume; },
      set: function (value) { this._volume = Number(value); }
    },
    muted: {
      get: function () { return this._muted; },
      set: function (value) { this._muted = !!value; }
    },
    playbackRate: {
      get: function () { return this._playbackRate; },
      set: function (value) { this._playbackRate = Number(value) || 1; }
    },
    readyState: { get: function () { return this._ready ? 4 : 0; } },
    error: { get: function () { return this._error; } },
    buffered: { get: function () { return ranges(this._duration); } },
    seekable: { get: function () { return ranges(this._duration); } }
  });

  NativeAudio.prototype.load = function () {
    if (!this._src) { return; }
    this._ready = false;
    this._error = null;
    this._ended = false;
    this._paused = true;
    this._emit('loadstart');
    this._emit('waiting');
    try {
      window.NativePlayer.load(absoluteUrl(this._src), document.title || '');
    } catch (e) {
      this._error = { message: String(e) };
      this._emit('error', { message: String(e) });
    }
  };

  NativeAudio.prototype.play = function () {
    var self = this;
    if (!this._src) {
      return Promise.reject(new Error('no audio src'));
    }
    return new Promise(function (resolve, reject) {
      self._pendingPlay = { resolve: resolve, reject: reject };
      if (!self._ready) { self.load(); }
      try {
        window.NativePlayer.play();
      } catch (e) {
        self._pendingPlay = null;
        reject(e);
      }
    });
  };

  NativeAudio.prototype.pause = function () {
    try { window.NativePlayer.pause(); } catch (e) { /* ignore */ }
  };

  NativeAudio.prototype.removeAttribute = function (name) {
    if (name === 'src') { this._src = ''; }
  };

  NativeAudio.prototype.setAttribute = function (name, value) {
    if (name === 'src') { this.src = value; }
  };

  NativeAudio.prototype.getAttribute = function (name) {
    return name === 'src' ? this._src : null;
  };

  window.__nativeAudioEvent = function (event) {
    if (!event || !event.type) { return; }
    instances.forEach(function (audio) {
      if (event.type === 'loadedmetadata' || event.type === 'durationchange') {
        if (typeof event.duration === 'number') { audio._duration = event.duration; }
        audio._ready = audio._duration > 0;
      } else if (event.type === 'play') {
        audio._paused = false;
        audio._ended = false;
        if (audio._pendingPlay) {
          audio._pendingPlay.resolve();
          audio._pendingPlay = null;
        }
      } else if (event.type === 'pause') {
        audio._paused = true;
        if (typeof event.currentTime === 'number') { audio._currentTime = event.currentTime; }
        if (typeof event.duration === 'number' && event.duration > 0) { audio._duration = event.duration; }
        if (event.user) { audio._userPaused = true; }
      } else if (event.type === 'timeupdate') {
        if (typeof event.currentTime === 'number') { audio._currentTime = event.currentTime; }
        if (typeof event.duration === 'number' && event.duration > 0) { audio._duration = event.duration; }
        if (typeof event.paused === 'boolean') { audio._paused = event.paused; }
      } else if (event.type === 'ended') {
        audio._ended = true;
        audio._paused = true;
        if (typeof event.duration === 'number' && event.duration > 0) {
          audio._duration = event.duration;
          audio._currentTime = event.duration;
        }
      } else if (event.type === 'error') {
        audio._error = { message: event.message || 'native playback error' };
        if (audio._pendingPlay) {
          audio._pendingPlay.reject(new Error(event.message || 'native playback error'));
          audio._pendingPlay = null;
        }
      }
      audio._emit(event.type, event);
    });
  };

  window.NativeAudio = {
    available: function () { return true; },
    create: function (id) { return new NativeAudio(id); }
  };
})();
