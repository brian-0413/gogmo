# ABCD 團隊修復日誌 - 2026-04-16

## 規則
- 每個 action 前紀錄意圖
- 完成後更新狀態
- 中斷後新 session 可從此接手

---

## 🔴 緊急修復（Immediate）

### 1. [.gitignore 已覆蓋] .env.local 已 commit 至 GitHub
- **發現者**: D
- **問題**: .env.local 暴露 Supabase/ANTHROPIC_API_KEY/GOOGLE_SERVICE_KEY/RESEND_API_KEY/JWT_SECRET
- **現況**: `.gitignore` 已含 `.env*`，新檔案不受影響
- **殘餘風險**: Git 歷史中仍有 `.env.local`，需 repo 管理員執行以下步驟：
  - [ ] 執行 `git filter-repo --path .env.local --invert-paths` 從歷史移除
  - [ ] 更換所有已暴露的 keys
  - [ ] Force push（需通知團隊）

### 2. [已修復 commit] render 中呼叫 new Date() 造成效能問題
- **發現者**: A
- **檔案**: src/app/dashboard/driver/page.tsx
- **Commit**: `d7bf23d fix: driver/page render 中移除 new Date() 改用 state，解決效能問題`
- **修復方式**: 移除 render 中的 new Date()，改用 currentTime state + useEffect 定時更新

### 3. [已修復 commit] ProgressBar.tsx Runtime Error
- **Commit**: `642ff21 fix: 修復 ProgressBar Runtime Error / PAYUNi notify 原子性 / 轉單費率顯示`
- **修復方式**: isLitNext 從檔案底部移至頂部

### 4. [已修復 commit] PAYUNi notify 缺原子性
- **Commit**: `642ff21`（同上）
- **修復方式**: 3 個 DB 操作包進 `prisma.$transaction()`

### 5. [已修復 commit] 費率顯示 5%→3%
- **Commit**: `642ff21`（同上）
- **修復方式**: driver/page.tsx 轉單費率文字 "5%" → "3%"

---

## 🟡 高優先（High Priority）

6. [待處理] 速率限制器非緒程安全
7. [待處理] SSE EventSource 非緒程安全
8. [待處理] Settlement API 無分頁限制
9. [待處理] N+1 查詢：admin/users 在 JS 層過濾
10. [待處理] LLM 解析無輸入長度限制
11. [待處理] 司機餘額可能變成負數
12. [待處理] 訂單刪除缺少擁有權驗證

---

## 🟠 中優先（Medium Priority）

13. [待處理] 現有測試覆蓋率僅 12%
14. [待處理] console.log 殘留 30+ 處
15. [已完成] README.md 完全過期
    - Commit: `d520d7f docs: 更新README.md反映實際專案狀態`
    - 更新內容：技術棧、核心功能（依實際實作）、專案結構（依實際檔案）、開發規範、測試帳號、商業邏輯
16. [已完成] CURRENT_WORK.md 落後 HEAD
    - Commit: `23216fb docs: 更新CURRENT_WORK.md（2026-04-16 ABCD審查+新功能立項）`
    - 新增「今日開發（2026-04-16）」區塊，記錄24個問題分類、已修復項目、新功能立項
17. [待處理] .env.example 不完整
18. [待處理] Prisma migration 可能有 orphan
19. [待處理] 空 catch {} 吃掉錯誤
20. [待處理] 衝突接單警告可被繞過

---

## 🟢 低優先（Low Priority）

21. [待處理] Button/Card component 有冗餘 variant
22. [待處理] 狀態映射邏輯重複定義
23. [待處理] 未使用的 import
24. [待處理] Commit message 風格不一致

---

## 新功能：司機接單窗口（QR 貴賓預訂）

**已 commit**: `2b35ace` — 規格文件完成
**實作狀態**: 未開始
**規格檔案**: `docs/superpowers/specs/2026-04-16-driver-qr-order-design.md`

---

## 今日 checkpoint（2026-04-16）

### 已完成
- [x] Commit 規格文件（QR貴賓單 + 客戶資料庫）— `2b35ace`
- [x] Commit 緊急修復（ProgressBar / PAYUNi原子性 / 費率顯示 / new Date()）— `642ff21`, `d7bf23d`
- [x] CURRENT_WORK.md 更新（D）— `23216fb`
- [x] README.md 更新（D）— `d520d7f`
- [x] ACTION_LOG.md 更新（D）— 本次更新

### 緊急待修復（其餘工程師負責）
- [ ] 速率限制器緒程安全（B）
- [ ] SSE EventSource 緒程安全（B）
- [ ] Settlement API 分頁（B）
- [ ] N+1 admin/users（B）
- [ ] LLM 輸入長度限制（B）
- [ ] 司機餘額防負數（B）
- [ ] 訂單刪除擁有權驗證（A/B）

### 中優先待處理
- [ ] console.log 清理（A）
- [ ] .env.example 補充完整（D）
- [ ] 空 catch 修復（A）
- [ ] 衝突接單警告（A）
- [ ] 測試覆蓋策略（C）