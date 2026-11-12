# 🎵 塗鴉音符劍豪 — 禹承老師音樂課

結合 **五線譜音符／休止符手繪辨識** 與 **3D 道場像素神兵對決** 的音樂互動遊戲！

- **六大題庫隨機出題**：四分音符、八分音符、二分音符、四分休止符、二分休止符、全休止符（含第三線二分休止符 vs 第四線全休止符位置判讀）
- **先過關再鍛造開戰**：手繪通過樂理判定後，自動鍛造為專屬 3D 立體音符武器上場對決
- **豐富模式**：單人八人斬闖關（迎戰最終黃金指揮大佛）、同機雙人對戰、自動／手動搖桿格擋操作、角色細節特寫鑑賞
- **三首戰鬥 BGM 自動輪播**：開始戰鬥時自動依序輪播 `audio/bgm1.mp3` → `bgm2.mp3` → `bgm3.mp3`

---

## 🚀 快速部署至 GitHub Pages（免編譯、直接上線）

專案根目錄中的 `index.html` **已完成單一檔案打包**，上傳至 GitHub 即可直接開啟免費網頁連結：

1. 在 GitHub 建立一個新的公開儲存庫（Repository）。
2. 將本封包解壓縮後，把裡面的所有檔案（請確保 `index.html`、`audio/`、`.nojekyll` 位於儲存庫**最外層根目錄**）上傳至 GitHub。
3. 將您的三個戰鬥音樂檔放入 `audio/` 資料夾中：
   - `audio/bgm1.mp3`
   - `audio/bgm2.mp3`
   - `audio/bgm3.mp3`
   > 💡 若您的音檔檔名或格式不同（如 `.wav` / `.ogg` / `.m4a`），可直接編輯 `index.html` 最上方 `<head>` 內的 `window.BATTLE_BGM_TRACKS` 與 `window.BATTLE_BGM_VOLUME`，存檔即可生效，無需重新打包！
4. 在 GitHub 儲存庫頁面點選上方 **Settings** → 左側 **Pages** → **Build and deployment**：
   - **Source** 選擇 `Deploy from a branch`
   - **Branch** 選擇 `main`（或 `master`）、資料夾選 `/ (root)`，點擊 **Save**。
5. 等待約 1 分鐘，即可透過 GitHub Pages 提供的網址直接遊玩！

---

## 🛠️ 本地端修改原始碼與重新打包（選用）

若日後需要修改 `src/` 內的原始碼並重新生成 `index.html`：

```bash
# 1. 安裝相依套件（需 Node.js 18+）
npm install

# 2. 重新打包單一檔案 index.html
npm run build

# 3. 執行自動化測試（音符辨識、BGM 輪播、3D 角色骨架檢查）
npm test

# 4. 啟動本地預覽伺服器（http://localhost:3000）
npm start
```

---

## 📁 專案目錄結構

```text
.
├── index.html          # 已打包完成的獨立遊戲主檔（可直接部署至 GitHub Pages）
├── .nojekyll           # 讓 GitHub Pages 直接提供靜態資源
├── audio/              # 放入戰鬥輪播音檔（bgm1.mp3、bgm2.mp3、bgm3.mp3）
│   └── README.md       # 音檔命名與音量調整說明
├── src/                # 遊戲原始碼（五線譜判定、3D 道場、角色骨架、音效系統）
├── scripts/build.mjs   # esbuild 單檔打包腳本
├── tests/              # 自動化測試套件
├── server.mjs          # 本地靜態測試伺服器（支援音訊串流 Range 請求）
└── package.json        # Node.js 專案設定
```
