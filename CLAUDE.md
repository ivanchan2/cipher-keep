# CLAUDE.md

本檔案提供 Claude Code 在此專案中工作時所需的背景與規範。

## 專案概述

CipherKeep（密碼守護者）是一個**純前端、零後端**的離線密碼管理 PWA。所有資料以使用者的主密碼在瀏覽器端加密後存放於 `localStorage`，不會傳送到任何伺服器。

## 檔案結構

| 檔案 | 用途 |
| --- | --- |
| `index.html` | 整個應用程式：HTML 版面、Tailwind 設定、內嵌 `<style>` 與全部 JavaScript（單一 `<script>` 區塊，約第 502 行起） |
| `manifest.json` | PWA 安裝設定（名稱、主題色、圖示） |
| `sw.js` | Service Worker，負責離線快取（Offline First） |

沒有建置步驟、沒有套件管理器、沒有測試框架。外部相依僅透過 CDN 載入：Tailwind CSS（`cdn.tailwindcss.com`）、Font Awesome 6.4.0、Google Fonts（Inter、Noto Sans TC）。

## 本機執行

Service Worker 只能在 `http(s)://` 下註冊，直接以 `file://` 開啟時離線功能不會啟用。請用任一靜態伺服器：

```powershell
npx serve .
```

或

```powershell
python -m http.server 8000
```

## 架構重點

### 加密流程（`index.html` 約第 620–766 行）
- `deriveKey()`：PBKDF2-SHA256，**80,000 次迭代**，16 位元組隨機 salt → AES-GCM 256 位元金鑰。
- `encryptData()` / `decryptData()`：每次儲存都產生新的 salt 與 12 位元組 IV，輸出 `{ salt, iv, ciphertext }`（皆為 Base64）。
- `decryptData()` 解密失敗時回傳 `null`，用來判斷主密碼是否正確。
- `saveVaultToLocalStorage()`：將 `{ items, groups }` 整包加密後寫入 `localStorage` 的 `cipherkeep_encrypted_vault` 鍵。**任何修改資料的操作之後都必須呼叫它**。

### 全域狀態
`masterPassword`、`vaultItems`、`groups`（第一個元素 `預設群組` 為不可刪除的預設群組）、`activeTab`、`groupFilter`、`editingGroupName`。`lockVault()` 會清空這些狀態。

### 資料模型
憑證項目：`{ id, group, title, username, password, notes }`。刪除群組時，其項目會遷移至 `groups[0]`。

### UI
- 三個分頁：`vault`（保險庫）、`generator`（產生器）、`tools`（設定備份），以 `switchTab()` 切換。
- 畫面以 `hidden` class 切換顯示；事件綁定大多為 inline `onclick` / `oninput`。
- 列表使用字串模板動態產生 DOM，**插入使用者資料時必須使用 `escapeHtml()`；放進 inline JS 字串時使用 `escapeJs()`**，以避免 XSS。

### 匯出 / 匯入
匯出即為 `localStorage` 中的加密 JSON 原文；匯入時檢查欄位後直接覆寫，並需重新以主密碼解鎖。

## 開發規範

- 使用者介面文字與程式註解一律使用**繁體中文**。
- 維持單一 `index.html` 的架構，除非使用者明確要求拆分。
- 風格沿用既有的 Tailwind 色票：`brand-*`（紫色系）與 `android-darkBg / darkSurface / darkSurfaceVariant`，深色、Material/Android 風格，版面寬度上限 `max-w-md`。
- **修改 `sw.js` 快取內容或任何被快取的資源後，務必遞增 `CACHE_NAME` 版本號**（例如 `cipherkeep-offline-cache-v2`），否則已安裝的使用者會一直讀到舊版。
- 若新增外部資源，需同步加入 `sw.js` 的 `ASSETS_TO_CACHE`，才能離線使用。
- 變更加密參數（迭代次數、演算法、資料格式）會導致既有保險庫與備份無法解密，必須設計向下相容的遷移方案（例如在加密物件中加入版本欄位）。

## 已知注意事項

- 所有與密碼相關的亂數一律使用 `secureRandomInt()`（`crypto.getRandomValues()` 加拒絕取樣），**不要使用 `Math.random()`**；洗牌使用 Fisher-Yates。
- 主密碼於解鎖期間以明文保存在記憶體變數 `masterPassword` 中。
- `manifest.json` 與 `apple-touch-icon` 的圖示目前使用 `placehold.co` 佔位圖片。
