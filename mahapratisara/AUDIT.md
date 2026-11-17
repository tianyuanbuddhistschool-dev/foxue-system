# 大隨求陀羅尼・代碼審核與修復紀錄（v1.0.1）

審核日期：2026-11-17  
審核範圍：原單頁 App（`index.html` 內嵌 CSS／JavaScript）→ 重構為 `index.html`＋`app.js`＋`data.js`＋`styles.css`＋PWA。  
標準：`佛音靈氣系統製作標準 v1.11`（黑金、四語、版本標示、三段循環、Google 登入、PWA、可驗收、可部署）。

## 一、原碼主要問題

| 類別 | 問題 | 根因 | 修復 |
|---|---|---|---|
| 可用性 | 頁面一開就載入 3 個 Firebase CDN script，離線／被封鎖時頁面可能長時間空白 | `defer` 依序阻塞 | Firebase 改 `async`、可選載入；本機 UI 先畫；載入失敗只停用登入 |
| 可用性 | 音檔路徑寫死 `audio/daisuigu_10min_v1.m4a`，但文案說 43 分鐘 | 檔案與文案不一致 | 改用真實 43:31.6 音檔；時長由 metadata 讀取，不再硬編 |
| 可用性 | `prefetchAudio()` 對 `file://` 先 fetch，失敗再 fetch，才 fallback | 無協議判斷 | 移除預載 Blob 邏輯；`file://` 用原始路徑，http(s) 用上線包路徑 |
| 邏輯 | `audioEl.loop = true` 永遠開啟；全輯／單曲不分 | 只用 `loop` 控制 | `audio.loop` 永遠 `false`；`ended` 控制全部／單曲／不循環 |
| 邏輯 | 每次 loop 都 `count++`，未聽完也計；`ended` 與 `timeupdate` 可能重複計 | 計次與播放事件混在一起 | 以 `listened` 累計實際播放秒數，≥85% 時長才 +324；手動 +108／+1 另計 |
| 邏輯 | 按「誦讀」掣即 `count++`，與播放無關 | 手動計數語意不清 | 手動按鈕改為 +108／+1；自動計次只在完整播放後 |
| 邏輯 | `TOTAL_DUR = 600` 與 43 分鐘音檔不符 | 硬編常數 | 用 `audio.duration`；載入前用資料檔時長 fallback |
| 四語 | 英文／越南文部分段落仍見中文；`RITUAL` 只有中文 | 只翻介面，未翻內容 | 重建四語內容；EN／VI 功德、注意、實修、FAQ、頁尾掃描 0 條中文 |
| 四語 | 預設語言讀 localStorage 後無驗證，壞資料會 crash | 直接 `CONTENT[lang]` | `normalizeState()` 驗證 `yue/cmn/en/vi` |
| 認證 | 沒有 `prompt: select_account`；沒有切換帳號 | 只做基本 popup | 加 `select_account`、切換帳號、登出；只有 `popup-blocked` 才 redirect |
| 認證 | 沒有 Firestore 同步；BS 模組另存整包 localStorage | 架構未整合 | 直接寫 `users/{uid}.mahapratisaraDays`，合併取較大值 |
| 版本 | 全頁沒有版本字 | 未跟標準 | 頂部金色 pill、`<title>`、頁尾版本（在安裝掣上面） |
| PWA | 只有 `manifest` 連結，沒有 manifest／SW／icons；路徑用 `/` 絕對路徑 | 未完成 PWA | 加 `manifest.webmanifest`、`sw.js`、`icons/`；全部相對路徑，適配 GitHub Pages 子路徑 |
| PWA | 靜態檔 cache-first，更新後仍用舊 `app.js` | SW 策略 | 程式碼／樣式／資料改 network-first；音檔 bypass；icons cache-first |
| 無障礙 | 進度條是 `div`，不可鍵盤拖；語言掣無 `aria-pressed`；章節無 `aria-labelledby` | 只做視覺 | 改用 `input[type=range]`、補 `aria-*`、skip link、focus-visible、`prefers-reduced-motion` |
| 設計 | 功能 icon 用 emoji；外部 Google Fonts | 跟舊版習慣 | 移除 emoji 功能 icon、移除 Google Fonts；只用系統字體 |
| 內容 | 功德全部混在一起，沒有「經說／傳統」區分 | 直接列舉 | 每組加 type badge；加「不宣稱治病／消災保證」與就醫提醒 |
| 內容 | 咒文只有通行版，經本與音檔差異未標 | 未考據 | 並列 CBETA T20 no. 1154 經本、通行持誦版、梵文轉寫；標「待考」 |
| 內容 | 《佛心經》心中心咒與大隨求心咒混為一談 | 法門混淆 | 分成附錄，明言同系統但經本／用字／傳承不同，正式修法須依師 |
| 安全 | 直接 `innerHTML` 插入大量字串 | XSS 風險（雖然資料自控） | 渲染改用 `textContent`／`createElement` |
| Android | 原碼冇 APK；WebView 聲音會經 WebView，背景易被殺 | 未建原生殼 | 建 `native-mahapratisara`：WebView＋MediaPlayer foreground service；`native-audio.js` 自動切換原生播放 |
| 首屏 | APK 首次載入／網絡失敗時見白色 WebView 預設錯誤頁 | 冇原生 loading／error UI | 加黑金 loading overlay＋黑金錯誤頁＋「重試」；Web 加 inline critical CSS 防白閃；APK URL 加 `?theme=dark` 強制黑金 |
| Android | 服務通知／MediaSession 中文字亂碼 | 舊檔編碼損壞 | 重寫 `MainActivity.java`／`PlaybackService.java`，通知、標題、按鈕全部用正常繁體中文 |
| Android | 原生暫停後 UI 仍顯示「未開始」 | `native-audio.js` pause 未更新 currentTime | 修正 shim：pause／ended 同步 currentTime／duration |

