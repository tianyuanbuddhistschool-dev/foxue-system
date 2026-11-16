/* 佛音靈氣・佛學系統 —— 主題切換（黑金／淺色）
   預設黑金；記住選擇，兩個頁面共用。
   呢個檔要喺 <head> 同步載入，避免淺色閃一閃。 */
(function () {
  'use strict';
  var KEY = 'foguang.theme.v1';
  var root = document.documentElement;
  var stored = '';
  try { stored = window.localStorage.getItem(KEY) || ''; } catch (e) { stored = ''; }
  var initial = stored === 'light' ? 'light' : 'black-gold';
  root.setAttribute('data-theme', initial);

  function isDark() {
    return root.getAttribute('data-theme') !== 'light';
  }
  function syncMetaColor() {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) { meta.setAttribute('content', isDark() ? '#080808' : '#f6f0e1'); }
  }
  syncMetaColor();
  function paintButton(button) {
    if (!button) { return; }
    button.textContent = isDark() ? '主題：黑金' : '主題：淺色';
    button.setAttribute('aria-pressed', isDark() ? 'true' : 'false');
    button.setAttribute('title', isDark() ? '切換淺色主題' : '切換黑金主題');
  }
  function apply(theme) {
    root.setAttribute('data-theme', theme);
    syncMetaColor();
    try { window.localStorage.setItem(KEY, theme); } catch (e) { /* 私隱模式 */ }
  }
  function bind() {
    var button = document.getElementById('theme-toggle');
    if (!button) { return; }
    paintButton(button);
    button.addEventListener('click', function () {
      apply(isDark() ? 'light' : 'black-gold');
      paintButton(button);
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})();
