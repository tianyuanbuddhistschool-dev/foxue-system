# 大隨求陀羅尼・子站（v1.0.0）

**公開位置**：<https://tianyuanbuddhistschool-dev.github.io/foxue-system/mahapratisara/>

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

## 已知限制

- Google 真實登入／Firestore 寫入未在 headless 完成（需要真人揀帳號）；程式已按現有 `foyin-lingqi-app` 專案與 `users/{uid}` 規則實作。
- 未提供 Android APK；可用瀏覽器「加到主屏幕」。
- 音檔是長版 43:31.6，首次載入建議 Wi-Fi；Service Worker 不攔截音檔，拖進度保留 HTTP Range。
- 咒文有罕用字（例如 `𤙖𤙖`），顯示與否取決於系統字型；不影響資料。
