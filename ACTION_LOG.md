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
- **殘餘風險**: Git 歷史中仍有 `.env.local`，需 repo 管理員執行：
  - [ ] `git filter-repo --path .env.local --invert-paths`
  - [ ] 更換所有已暴露的 keys
  - [ ] Force push

### 2. [已修復 commit] render 中呼叫 new Date() 造成效能問題
- **Commit**: `d7bf23d`
- **修復**: 改用 currentTime state + useEffect 每秒更新

### 3. [已修復 commit] ProgressBar.tsx Runtime Error
- **Commit**: `642ff21`
- **修復**: isLitNext 從檔案底部移至頂部

### 4. [已修復 commit] PAYUNi notify 缺原子性
- **Commit**: `642ff21`
- **修復**: 3 個 DB 操作包進 `prisma.$transaction()`

### 5. [已修復 commit] 費率顯示 5%→3%
- **Commit**: `642ff21`
- **修復**: driver/page.tsx 轉單費率文字修正

---

## 🟡 高優先（High Priority）— 全部完成

| # | 問題 | 修復方式 | Commit |
|---|------|---------|--------|
| 6 | 速率限制器非緒程安全 | UUID-per-request 模式 | `9da66d9` |
| 7 | SSE EventSource 非緒程安全 | 改用 Driver.lastSseCheckAt DB 欄位 | `9da66d9` |
| 8 | Settlement API 無分頁 | take/skip, max 100 | `9da66d9` |
| 9 | N+1：admin/users JS層過濾 | 移至 Prisma where.OR | `9da66d9` |
| 10 | LLM 解析無輸入長度限制 | 2000 字元截斷 | `9da66d9` |
| 11 | 司機餘額可能變成負數 | transaction 中檢查 balance | `9da66d9` |
| 12 | 訂單刪除缺少擁有權驗證 | DELETE 前驗證 dispatcherId | `9da66d9` |
| 13 | cancel 扣款錯誤訊息傳遞 | 區分「點數不足」錯誤，400 狀態 | `9da66d9` |

---

## 🟠 中優先（Medium Priority）

| # | 問題 | 狀態 | Commit |
|---|------|------|--------|
| 13 | 測試覆蓋率僅 12% | 🔄 進行中（C） | — |
| 14 | console.log 殘留 30+ 處 | ✅ 已修復 | `5add310` |
| 15 | README.md 過期 | ✅ 已完成 | `d520d7f` |
| 16 | CURRENT_WORK.md 落後 | ✅ 已完成 | `23216fb` |
| 17 | .env.example 不完整 | ✅ 已完成 | 本輪 D 補全 |
| 18 | Prisma migration orphan | ✅ 已完成 | 本輪 D 檢查（3個migration正常，發現schema drift需B補建） |
| 19 | 空 catch {} 吃掉錯誤 | ✅ 已修復 | `5add310` |
| 20 | 衝突接單警告可被繞過 | ✅ 已修復 | `5add310` |

---

## 🟢 低優先（Long-term）

21. [⏳ 待處理] Button/Card component 冗餘 variant
22. [⏳ 待處理] 狀態映射邏輯重複定義
23. [⏳ 待處理] 未使用的 import
24. [⏳ 待處理] Commit message 風格不一致

---

## 新功能：司機接單窗口（QR 貴賓預訂）

- **規格 commit**: `2b35ace`
- **實作狀態**: ✅ 後端完成（B），前端規劃中（A），文件更新完成（D）
- **規格檔案**: `docs/superpowers/specs/2026-04-16-driver-qr-order-design.md`
- **後端 commit**: `c8a8db5`
- **實作內容**:
  - DriverPricing CRUD API
  - DriverCustomer CRUD API（含自動 upsert）
  - GET/POST /api/book/[driverId] 公開 API
  - POST /api/orders/[id]/dispatch 外派至大廳

**實作規劃里程碑**（2026-04-16 更新）：

| 里程碑 | 負責 | 狀態 | Commit |
|--------|------|------|--------|
| 後端：Prisma schema 擴充 + API 端點 | B | ✅ 已完成 | `c8a8db5` |
| 前端：司機端報價設定 + 客戶資料庫 + 小車頭整合 | A | ✅ 已完成 | `1c05168` + 本次更新 |
| 前端：司機端卡片整合（OrderCard dispatch） | A | ✅ 已完成 | `119c12f` + 本次更新 |
| 前端：客人 QR 落地頁（/book/[driverId]） | A | ✅ 已完成 | `1c05168` + 本次更新 |
| 前端：QROrderChat 對話精靈（10步流程） | A | ✅ 已完成 | 本次 commit |
| QA 測試驗證 | C | 待排程 | — |
| 文件更新 | D | ✅ 已完成 | 各 commit |

---

## 今日完整 commits（2026-04-16）

```
a645021  fix: Order interface 新增 qrPrice 與 originalDriverId 欄位
1c05168  feat: QR貴賓單前端頁面與小車頭整合
119c12f  feat: QR貴賓單司機端卡片整合（OrderCard + Types）
c8a8db5  feat: QR貴賓單後端（DriverPricing/DriverCustomer API + 派單外派）
4f89a09  docs: 補全.env.example/檢查migration/更新CURRENT_WORK與ACTION_LOG
aab5356  test: 建立測試策略文件並撰寫示範測試
b7a0d6c  docs: 更新ACTION_LOG.md（高優先全部完成/中優先進度更新）
9da66d9  fix: 修復7個高優先後端問題（緒程安全/分頁/驗證/N+1等）
5add310  fix: 清理console.log/空catch/衝突警告繞過問題
2b42b8f  docs: 更新ACTION_LOG.md進度（緊急修復完成+中優先更新）
d520d7f  docs: 更新README.md反映實際專案狀態
23216fb  docs: 更新CURRENT_WORK.md（2026-04-16 ABCD審查+新功能立項）
d7bf23d  fix: driver/page render 中移除 new Date() 改用 state，解決效能問題
642ff21  fix: 修復 ProgressBar Runtime Error / PAYUNi notify 原子性 / 轉單費率顯示
2b35ace  docs: 建立司機接單窗口(QR貴賓預訂)設計規格
```

---

## 待完成（2026-04-16 下半天）

- [ ] C: QR貴賓單功能測試驗證
- [ ] 低優先 4 項（長期）
- [ ] GitHub .env.local 歷史清除（需管理員）
- [x] B: 司機接單窗口後端實作 ✅ (`c8a8db5`, `a645021`)
- [x] A: 司機接單窗口前端實作 ✅ (本次實作: QRPricingPanel + DriverCustomers + QROrderChat + book/[driverId]/page + OrderCard dispatch)
- [ ] C: QR貴賓單功能測試驗證