## 二、修復後驗收（本機 headless Chrome）

- 版本：`<title>`、頂部 pill、頁尾版本均為 `v1.0.1`。
- 四語：4 個語言掣；粵／普／EN／VI 切換正常；EN／VI 的 hero、功德、注意、實修、FAQ、頁尾 0 條 CJK；無 `undefined`；無空區塊。
- 播放：主音檔 `duration=2611.617938`、`readyState=4`；播放 1.9 秒後 `paused=false`；`audio.loop=false`。
- 循環：全部 → 單曲 → 不循環 → 全部；三段標籤同步。
- 計數：+108 → 108；+1 → 109；3 × 108 → 324、完成 1 輪；重新載入後保留。
- 紀錄：14 日歷史；重設後顯示「暫未有任何紀錄」；匯出／匯入／清除有確認。
- PWA：`Page.getAppManifest` 0 error；`Page.getInstallabilityErrors` 0 error；Service Worker scope `/mahapratisara/`。
- 資源：`styles.css`／`data.js`／`app.js`／`manifest.webmanifest`／`sw.js` 200；音檔 Range 206；0 console error。
- 離線：封鎖 `gstatic.com` 後頁面仍完整渲染、登入自動停用、本機播放與計數照用。
- `file://`：音檔可載入並播放（`duration=2611.617938`）。
- DOM：0 個重複 ID。
- Native bridge mock：`NativeAudio.available()` 觸發；`setLoop(false)`、`load`、`play`、`pause`、`seek` 呼叫正確；原生播放時 DOM `<audio>` 保持 paused，0 console error。
- Native 自動計次：模擬完整 43:31 播放後，`auto=324`、完成 1 輪；0 console error。

## 三、Android APK

- 專案：`C:\Users\cheun\Projects\_android\native-mahapratisara`。
- package `hk.chunkin.tianyuan.mahapratisara`；versionName `1.0.1`；versionCode `2`；minSdk 23／target 36。
- 簽名：`tianyuan.keystore`（alias `tianyuan`）；`apksigner verify` v1／v2 通過。
- APK：`apk/mahapratisara.apk`（45,120 bytes；SHA-256 `8EABFADF…35830CD2`）。
- 黑金首屏：原生 loading／error overlay；網絡失敗有「重試」；APK URL `?theme=dark`。
- 原生 service：foreground mediaPlayback、partial wake lock、audio focus、MediaSession、通知欄、10 秒 watchdog。
- WebView 載入子站；`native-audio.js` 將播放交原生 MediaPlayer，聲音不經 WebView。

## 四、部署

- 平台：GitHub Pages；repo `tianyuanbuddhistschool-dev/foxue-system`，分支 `main`。
- 公開網址：<https://tianyuanbuddhistschool-dev.github.io/foxue-system/mahapratisara/>。
- 子站 APK／native 版本：commit `3d928fa`；其後 repo HEAD `c9f04a1`（同時包含光明真言 v2.3.0 四語工作）。
- Pages build：最新 HEAD 建置 **success**（2026-11-17T12:57:18Z）。
- 上線實測：子站與五個程式檔 200、兩個音檔 Range 206、APK 200（`application/vnd.android.package-archive`，43,263 bytes）、PWA installability 0 error、0 console error。

## 五、未完成／待真機

- Google 真實登入與 Firestore 寫入：headless 沒有 Google session，需真人撳一次；程式已用 `foyin-lingqi-app` 與 `users/{uid}` 規則。Android WebView 內 Google 登入可能受 embedded WebView 限制。
- 30 分鐘鎖屏長播：未在真機驗收；APK 已用原生 MediaPlayer＋foreground service＋wake lock＋watchdog，仍需真機確認 OEM 省電行為。
