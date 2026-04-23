# Claude Code 提示詞：派單方實名註冊

> **複製以下內容，貼給 Claude Code 開發。**  
> 預估開發時間：1-2 天  
> 優先級：⭐⭐⭐⭐（高，這是「不收費」前提下防止人頭帳號的第一道防線）

---

## 提示詞本體

```
請依照以下需求實作 gogmo 的「派單方實名註冊」機制。

## 背景脈絡
請先閱讀 docs/ai-rules/gogmo-order-skill/gogmo-order-format-spec.md 的「實名註冊」段落。

簡言之：基本派單免費的前提下，必須防止人頭帳號濫用。實名註冊是第一道防線。

## 功能需求

### 註冊欄位

派單方註冊時必填：
- 真實姓名（與身分證一致）
- 行動電話（需簡訊 OTP 驗證）
- 電子信箱（需驗證連結）
- 帳號密碼（或 OAuth）

選填：
- 統一編號（公司戶必填，個人戶可空白）
- LINE ID（可選，用於司機聯繫）

### 資料模型

User 模型擴充：
- realName: String?（真實姓名）
- nationalIdHash: String?（身分證後 4 碼 SHA256，用於比對防多帳號）
- taxId: String?（統一編號）
- phoneNumber: String @unique（手機）
- phoneVerifiedAt: DateTime?
- emailVerifiedAt: DateTime?
- lineId: String?
- verificationStatus: VerificationStatus @default(PENDING)
- verifiedAt: DateTime?

新增 enum VerificationStatus：
- PENDING（待驗證，無法派單）
- PHONE_VERIFIED（手機已驗證）
- FULLY_VERIFIED（全部驗證完成，可派單）
- REJECTED（被審核拒絕，需聯繫客服）
- SUSPENDED（被停權）

### 註冊流程

#### Step 1: 基本資訊
- 真實姓名
- 行動電話
- 電子信箱
- 設定密碼

#### Step 2: 手機驗證
- 寄送 6 位數 OTP 到手機
- 60 秒可重發
- 5 次錯誤後鎖定 10 分鐘
- 驗證成功 → phoneVerifiedAt = now(), verificationStatus = PHONE_VERIFIED

#### Step 3: 信箱驗證
- 寄送驗證連結到信箱
- 連結 24 小時有效
- 點擊連結 → emailVerifiedAt = now()

#### Step 4: 商業資訊（依類型分流）
- 個人戶：填寫個人資訊
- 公司戶：填寫公司名稱 + 統一編號

#### Step 5: 啟用派單功能
- phoneVerifiedAt + emailVerifiedAt 都有值 → verificationStatus = FULLY_VERIFIED
- 可開始派單

### API 端點

POST /api/auth/register
- 入參：基本資料
- 邏輯：建立 User，verificationStatus = PENDING，發送手機 OTP

POST /api/auth/verify-phone
- 入參：{ phoneNumber, otp }
- 邏輯：驗證 OTP，成功則 phoneVerifiedAt = now()

POST /api/auth/resend-otp
- 60 秒 rate limit

GET /api/auth/verify-email/[token]
- 點擊信箱連結後執行
- 成功則 emailVerifiedAt = now()

POST /api/auth/complete-business-info
- 入參：個人/公司資訊

GET /api/auth/me
- 回傳當前用戶與驗證狀態

### 派單前的驗證檢查

修改 POST /api/orders（建立訂單端點）：

  if (user.verificationStatus !== 'FULLY_VERIFIED') {
    return NextResponse.json({
      error: 'NOT_VERIFIED',
      message: '請先完成實名註冊',
      pendingSteps: getPendingVerificationSteps(user)
    }, { status: 403 });
  }

### 防多帳號機制

簡單版（先做這個）：
- 同一手機號碼只能註冊一次（phoneNumber @unique）
- 同一統一編號只能註冊一次（除非加上「子帳號」概念，未來再做）

進階版（未來再做）：
- 身分證後 4 碼 hash 比對：個人戶要求填寫身分證後 4 碼，存 SHA256 hash，比對防同一人開多帳號

### UI 需求

#### 註冊流程頁
分步驟表單，明確顯示「Step 1/4 - Step 4/4」進度。

#### 驗證狀態顯示
- 派單方 dashboard 頂部顯示驗證狀態徽章
- 未完成驗證：紅色「⚠️ 請完成驗證才能派單」+ CTA 引導補完
- 完成驗證：綠色 ✅ 圖標（小巧不顯眼）

#### 補完驗證頁 /app/settings/verification
- 顯示每個驗證項目的狀態
- 已驗證：綠色勾
- 未驗證：紅色叉 + 「立即驗證」按鈕

### 簡訊服務串接

使用台灣本地簡訊服務商，建議：
- 三竹資訊（成本低）
- Mitake 簡訊
- 或 Twilio（國際但成本高）

簡訊內容範本：
「【gogmo】您的驗證碼為 [OTP]，10 分鐘內有效。如非本人操作請忽略。」

### 信箱服務串接

建議使用：
- Resend（推薦，DX 好）
- SendGrid
- Amazon SES

信箱驗證範本：
- 主旨：「[gogmo] 請驗證您的電子信箱」
- 內文：簡單說明 + 「驗證信箱」按鈕（連結至 /api/auth/verify-email/[token]）

### 安全考量

1. **密碼 hash**：用 bcrypt（cost factor 12）或 argon2
2. **OTP 防爆破**：5 次錯誤鎖定 10 分鐘，30 次錯誤要客服解鎖
3. **Token 安全**：信箱驗證 token 用 crypto.randomBytes(32) 產生，存 DB 加 expiry
4. **Rate limit**：註冊 API 加 IP-based rate limit（10 次/小時/IP）
5. **個資加密**：身分證後 4 碼僅存 hash，原文不存

## 測試需求
- 測試「未驗證的用戶無法派單」
- 測試 OTP 鎖定機制
- 測試「同手機號碼無法重複註冊」
- 測試信箱驗證 token 過期

## 完成標準
1. 完整註冊流程能跑通
2. 未完成驗證的派單方建立訂單會被擋
3. 簡訊與信箱實際能寄出
4. 跑 npm run test 全綠

請一次完成不要分批，最後寫一份簡短的 CHANGELOG.md。
```

---

## 給你的補充說明

- **簡訊成本**：台灣 SMS 約 NT$0.7-1.5/則。註冊時的 OTP 是必要成本，預估每位新派單方註冊成本 < NT$10
- **身分證 hash 機制要不要做**：第一版先不做（用手機 unique 就夠擋 80% 多帳號）。如果發現有人用多支手機開帳號才回頭加
- **信箱驗證可選性**：有些人會跳過信箱驗證。建議「PHONE_VERIFIED」就允許派單前 7 天，第 8 天起強制要求 emailVerifiedAt 才能繼續派單（這個邏輯如果想做要加進提示詞）
- **未來會延伸的功能**：
  - 子帳號（公司戶的多人共用同一統編帳號）
  - 派單方等級（青銅/白銀/金牌，與信譽分數結合）
  - 客戶實名查詢（其他派單方/司機可以查到「這位派單方真實姓名」）
