# 大隨求陀羅尼・子站（v1.0.1）

**公開位置**：<https://tianyuanbuddhistschool-dev.github.io/foxue-system/mahapratisara/>

## 工作規則（使用者指示 2026-11-17）

1. **全自動執行至完成**：每個任務要一路做到真正完成，唔可以完成一個步驟就停低等指示。
2. 只有「需要真人 Google 帳戶／實機／法律授權」呢類的確無法代做嘅步驟，才可以標記為待真人；其餘可自動化嘅工作要繼續做埋。
3. 每次完成或更新，最後一步必定部署 GitHub Pages `main`，唔可以叫使用者自己上線。
4. 所有改動記入 `CHANGELOG.md`／`AUDIT.md`；唔刪使用者原始音檔。

## 定位

- 單一法門專修頁：大隨求陀羅尼心咒（CBETA T20 no. 1154 為主）。
- 四語：粵語（繁體）／普通話（簡體）／English／Tiếng Việt。
- 音檔：`000佛音靈氣000\7.大隨求陀羅尼心咒 108遍 共三次.MP3`（43:31.6）；
  功德開示：`000佛音靈氣000\6.大隨求陀羅尼 心咒功德.MP3`（3:59.5）。
- 計數：完整播放主音檔一次（≥85% 時長）自動 +324 遍（3 × 108）；另可手動 +108／+1。
- 登入：Google popup（`prompt: select_account`）、切換帳號、登出；Firestore `users/{uid}.mahapratisaraDays`，合併取較大值。未登入或斷網全部功能照用。

## 檔案

| 檔案 | 用途 |
|---|---|
| `index.html` | 頁面骨架、版本 pill、頁尾版本、PWA 連結 |
| `data.js` | 唯一內容來源 `window.MP_DATA`（四語、咒文、功德、出處、音檔） |
| `app.js` | 語言、播放、計數、紀錄、Google 登入、PWA、無障礙 |
| `native-audio.js` | Android `NativePlayer` 轉接器；有原生 bridge 時聲音交 MediaPlayer，否則用 `<audio>` |
| `apk/mahapratisara.apk` | Android App（package `hk.chunkin.tianyuan.mahapratisara`，v1.0.1，已簽名） |
| `styles.css` | 黑金／淺色、響應式、減少動態效果 |
| `manifest.webmanifest` | PWA 安裝、捷徑、icons |
| `sw.js` | App shell；程式碼 network-first、音檔 bypass（保留 Range 206） |
| `icons/` | PWA 圖示（由 `佛學系統/icons` 複製） |
| `AUDIT.md` | 本次代碼審核與修復清單 |

## 本機驗證

```powershell
node --check "G:\0佛光靈氣0\佛學系統\mahapratisara\app.js"
node --check "G:\0佛光靈氣0\佛學系統\mahapratisara\data.js"
node --check "G:\0佛光靈氣0\佛學系統\mahapratisara\sw.js"

cd "G:\0佛光靈氣0\佛學系統\上線"
node build-web.mjs
node serve.mjs 8125 "G:\0佛光靈氣0\佛學系統\上線\site"
# 開 http://localhost:8125/mahapratisara/
```

## Android APK

- 下載：`apk/mahapratisara.apk`（部署後：`https://tianyuanbuddhistschool-dev.github.io/foxue-system/mahapratisara/apk/mahapratisara.apk`）
- package：`hk.chunkin.tianyuan.mahapratisara`；versionName `1.0.1`；versionCode `2`；minSdk 23／target 36。
- 大小：45,120 bytes；SHA-256：`8EABFADF7D57EE2CD0667C984AF0FDA642037C6E4EFAD0F67BDD998935830CD2`。
- 簽名：`tianyuan.keystore`（alias `tianyuan`）；APK Signature Scheme v1／v2 驗證通過。
- 黑金首屏：原生 loading／error overlay，網絡失敗都唔會顯示白色 WebView 錯誤頁；有「重試」掣。
- 原生 `PlaybackService`：foreground service、partial wake lock、audio focus、MediaSession、通知欄控制、10 秒 watchdog。
- WebView 載入 `https://tianyuanbuddhistschool-dev.github.io/foxue-system/mahapratisara/`；`native-audio.js` 偵測到 `NativePlayer` 就將播放交原生 MediaPlayer，聲音不經 WebView。
- 可與光明真言／佛學系統 APK 並存。

## 已知限制

- Google 真實登入／Firestore 寫入未在 headless 完成（需要真人揀帳號）；程式已按現有 `foyin-lingqi-app` 專案與 `users/{uid}` 規則實作。Android WebView 內 Google 登入可能受 Google 對 embedded WebView 的限制；如要穩定登入，建議用瀏覽器版或另接 Custom Tabs。
- APK 未在真機做 30 分鐘鎖屏驗收；已用 native bridge mock 驗證 load／play／pause／seek／自動計次。
- 音檔是長版 43:31.6，首次載入建議 Wi-Fi；Service Worker 不攔截音檔，拖進度保留 HTTP Range。
- 咒文有罕用字（例如 `𤙖𤙖`），顯示與否取決於系統字型；不影響資料。
