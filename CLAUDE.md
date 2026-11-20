# CLAUDE.md

本檔案提供 Claude Code 在此專案中工作時所需的背景與規範。

## 專案概述

CipherKeep（密碼守護者）是一個**純前端、零後端**的離線密碼管理 PWA。所有資料以使用者的主密碼在瀏覽器端加密後存放於 `localStorage`，不會傳送到任何伺服器。

## 檔案結構

| 檔案 | 用途 |
| --- | --- |
| `index.html` | 整個應用程式：HTML 版面、CSP、內嵌 `<style>` 與全部 JavaScript（單一 `<script>` 區塊） |
| `tailwind.css` | 預先產生的 Tailwind CSS v3 樣式（取代 `cdn.tailwindcss.com` 腳本） |
| `tailwind.config.js` | 重新產生 `tailwind.css` 用的設定（色票、字型） |
| `manifest.json` | PWA 安裝設定（名稱、主題色、圖示） |
| `sw.js` | Service Worker，負責離線快取（Offline First） |
| `icons/` | PWA 與主畫面圖示（PNG） |

沒有建置步驟、沒有套件管理器、沒有測試框架。**頁面不載入任何第三方腳本**；外部資源只有樣式與字型：Font Awesome 6.4.0（cdnjs，含 SRI）、Google Fonts（Inter、Noto Sans TC）。

## 本機執行

Service Worker 與 Web Crypto 只能在 `http(s)://`（或 `localhost`）下運作，直接以 `file://` 開啟時無法使用。請用任一靜態伺服器：

```powershell
npx serve .
```

或

```powershell
python -m http.server 8000
```

測試時注意 Service Worker 採快取優先：改了檔案後若看到舊版，需遞增 `CACHE_NAME`，或在 DevTools 取消註冊 Service Worker。

## 重新產生 tailwind.css

`tailwind.css` 只包含 `index.html` 目前用到的 class。**新增或修改 Tailwind class 後必須重新產生**，否則新樣式不會生效：

```powershell
npx tailwindcss@3 -c tailwind.config.js -o tailwind.css --minify
```

（沒有 Node.js 時，可改用 Tailwind v3 standalone CLI，參數相同。）產生後記得遞增 `sw.js` 的 `CACHE_NAME`。

## 架構重點

### 加密流程
- `deriveKey(password, salt, iterations)`：PBKDF2-SHA256 → AES-GCM 256 位元金鑰。新資料使用 `PBKDF2_ITERATIONS`（**600,000**）。
- 儲存格式 v2：`{ v: 2, iter, salt, iv, ciphertext }`（Base64）。沒有 `iter` 欄位的舊格式視為 `LEGACY_PBKDF2_ITERATIONS`（80,000）；超過 `MAX_PBKDF2_ITERATIONS` 的值一律拒絕。
- 解鎖後金鑰保存在 `vaultKey` / `vaultSalt` / `vaultIterations`，每次儲存只換新的 12 位元組 IV，不重跑 PBKDF2。
- `decryptVault()` 成功回傳 `{ text, key, salt, iterations }`，失敗回傳 `null`（用來判斷主密碼是否正確）。
- 解鎖舊格式時會自動以新的 salt 與迭代次數重新加密（`setNewVaultKey()` + 儲存）。
- `saveVaultToLocalStorage()`：將 `{ items, groups }` 加密後寫入 `localStorage[VAULT_STORAGE_KEY]`。**任何修改資料的操作之後都必須呼叫它**。

### 自動上鎖與剪貼簿
- 閒置 `AUTO_LOCK_IDLE_MS`（5 分鐘），或離開頁面 `AUTO_LOCK_HIDDEN_MS`（1 分鐘）會自動 `lockVault()`。
- `lockVault(message)` 會清除金鑰、記憶體資料，以及畫面上殘留的敏感內容（表單、列表、產生器、開啟中的視窗）。新增顯示敏感資料的元素時，要一併加入清除。
- `copyToClipboard()` 複製後 30 秒會清空剪貼簿；若當下頁面不在前景，會在使用者回到頁面或下一次互動時再清除。

### 全域狀態
`masterPassword`、`vaultKey`、`vaultSalt`、`vaultIterations`、`vaultItems`、`groups`（第一個元素 `預設群組` 為不可刪除的預設群組）、`activeTab`、`groupFilter`、`editingGroupName`。用 `isVaultUnlocked()` 判斷是否已解鎖。

### 資料模型
憑證項目：`{ id, group, title, username, password, notes }`。刪除群組時，其項目會遷移至 `groups[0]`。

### UI
- 三個分頁：`vault`（保險庫）、`generator`（產生器）、`tools`（設定備份），以 `switchTab()` 切換。
- 畫面以 `hidden` class 切換顯示；靜態按鈕使用 inline `onclick`。
- 列表使用字串模板動態產生 DOM，**使用者資料只能以 `escapeHtml()` 放進文字內容；絕不可放進 inline `onclick` 等屬性**。動態元素一律用 `data-action` 標記，再以 `addEventListener` 綁定事件，以避免 XSS 與跳脫錯誤。
- 需要使用者確認的破壞性操作（刪除、覆蓋）使用 `await showConfirm(title, message, okText)`，回傳 `true` / `false`。

### 匯出 / 匯入
匯出即為 `localStorage` 中的加密 JSON 原文。匯入時先以目前主密碼嘗試解密：成功則確認後直接載入並以目前金鑰重新加密；失敗則警告並確認後覆寫，需以該備份的主密碼重新解鎖。

## 開發規範

- 使用者介面文字與程式註解一律使用**繁體中文**。
- 維持單一 `index.html` 的架構，除非使用者明確要求拆分。
- 風格沿用既有的 Tailwind 色票：`brand-*`（紫色系，只定義了 50/100/500/600/700/900）與 `android-darkBg / darkSurface / darkSurfaceVariant`，深色、Material/Android 風格，版面寬度上限 `max-w-md`。
- **修改 `sw.js` 快取內容或任何被快取的資源後，務必遞增 `CACHE_NAME` 版本號**，否則已安裝的使用者會一直讀到舊版。
- **不要加入任何第三方 `<script>`**。若新增外部樣式或字型，需同時：加入 `sw.js` 的 `ASSETS_TO_CACHE`、調整 `index.html` 的 CSP，並盡量加上 SRI（`integrity`）。
- `localStorage` 只能操作 `VAULT_STORAGE_KEY`，**不可使用 `localStorage.clear()`**（GitHub Pages 同網域的其他專案共用儲存空間）。
- 變更加密參數或資料格式時，必須沿用 `v` / `iter` 欄位做向下相容，讓舊保險庫與舊備份仍可解密。

## 已知注意事項

- 所有與密碼相關的亂數一律使用 `secureRandomInt()`（`crypto.getRandomValues()` 加拒絕取樣），**不要使用 `Math.random()`**；洗牌使用 Fisher-Yates。
- 主密碼於解鎖期間仍以明文保存在 `masterPassword`（匯入其他備份時需要用它解密）。
- App 圖示位於 `icons/`（`icon-192.png`、`icon-512.png`、`apple-touch-icon.png`），已加入 `sw.js` 快取。
