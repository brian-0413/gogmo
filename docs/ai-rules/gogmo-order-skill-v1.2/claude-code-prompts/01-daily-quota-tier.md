# Claude Code 提示詞：每日派單上限 + 會員分級

> **複製以下內容，貼給 Claude Code 開發。**  
> 預估開發時間：1 天  
> 優先級：⭐⭐⭐⭐⭐（最高，這是防止 API 帳單爆炸的核心機制）

---

## 提示詞本體

```
請依照以下需求實作 gogmo 的「每日派單上限」與「會員分級」功能。

## 背景脈絡
請先閱讀 docs/ai-rules/gogmo-order-skill/gogmo-order-format-spec.md 的「帳號規則」段落。

簡言之：平台不對基本派單收費，但需要每日上限防止濫用（例如惡意派 10 萬筆訂單拖垮系統與 API 帳單）。每日上限同時也是「進階會員」付費誘因。

## 功能需求

### 資料模型

新增 DispatcherTier enum：
- BASIC（基本派單方，每日 100 單，免費）
- PREMIUM（進階派單會員，每日 500 單，付費）
- ENTERPRISE（企業派單方，無上限，議價）

User 模型新增欄位：
- tier: DispatcherTier @default(BASIC)
- tierExpiresAt: DateTime?（會員到期日）
- dailyOrderCount: Int @default(0)（當日成功建立的訂單數）
- dailyCountResetAt: DateTime（下次重置時間，每天台北時間 0:00）

### 配額檢查邏輯

新增 lib/quota/dailyQuotaChecker.ts：

  function getQuotaLimit(tier: DispatcherTier): number {
    switch (tier) {
      case 'BASIC': return 100;
      case 'PREMIUM': return 500;
      case 'ENTERPRISE': return Infinity;
    }
  }
  
  async function checkAndIncrementQuota(userId: string): Promise<{
    allowed: boolean;
    used: number;
    limit: number;
    resetAt: Date;
  }> {
    // 1. 取得 user 的 tier 與 dailyOrderCount
    // 2. 若 dailyCountResetAt 已過，重置 count 為 0
    // 3. 若 count >= limit，回傳 allowed: false
    // 4. 否則 count++，回傳 allowed: true
    // 重要：此操作要用 Prisma transaction 避免 race condition
  }

### 整合到訂單建立流程

修改 POST /api/orders（建立訂單的端點）：

  // pseudocode
  const quotaCheck = await checkAndIncrementQuota(userId);
  
  if (!quotaCheck.allowed) {
    return NextResponse.json({
      error: 'DAILY_QUOTA_EXCEEDED',
      message: `已達當日派單上限 (${quotaCheck.used}/${quotaCheck.limit})`,
      currentTier: user.tier,
      resetAt: quotaCheck.resetAt,
      upgradeUrl: '/settings/upgrade'
    }, { status: 429 });
  }
  
  // ... 繼續建立訂單流程

**重要**：只有「成功建立的訂單」才扣配額。若訂單在 parseOrder 階段被 rejected，不扣配額（派單方友善設計）。

### 配額重置機制

每日台北時間 0:00 重置所有派單方的 dailyOrderCount。

實作方式（任選）：
- **方案 A（推薦）**：lazy reset。每次檢查 quota 時，若 dailyCountResetAt 已過，當場重置。免維護 cronjob，但邏輯需要 transaction 保護。
- **方案 B**：用 Vercel Cron / GitHub Actions 每日 0:00 觸發 batch update。

### UI 需求

#### 派單方端

1. **配額顯示元件**（位於 App 頂部 navigation bar）：
   ```
   今日派單：87/100  [升級]
   ```
   - 70% 以下：綠色
   - 70-90%：橘色
   - 90-100%：紅色 + 閃爍
   - 達上限：顯示「已達上限，0:00 重置」+「升級」按鈕

2. **超量錯誤頁**（當建立訂單回傳 429 時）：
   - 標題：「今日派單已達上限」
   - 訊息：「您的基本派單方方案為每日 100 單，已使用完畢」
   - 兩個 CTA：
     - 主要：「升級進階派單會員（500 單/日）」
     - 次要：「等待 0:00 重置（剩餘 X 小時）」

3. **升級頁** /app/settings/upgrade：
   - 顯示三個方案對照表（BASIC / PREMIUM / ENTERPRISE）
   - PREMIUM 與 ENTERPRISE 暫時顯示「🚧 即將推出，敬請期待」按鈕
   - 提供「告訴我們你的需求」表單，收集潛在付費用戶資訊

#### 後台
- 新增 GET /api/admin/quota-stats：列出當日各派單方的配額使用率
- 找出「持續貼近 100 單」的派單方 → 主動聯繫升級

### 與 AI 解析整合

修改批次匯入流程（lib/orders/batchImport.ts，若已實作）：
- 匯入前先檢查剩餘配額
- 若匯入 50 筆但只剩 30 配額，顯示警告：「您剩餘配額為 30 單，本次將只建立前 30 筆，剩餘 20 筆需明日再試」
- 派單方可選擇「只建立 30 筆」或「升級會員後全部建立」

## 邊界案例處理

1. **同時刻多個請求**：用 Prisma transaction + SELECT FOR UPDATE 防止 race condition 導致超量
2. **訂單建立後失敗回滾**：扣配額放在 transaction 內，與訂單建立同 commit/rollback
3. **手動重置**：管理員後台提供「重置某派單方配額」按鈕（用於客訴處理）
4. **時區**：所有 daily reset 用 Asia/Taipei 時區，不要用 UTC

## 測試需求
- 測試「第 100 單成功，第 101 單回傳 429」
- 測試「跨午夜時 count 自動重置」
- 測試「PREMIUM 用戶上限為 500」
- 測試「ENTERPRISE 用戶無上限」
- 測試 race condition：同時送出 5 個請求，total count 必須準確（不超過實際請求數）

## 完成標準
1. BASIC 用戶第 101 單會被擋
2. UI 配額顯示元件正確且即時
3. 跑 npm run test 全綠
4. 後台統計頁能看到所有派單方的配額使用率

請一次完成不要分批，最後寫一份簡短的 CHANGELOG.md。
```

---

## 給你的補充說明

- **配額計算只算成功訂單**是你之前的決定，這對派單方友善但要小心：如果有人故意貼 1 萬筆爛訊息讓 AI 解析，雖然不扣配額但會燒 API 錢。所以這份提示詞之外，**強烈建議再加一道「AI 解析次數」軟限制**（例如每日 200 次 AI 解析呼叫，超過暫時降速但不擋）。要不要做要看你的 API 帳單實際燒得多兇
- PREMIUM 與 ENTERPRISE 還沒定價，提示詞先用「即將推出」處理。等你決定定價後（建議 PREMIUM 月費 NT$500-1500，ENTERPRISE 議價）再回來補金流串接
- 完成後 spec.md 裡「每日派單上限」段落從規劃變實裝
