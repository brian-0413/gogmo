# CURRENT_WORK.md

> 此檔案由 Claude Code 主要 session 維護，每次 commit 後更新。
> 推送到 GitHub 後，Haiku / Sonnet / Opus 任何對話都能快速掌握進度。

---

## 今日開發（2026-04-21）

### [完成] 派單方審核司機接單功能

**Branch**: `main`

**實作內容（7 Tasks）**：

1. **修改 accept route — 司機接單改為 ASSIGNED**
   - `src/app/api/orders/[id]/accept/route.ts`
   - 司機接單後狀態改為 `ASSIGNED`（等待派單方審核），不再立即扣點
   - 保留點數門檻檢查、車型相容性檢查、衝突檢查

2. **新建 dispatcher-approve API**
   - `src/app/api/orders/[id]/dispatcher-approve/route.ts`
   - 派單方同意 → 正式 ACCEPTED + 扣點 + 寫 Transaction 記錄
   - 使用 prisma.$transaction 確保原子性

3. **新建 dispatcher-reject API**
   - `src/app/api/orders/[id]/dispatcher-reject/route.ts`
   - 派單方拒絕 → 狀態回到 PUBLISHED + driverId 清空 + 發訊息通知司機

4. **新建 pending-approvals GET API**
   - `src/app/api/dispatcher/pending-approvals/route.ts`
   - 取派單方所有 ASSIGNED 訂單，含司機資料及三證

5. **新建 PendingApprovalCard 元件**
   - `src/components/dispatcher/PendingApprovalCard.tsx`
   - 顯示司機姓名（只顯示名）、車號、車型是否符合（✅/❌）、三證（✅/❌）
   - 同意/拒絕按鈕

6. **派單方行控中心新增待同意 Tab**
   - `src/app/dashboard/dispatcher/page.tsx`
   - 新增 `pending-approval` Tab，含紅色 badge 顯示筆數
   - 每 10 秒自動刷新

7. **lock-orders cron 加入逾時自動取消**
   - `src/app/api/cron/lock-orders/route.ts`
   - PUBLISHED 且 scheduledTime + 90分鐘 < now → 自動 CANCELLED
   - 寬限期可透過 ORDER_EXPIRE_GRACE_MINUTES 環境變數調整

**另修復**：
- 訂單時間時區問題（datetime-local 無時區被當 UTC 存）
  - `src/app/api/orders/route.ts` — 使用已 parse 的 scheduledDate
  - `src/app/api/orders/self-publish/route.ts` — 同樣修正
- SmartSchedulePanel 車型顯示改用正規化 API（移除硬編碼）
- SmartSchedulePanel 建議卡片加上 💡 接駁提示框

**Commits**（依序）：
- `fix: 司機接單改為 ASSIGNED 等待派單方審核`
- `fix: 移除 accept route 多餘 import 與無用變數`
- `feat: 新增派單方同意司機接單 API`
- `feat: 新增派單方拒絕司機接單 API`
- `feat: 新增派單方待審核訂單查詢 API`
- `feat: 新增派單方待審核卡片元件`
- `feat: 派單方行控中心新增待同意 Tab`
- `fix: 修復派單方待同意 Tab 的 fetch race condition`
- `fix: handleReject 事後呼叫 fetchOrders 同步訂單列表`
- `feat: lock-orders cron 加入逾時自動取消邏輯`
- `fix: 訂單時間時區問題，修復 datetime-local 無時區被當 UTC 存的 bug`
- `fix: SmartSchedulePanel 車型種類顯示改用正規化 API，移除硬編碼`
- `feat: SmartSchedulePanel 建議卡片加上 💡 接駁提示框`

---

## 進行中

- 司機端 prototype 實作：重構儀表板為 5 Tab（新接單大廳 / 行程 / 訊息中心 / 帳務 / 個人）
  - Tab 重新命名：hall / schedule / messages / balance / profile
  - 底部 Nav 同步更新為 5 Tab
  - 移除 selfdispatch / squad tab（移除的小車頭、我的小隊功能）
  - 訊息改為獨立 Tab，移除訊息抽屜 drawer
  - [完成] Filter pills（全部/接機/送機/包車）
  - [完成] 訊息按鈕改為導向獨立 messages tab，移除訊息 drawer
  - [完成] SettlementTab 改為點數/行程雙 Tab（廢除摺疊）
  - [完成] ProfileTab 加入深色模式切換設定區塊
  - [完成] OrderCard Premium 金邊 + Urgent 倒數計時
  - [完成] 訊息中心整合未讀 badge（底部 Nav + Tab Header）
  - [完成] Balance Tab 頂部「可用點數/待結算」橫幅
  - [完成] 深色模式完整實作（localStorage 持久化 + 即時 toggle）
  - [完成] Schedule Tab 新增時間軸視圖（月曆/時間軸切換）
  - [完成] ProgressBar 重新設計為 4-step 編號進度條

## 待辦

- 司機遲到/缺席處理機制
- LINE 通知整合
