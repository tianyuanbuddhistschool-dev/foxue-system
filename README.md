# 佛學系統

光明真言唱誦、修行打卡、經文閱讀（四語對照）、收藏筆記嘅單頁網頁應用（PWA）。

## 功能

- 經文閱讀：原文＋白話＋四語對照（粵語／普通話／English／越南文），支援語音朗讀
- 唱誦計次：手動計次＋播音自動計次（支援熄屏／鎖屏背景播放）
- 修行打卡：連續日數、累計、月曆
- 收藏筆記：收藏經文段落＋寫修行心得
- Google 帳號登入（Firebase Auth），每個帳號獨立記錄
- 淺色／暗金主題切換
- 數據匯出／匯入備份

## 檔案結構

```
├── index.html          # 主程式（單頁 HTML）
├── manifest.json       # PWA 清單
├── service-worker.js   # 離線快取＋背景播放
├── icons/              # App 圖示
├── audio/
│   ├── guangming.m4a   # 光明真言唱誦（約 78 分鐘）
│   └── dainichi.m4a    # 大日如來光明真言（約 30 分鐘）
└── README.md
```

## 部署

### 本地測試

```bash
python -m http.server 8734
# 開 http://127.0.0.1:8734/
```

### Cloudflare Pages

```bash
npx wrangler pages deploy .
```

### GitHub Pages

1. 建立 GitHub repository
2. `git init && git add . && git commit -m "init"`
3. `git remote add origin <你的 repo 網址>`
4. `git push -u origin main`

## 技術說明

- 背景播放：Media Session API ＋ PWA
- 認證：Firebase Auth（Google 登入）
- 儲存：localStorage（分帳號分倉，唔上雲）
