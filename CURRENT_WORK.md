# CURRENT_WORK.md

> 此檔案由 Claude Code 主要 session 維護，每次 commit 後更新。
> 推送到 GitHub 後，Haiku / Sonnet / Opus 任何對話都能快速掌握進度。

---

## 今日開發（2026-04-18）

### [完成] 安全與正確性修復（6 項）

**Branch**: `fix/security-and-correctness-2026-04`

**實作內容**：

1. **修補 /api/orders driverId 參數 PII 漏洞**
   - `src/app/api/orders/route.ts` GET handler
   - DRIVER 只能查詢自己的 driverId，否則 403
   - DISPATCHER 只能查詢有承接過自己訂單的司機，否則 403
   - ADMIN 無限制
   - 新增 status enum 白名單驗證

2. **accept endpoint race condition → 409 Conflict**
   - `src/app/api/orders/[id]/accept/route.ts`
   - updateMany 原子搶單已正確實作
   - 衝突時錯誤碼從 400 改為 409

3. **forgotPassword 生產環境寄送重設密碼郵件**
   - `src/lib/email.ts`：新增 sendResetPasswordEmail()
   - `src/lib/auth.ts`：forgotPassword() 在 NODE_ENV=production 時呼叫郵件函式
   - 開發環境維持 log 行為

4. **login / loginByPlate 補充 accountStatus=REJECTED 檢查**
   - `src/lib/auth.ts`
   - 密碼驗證成功後，若帳號為 REJECTED 一律回絕登入

5. **Prisma Schema drift migration**
   - 刪除錯誤的 migration 鏈（缺少初始建表 migration）
   - 建立乾淨的 20260418122052_baseline_2026_04 migration
   - drift 檢查：全部為 CREATE，無 DROP/ALTER/TRUNCATE
   - 新增 20260418122355_add_messaging_models

6. **完整即時訊息系統**
   - Prisma: MessageThread, MessageParticipant, Message 模型
   - API: threads CRUD, 發送/讀取訊息, 未讀計數
   - `src/lib/messages.ts`: getOrCreateThread, createSystemMessage, getUnreadCountByUser
   - 元件: MessageBadge, MessageThreadView

**Commits**（依序）：
- `fix(security): 修補 /api/orders driverId 參數權限檢查 + status enum 驗證`
- `fix(security): accept endpoint 搶單衝突回傳 409 Conflict`
- `fix(security): forgotPassword 生產環境寄送重設密碼郵件`
- `fix(security): login 和 loginByPlate 補充 accountStatus=REJECTED 檢查`
- `fix(infrastructure): 建立乾淨的 Prisma baseline migration`
- `feat: 新增完整即時訊息系統`

**待辦**：push 到 GitHub + 更新此檔案
