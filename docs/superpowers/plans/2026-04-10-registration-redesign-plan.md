# 使用者註冊功能改善 — 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將註冊改為多步驟精靈、登入改為雙Tab、加入文件上傳驗證與Email驗證機制

**Architecture:**
- 前端：多步驟精靈（5步），雙Tab登入頁，均為 client component (`'use client'`)
- 後端：擴充 `/api/auth` 端點群組 + 新增 `/api/uploads` + `/api/admin/reviews`
- 資料庫：Prisma schema 新增 `AccountStatus` enum、`User` 新增4個欄位、新增 `UserDocument` model
- Email：使用現有 nodemailer/gmail 設定（需確認寄送方式）

**Tech Stack:** Next.js 14 App Router, Prisma ORM, PostgreSQL, nodemailer (email)

---

## 檔案結構

### 新增
- `src/app/api/auth/forgot-password/route.ts` — 忘記密碼 API
- `src/app/api/auth/reset-password/route.ts` — 重設密碼 API
- `src/app/api/auth/verify-email/route.ts` — Email 驗證 API
- `src/app/api/auth/send-verify-email/route.ts` — 重發驗證信 API
- `src/app/api/uploads/route.ts` — 檔案上傳 API
- `src/app/api/admin/reviews/route.ts` — 審核清單 API
- `src/app/api/admin/reviews/[id]/route.ts` — 審核操作 API
- `src/app/dashboard/admin/reviews/page.tsx` — Admin 審核頁面
- `src/components/auth/RegisterWizard.tsx` — 註冊精靈主元件
- `src/components/auth/RegisterStep1.tsx` — Step 1: 身份選擇
- `src/components/auth/RegisterStep2.tsx` — Step 2: 基本資料
- `src/components/auth/RegisterStep3.tsx` — Step 3: 車輛資料（司機）
- `src/components/auth/RegisterStep4.tsx` — Step 4: 文件上傳
- `src/components/auth/RegisterStep5.tsx` — Step 5: 密碼設定 + 同意書
- `src/components/auth/ProgressBar.tsx` — 進度條元件
- `src/components/auth/LoginTabs.tsx` — 雙Tab登入元件
- `src/components/auth/DriverLoginForm.tsx` — 司機登入表單（車牌+密碼）
- `src/components/auth/DispatcherLoginForm.tsx` — 派單方登入表單（Email+密碼）
- `src/components/auth/ForgotPasswordForm.tsx` — 忘記密碼表單
- `src/components/auth/EmailVerifiedPage.tsx` — Email 驗證成功頁
- `src/lib/email.ts` — Email 寄送工具函式

### 修改
- `prisma/schema.prisma` — 新增 enum + 欄位 + UserDocument model
- `src/types/index.ts` — 新增 types
- `src/lib/auth.ts` — 新增 `loginByPlate`、`sendVerifyEmail`、`verifyEmail`、`forgotPassword`、`resetPassword`
- `src/app/register/page.tsx` — 替換為 `<RegisterWizard />`
- `src/app/login/page.tsx` — 替換為 `<LoginTabs />`
- `src/app/api/auth/login/route.ts` — 支援 role 參數
- `src/app/api/auth/[[...nextauth]]/route.ts` — POST 支援 accountStatus 預設值
- `src/lib/auth-context.tsx` — 新增 accountStatus 狀態，login 後 fetch 完整 user
- `src/app/api/auth/verify-email/route.ts` — 建立驗證 API（GET，接收 query token）
- `src/app/api/auth/forgot-password/route.ts` — 建立（POST，發送重設連結）
- `src/app/api/auth/reset-password/route.ts` — 建立（POST，驗證 token + 重設密碼）
- `src/app/api/admin/reviews/route.ts` — 建立（GET，待審核清單）
- `src/app/api/admin/reviews/[id]/route.ts` — 建立（POST，通過/拒絕）

---

## 實作順序

### 階段一：資料庫 + Auth 核心

#### Task 1: Prisma Schema 更新

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: 在 schema.prisma 的 `model User` 之後，新增 `enum AccountStatus`**

```prisma
enum AccountStatus {
  PENDING_VERIFICATION  // 待 Email 驗證
  PENDING_REVIEW        // 已驗證，待文件審核
  ACTIVE                // 已開通
  REJECTED              // 審核不通過
}
```

- [ ] **Step 2: 在 `model User` 內新增4個欄位**

```prisma
model User {
  // ... existing fields (keep all):
  emailVerified    Boolean          @default(false)
  emailVerifyToken String?
  accountStatus   AccountStatus    @default(PENDING_VERIFICATION)
  rejectReason    String?
  // ... existing relations
}
```

- [ ] **Step 3: 在 `model Driver` 內新增 `carBrand` 和 `carModel` 欄位**

```prisma
model Driver {
  // ... existing fields
  carBrand  String?  // 車廠/品牌（如：TOYOTA）
  carModel  String?  // 車型/型號（如：CAMRY）
  // ... existing relations
}
```

- [ ] **Step 4: 在 `model Dispatcher` 內新增 `taxId` 和 `contactPhone` 欄位**

```prisma
model Dispatcher {
  // ... existing fields
  taxId        String?  // 統一編號
  contactPhone String?  // 聯絡電話（獨立於 User.phone）
  // ... existing relations
}
```

- [ ] **Step 5: 在 `model Transaction` 之後、新增 `model UserDocument`**

```prisma
model UserDocument {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  type      String   // DRIVER_LICENSE / VEHICLE_REGISTRATION / INSURANCE / ID_CARD / BUSINESS_REGISTRATION
  fileUrl   String   // 雲端儲存 URL
  fileName  String   // 原始檔案名稱
  mimeType  String   // image/jpeg / image/png / application/pdf
  sizeBytes Int      // 檔案大小（位元組）
  status    String   @default("PENDING")  // PENDING / APPROVED / REJECTED
  createdAt DateTime @default(now())

  @@index([userId])
  @@map("user_documents")
}
```

- [ ] **Step 6: 在 `model Driver` 的 `@@map("drivers")` 後方、整個檔案的 `}` 結束前，加入 `@@index`**

```prisma
  @@index([userId])
  @@map("user_documents")
}
```

- [ ] **Step 7: Generate Prisma client**

Run: `npx prisma generate`
Expected: 成功生成 Client，無錯誤

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: schema 更新 — AccountStatus、UserDocument、司機車廠型號、派單方統編"
```

---

#### Task 2: Types 更新

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: 新增 types**

在 `UserRole` type 之後新增：
```typescript
export type AccountStatus = 'PENDING_VERIFICATION' | 'PENDING_REVIEW' | 'ACTIVE' | 'REJECTED'
```

在 `User` interface 之後新增：
```typescript
export interface UserDocument {
  id: string
  userId: string
  type: 'DRIVER_LICENSE' | 'VEHICLE_REGISTRATION' | 'INSURANCE' | 'ID_CARD' | 'BUSINESS_REGISTRATION'
  fileUrl: string
  fileName: string
  mimeType: string
  sizeBytes: number
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  createdAt: Date | string
}
```

在 `Driver` interface 之後新增：
```typescript
export type VehicleSizeType = 'small_sedan' | 'small_suv' | 'van7' | 'van9'
```

在 `LoginRequest` interface 之後新增：
```typescript
export interface LoginRequest {
  // 支援兩種登入方式（由 role 區分）
  account: string   // 司機填車牌，派單方填 Email
  password: string
  role: 'DRIVER' | 'DISPATCHER'
}

export interface ForgotPasswordRequest {
  account: string   // 車牌（司機）或 Email（派單方）
  role: 'DRIVER' | 'DISPATCHER'
  email?: string    // 司機需要同時提供 Email 驗證
}

export interface ResetPasswordRequest {
  token: string
  newPassword: string
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: 新增 AccountStatus、UserDocument、LoginRequest types"
```

---

#### Task 3: Auth 核心函式更新

**Files:**
- Modify: `src/lib/auth.ts`

- [ ] **Step 1: 新增 `loginByPlate` 函式**

在 `login` 函式之後新增：
```typescript
export async function loginByPlate(licensePlate: string, password: string): Promise<AuthResult> {
  try {
    const user = await prisma.user.findFirst({
      where: {
        role: 'DRIVER',
        driver: { licensePlate },
      },
      include: { driver: true, dispatcher: true },
    })
    if (!user) return { success: false, error: '車牌號碼不存在' }
    const isValid = await verifyPassword(password, user.password)
    if (!isValid) return { success: false, error: '密碼錯誤' }
    const token = generateToken({ userId: user.id, role: user.role })
    return {
      success: true,
      token,
      user: {
        id: user.id, email: user.email, name: user.name, role: user.role,
        isPremium: user.driver?.isPremium ?? false,
      },
    }
  } catch (error) {
    console.error('LoginByPlate error:', error)
    return { success: false, error: '登入失敗' }
  }
}
```

- [ ] **Step 2: 新增 `sendVerifyEmail` 函式**

在 `getUserFromToken` 函式之前新增：
```typescript
export async function sendVerifyEmail(userId: string, email: string): Promise<void> {
  const token = generateToken({ userId, role: 'VERIFY' }, '1d')
  const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/verify-email?token=${token}`
  // Email sending handled by email.ts utility
  await prisma.user.update({
    where: { id: userId },
    data: { emailVerifyToken: token },
  })
  // TODO: call email.ts sendVerifyEmail(email, token)
  console.log(`[EMAIL] Verify link for ${email}: ${verifyUrl}`)
}
```

修改 `JwtPayload` interface，新增：
```typescript
export interface JwtPayload {
  userId: string
  role: string
  exp?: number
}
```

修改 `generateToken`：
```typescript
export function generateToken(payload: JwtPayload, expiresIn: string = '7d'): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn })
}
```

- [ ] **Step 3: 新增 `verifyEmail` 函式**

```typescript
export async function verifyEmail(token: string): Promise<{ success: boolean; error?: string }> {
  try {
    const payload = verifyToken(token) as (JwtPayload & { role: string }) | null
    if (!payload) return { success: false, error: '驗證連結已過期或無效' }
    if (payload.role !== 'VERIFY') return { success: false, error: '無效的驗證連結' }
    const user = await prisma.user.findUnique({ where: { id: payload.userId } })
    if (!user) return { success: false, error: '找不到使用者' }
    await prisma.user.update({
      where: { id: payload.userId },
      data: { emailVerified: true, emailVerifyToken: null, accountStatus: 'PENDING_REVIEW' },
    })
    return { success: true }
  } catch (error) {
    console.error('verifyEmail error:', error)
    return { success: false, error: '驗證失敗' }
  }
}
```

- [ ] **Step 4: 新增 `forgotPassword` 和 `resetPassword` 函式**

```typescript
export async function forgotPassword(
  account: string, role: 'DRIVER' | 'DISPATCHER', email?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (role === 'DRIVER') {
      if (!email) return { success: false, error: '請提供註冊時的 Email' }
      const user = await prisma.user.findFirst({
        where: { role: 'DRIVER', email, driver: { licensePlate: account } },
      })
      if (!user) return { success: false, error: '車牌與 Email 不匹配' }
      const token = generateToken({ userId: user.id, role: 'RESET' }, '1h')
      const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`
      console.log(`[EMAIL] Reset link for ${email}: ${resetUrl}`)
      return { success: true }
    } else {
      const user = await prisma.user.findUnique({ where: { email: account, role: 'DISPATCHER' } })
      if (!user) return { success: false, error: '此 Email 未註冊' }
      const token = generateToken({ userId: user.id, role: 'RESET' }, '1h')
      const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`
      console.log(`[EMAIL] Reset link for ${email}: ${resetUrl}`)
      return { success: true }
    }
  } catch (error) {
    console.error('forgotPassword error:', error)
    return { success: false, error: '處理失敗' }
  }
}

export async function resetPassword(token: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  try {
    const payload = verifyToken(token) as (JwtPayload & { role: string }) | null
    if (!payload) return { success: false, error: '重設連結已過期或無效' }
    if (payload.role !== 'RESET') return { success: false, error: '無效的重設連結' }
    const hashed = await hashPassword(newPassword)
    await prisma.user.update({ where: { id: payload.userId }, data: { password: hashed } })
    return { success: true }
  } catch (error) {
    console.error('resetPassword error:', error)
    return { success: false, error: '重設失敗' }
  }
}
```

- [ ] **Step 5: 修改 `login` 函式支援新格式**

將 `login(email, password)` 改為支援 `{ account, password, role }` 的新登入格式：
- 如果 `role === 'DRIVER'`，用 `loginByPlate`
- 如果 `role === 'DISPATCHER'`，用原有邏輯（以 email 查詢）

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth.ts
git commit -m "feat: auth.ts — loginByPlate、verifyEmail、forgotPassword、resetPassword"
```

---

#### Task 4: Login API 更新

**Files:**
- Modify: `src/app/api/auth/login/route.ts`

- [ ] **Step 1: 更新 request body type + 路由邏輯**

```typescript
// body: { account: string, password: string, role: 'DRIVER' | 'DISPATCHER' }
import { login, loginByPlate } from '@/lib/auth'

// 如果 role === 'DRIVER'，用 loginByPlate；否則用 login(email)
const result = role === 'DRIVER'
  ? await loginByPlate(account, password)
  : await login(account, password)
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/auth/login/route.ts
git commit -m "feat: login API 支援車牌登入（role=DRIVER）"
```

---

#### Task 5: Email API 端點建立

**Files:**
- Create: `src/app/api/auth/verify-email/route.ts`
- Create: `src/app/api/auth/send-verify-email/route.ts`
- Create: `src/app/api/auth/forgot-password/route.ts`
- Create: `src/app/api/auth/reset-password/route.ts`

- [ ] **Step 1: `src/app/api/auth/verify-email/route.ts` (GET，驗證 token)**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { verifyEmail } from '@/lib/auth'
import { ApiResponse } from '@/types'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  if (!token) {
    return NextResponse.json<ApiResponse>({ success: false, error: '缺少驗證 token' }, { status: 400 })
  }
  const result = await verifyEmail(token)
  if (!result.success) {
    return NextResponse.json<ApiResponse>({ success: false, error: result.error }, { status: 400 })
  }
  // 重導向到驗證成功頁面
  return NextResponse.redirect(new URL('/email-verified', request.url))
}
```

- [ ] **Step 2: `src/app/api/auth/send-verify-email/route.ts` (POST，重發驗證信)**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromToken, sendVerifyEmail } from '@/lib/auth'
import { ApiResponse } from '@/types'
import { checkRateLimit } from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  const rateLimitResult = checkRateLimit(request, { type: 'auth' })
  if (rateLimitResult) return rateLimitResult
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json<ApiResponse>({ success: false, error: '未授權' }, { status: 401 })
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json<ApiResponse>({ success: false, error: '無效的 token' }, { status: 401 })
  if (user.emailVerified) {
    return NextResponse.json<ApiResponse>({ success: false, error: 'Email 已驗證' }, { status: 400 })
  }
  await sendVerifyEmail(user.id, user.email)
  return NextResponse.json<ApiResponse>({ success: true, data: { message: '驗證信已寄出' } })
}
```

- [ ] **Step 3: `src/app/api/auth/forgot-password/route.ts` (POST，發送重設連結)**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { forgotPassword } from '@/lib/auth'
import { ApiResponse, ForgotPasswordRequest } from '@/types'
import { checkRateLimit } from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  const rateLimitResult = checkRateLimit(request, { type: 'auth' })
  if (rateLimitResult) return rateLimitResult
  const body = await request.json() as ForgotPasswordRequest
  if (!body.account || !body.password || !body.role) {
    return NextResponse.json<ApiResponse>({ success: false, error: '缺少必填欄位' }, { status: 400 })
  }
  if (!['DRIVER', 'DISPATCHER'].includes(body.role)) {
    return NextResponse.json<ApiResponse>({ success: false, error: '無效的角色' }, { status: 400 })
  }
  const result = await forgotPassword(body.account, body.role, body.email)
  if (!result.success) {
    return NextResponse.json<ApiResponse>({ success: false, error: result.error }, { status: 400 })
  }
  return NextResponse.json<ApiResponse>({ success: true, data: { message: '重設連結已寄至您的 Email' } })
}
```

- [ ] **Step 4: `src/app/api/auth/reset-password/route.ts` (POST，重設密碼)**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { resetPassword } from '@/lib/auth'
import { ApiResponse, ResetPasswordRequest } from '@/types'

export async function POST(request: NextRequest) {
  const body = await request.json() as ResetPasswordRequest
  if (!body.token || !body.newPassword) {
    return NextResponse.json<ApiResponse>({ success: false, error: '缺少必填欄位' }, { status: 400 })
  }
  if (body.newPassword.length < 6) {
    return NextResponse.json<ApiResponse>({ success: false, error: '密碼至少 6 個字元' }, { status: 400 })
  }
  const result = await resetPassword(body.token, body.newPassword)
  if (!result.success) {
    return NextResponse.json<ApiResponse>({ success: false, error: result.error }, { status: 400 })
  }
  return NextResponse.json<ApiResponse>({ success: true, data: { message: '密碼已重設，請使用新密碼登入' } })
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/auth/verify-email/route.ts src/app/api/auth/send-verify-email/route.ts src/app/api/auth/forgot-password/route.ts src/app/api/auth/reset-password/route.ts
git commit -m "feat: Email 驗證 + 密碼重設 API 端點"
```

---

### 階段二：登入頁 + 註冊精靈 UI

#### Task 6: 雙 Tab 登入頁面

**Files:**
- Modify: `src/app/login/page.tsx`（完整重寫）
- Create: `src/components/auth/LoginTabs.tsx`
- Create: `src/components/auth/DriverLoginForm.tsx`
- Create: `src/components/auth/DispatcherLoginForm.tsx`
- Create: `src/components/auth/ForgotPasswordForm.tsx`

- [ ] **Step 1: `src/components/auth/DriverLoginForm.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'

export function DriverLoginForm() {
  const [licensePlate, setLicensePlate] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()

  const handlePlateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLicensePlate(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!licensePlate || !password) { setError('請填寫車牌和密碼'); return }
    setLoading(true)
    setError('')
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account: licensePlate, password, role: 'DRIVER' }),
    })
    const data = await res.json()
    if (data.success) {
      const userRes = await fetch('/api/auth', { headers: { Authorization: `Bearer ${data.data.token}` } })
      const userData = await userRes.json()
      login(data.data.token, userData.data)
    } else {
      setError(data.error || '登入失敗')
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="bg-[#FCEBEB] border border-[#F5C6C6] text-[#E24B4A] px-4 py-3 rounded-lg text-sm">{error}</div>}
      <div className="space-y-1">
        <label className="text-[11px] text-[#717171]">車牌號碼</label>
        <input type="text" value={licensePlate} onChange={handlePlateChange}
          placeholder="ABC-1234" maxLength={10}
          className="w-full bg-white border border-[#DDDDDD] rounded-lg px-3 py-2.5 text-[#222222] text-sm placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#222222] font-mono-nums uppercase" />
      </div>
      <div className="space-y-1">
        <label className="text-[11px] text-[#717171]">密碼</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
          placeholder="請輸入密碼"
          className="w-full bg-white border border-[#DDDDDD] rounded-lg px-3 py-2.5 text-[#222222] text-sm placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#222222]" />
      </div>
      <button type="submit" disabled={loading}
        className="w-full bg-[#0C447C] hover:bg-[#0a3a6e] text-white font-medium h-11 rounded-lg flex items-center justify-center gap-2 transition-colors text-sm disabled:opacity-50">
        {loading ? '登入中...' : '司機登入'}
      </button>
    </form>
  )
}
```

更新 `auth-context.tsx` 的 login 函式以支援 `(token, user)` 簽名：
在現有 `login(email, password)` 簽名之後，新增多載：
```typescript
// 多載：內部從 login page 呼叫時直接傳入 token 和完整 user
const login = async (emailOrToken: string, passwordOrUser?: string | object) => {
  // 如果第二個參數是物件，代表是 token+user 形式
  if (typeof passwordOrUser === 'object' && passwordOrUser !== null) {
    setToken(emailOrToken)
    setUser(passwordOrUser)
    localStorage.setItem('token', emailOrToken)
    document.cookie = `auth_token=${emailOrToken}; path=/; max-age=${7*24*60*60}; SameSite=Lax`
    router.push((passwordOrUser as any).role === 'DRIVER' ? '/dashboard/driver' : '/dashboard/dispatcher')
    return { success: true }
  }
  // 否則是原有 email+password 形式...
}
```

- [ ] **Step 2: `src/components/auth/DispatcherLoginForm.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'

export function DispatcherLoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) { setError('請填寫 Email 和密碼'); return }
    setLoading(true)
    setError('')
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account: email, password, role: 'DISPATCHER' }),
    })
    const data = await res.json()
    if (data.success) {
      const userRes = await fetch('/api/auth', { headers: { Authorization: `Bearer ${data.data.token}` } })
      const userData = await userRes.json()
      login(data.data.token, userData.data)
    } else {
      setError(data.error || '登入失敗')
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="bg-[#FCEBEB] border border-[#F5C6C6] text-[#E24B4A] px-4 py-3 rounded-lg text-sm">{error}</div>}
      <div className="space-y-1">
        <label className="text-[11px] text-[#717171]">Email</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder="請輸入 Email"
          className="w-full bg-white border border-[#DDDDDD] rounded-lg px-3 py-2.5 text-[#222222] text-sm placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#222222]" />
      </div>
      <div className="space-y-1">
        <label className="text-[11px] text-[#717171]">密碼</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
          placeholder="請輸入密碼"
          className="w-full bg-white border border-[#DDDDDD] rounded-lg px-3 py-2.5 text-[#222222] text-sm placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#222222]" />
      </div>
      <button type="submit" disabled={loading}
        className="w-full bg-[#FF385C] hover:bg-[#D70466] text-white font-medium h-11 rounded-lg flex items-center justify-center gap-2 transition-colors text-sm disabled:opacity-50">
        {loading ? '登入中...' : '派單方登入'}
      </button>
    </form>
  )
}
```

- [ ] **Step 3: `src/components/auth/LoginTabs.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { Plane } from 'lucide-react'
import { DriverLoginForm } from './DriverLoginForm'
import { DispatcherLoginForm } from './DispatcherLoginForm'
import { ForgotPasswordForm } from './ForgotPasswordForm'
import Link from 'next/link'

export function LoginTabs() {
  const [activeTab, setActiveTab] = useState<'driver' | 'dispatcher'>('driver')
  const [showForgot, setShowForgot] = useState(false)

  if (showForgot) return <ForgotPasswordForm onBack={() => setShowForgot(false)} />

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#222222]">
      <nav className="px-8 py-6">
        <Link href="/" className="flex items-center gap-2 w-fit">
          <div className="w-8 h-8 rounded-lg bg-[#FF385C] flex items-center justify-center">
            <Plane className="w-4 h-4 text-white" />
          </div>
          <span className="text-[#222222] font-medium">機場接送派單平台</span>
        </Link>
      </nav>

      <div className="flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <h1 className="text-[22px] font-medium text-[#222222] mb-1">登入</h1>
            <p className="text-[13px] text-[#717171]">選擇您的身份類型登入</p>
          </div>

          {/* Tabs */}
          <div className="flex rounded-xl overflow-hidden border border-[#DDDDDD] mb-4">
            <button
              onClick={() => setActiveTab('driver')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === 'driver'
                  ? 'bg-[#0C447C] text-white'
                  : 'bg-white text-[#717171] hover:bg-[#F7F7F7]'
              }`}
            >
              司機登入
            </button>
            <button
              onClick={() => setActiveTab('dispatcher')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === 'dispatcher'
                  ? 'bg-[#FF385C] text-white'
                  : 'bg-white text-[#717171] hover:bg-[#F7F7F7]'
              }`}
            >
              派單方登入
            </button>
          </div>

          {/* Form */}
          <div className="bg-white border border-[#DDDDDD] rounded-xl p-6">
            {activeTab === 'driver' ? <DriverLoginForm /> : <DispatcherLoginForm />}
          </div>

          {/* Forgot password */}
          <div className="mt-3 text-center">
            <button
              onClick={() => setShowForgot(true)}
              className="text-[13px] text-[#717171] hover:text-[#222222] transition-colors underline"
            >
              忘記密碼？
            </button>
          </div>

          <div className="mt-3 text-center">
            <Link href="/register" className="text-[13px] text-[#717171]">
              還沒有帳戶？{' '}
              <span className="text-[#FF385C] hover:text-[#D70466] transition-colors">立即註冊</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: `src/components/auth/ForgotPasswordForm.tsx`**

```typescript
'use client'
import { useState } from 'react'

export function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const [role, setRole] = useState<'DRIVER' | 'DISPATCHER'>('DRIVER')
  const [account, setAccount] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!account) { setError('請填寫車牌/Email'); return }
    if (role === 'DRIVER' && !email) { setError('請填寫註冊時的 Email'); return }
    setLoading(true)
    setError('')
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account: account.toUpperCase(), role, email }),
    })
    const data = await res.json()
    if (data.success) setSuccess(true)
    else setError(data.error || '發送失敗')
    setLoading(false)
  }

  if (success) return (
    <div className="bg-white border border-[#DDDDDD] rounded-xl p-8 text-center">
      <div className="w-12 h-12 rounded-full bg-[#22C55E]/10 border border-[#22C55E]/20 flex items-center justify-center mx-auto mb-4">
        <span className="text-[#22C55E] text-xl">✓</span>
      </div>
      <p className="text-[#222222] font-medium mb-2">重設連結已寄出</p>
      <p className="text-[#717171] text-sm mb-4">請至您的 Email 收取重設密碼連結</p>
      <button onClick={onBack} className="text-[#FF385C] text-sm hover:underline">返回登入</button>
    </div>
  )

  return (
    <div className="bg-white border border-[#DDDDDD] rounded-xl p-6">
      <button onClick={onBack} className="text-[#717171] text-sm mb-4 hover:text-[#222222]">← 返回</button>
      <h2 className="text-[18px] font-medium text-[#222222] mb-4">忘記密碼</h2>
      <div className="flex gap-2 mb-4">
        <button onClick={() => setRole('DRIVER')}
          className={`flex-1 py-2 text-sm rounded-lg border ${role === 'DRIVER' ? 'border-[#0C447C] bg-[#E6F1FB] text-[#0C447C]' : 'border-[#DDDDDD] text-[#717171]'}`}>司機</button>
        <button onClick={() => setRole('DISPATCHER')}
          className={`flex-1 py-2 text-sm rounded-lg border ${role === 'DISPATCHER' ? 'border-[#FF385C] bg-[#FFF3E0] text-[#FF385C]' : 'border-[#DDDDDD] text-[#717171]'}`}>派單方</button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="bg-[#FCEBEB] border border-[#F5C6C6] text-[#E24B4A] px-4 py-3 rounded-lg text-sm">{error}</div>}
        <div className="space-y-1">
          <label className="text-[11px] text-[#717171]">{role === 'DRIVER' ? '車牌號碼' : 'Email'}</label>
          <input type={role === 'DRIVER' ? 'text' : 'email'} value={account}
            onChange={e => setAccount(e.target.value.toUpperCase())}
            placeholder={role === 'DRIVER' ? 'ABC-1234' : 'example@email.com'}
            className="w-full bg-white border border-[#DDDDDD] rounded-lg px-3 py-2.5 text-[#222222] text-sm placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#222222] font-mono-nums uppercase" />
        </div>
        {role === 'DRIVER' && (
          <div className="space-y-1">
            <label className="text-[11px] text-[#717171]">註冊時的 Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="請輸入 Email"
              className="w-full bg-white border border-[#DDDDDD] rounded-lg px-3 py-2.5 text-[#222222] text-sm placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#222222]" />
          </div>
        )}
        <button type="submit" disabled={loading}
          className="w-full bg-[#FF385C] text-white h-11 rounded-lg text-sm disabled:opacity-50">
          {loading ? '發送中...' : '發送重設連結'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 5: 更新 `src/app/login/page.tsx`**

```typescript
export default function LoginPage() {
  return <LoginTabs />
}
```

- [ ] **Step 6: Commit**

```bash
git add src/app/login/page.tsx src/components/auth/LoginTabs.tsx src/components/auth/DriverLoginForm.tsx src/components/auth/DispatcherLoginForm.tsx src/components/auth/ForgotPasswordForm.tsx src/lib/auth-context.tsx
git commit -m "feat: 登入頁改為雙Tab（司機車牌/派單方Email）+ 忘記密碼"
```

---

#### Task 7: 重設密碼頁面

**Files:**
- Create: `src/app/reset-password/page.tsx`

- [ ] **Step 1: 建立頁面**

```typescript
'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Plane } from 'lucide-react'

export default function ResetPasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  if (!token) return (
    <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
      <div className="text-center">
        <p className="text-[#E24B4A]">無效的重設連結</p>
        <Link href="/login" className="text-[#FF385C] text-sm mt-2 inline-block">返回登入</Link>
      </div>
    </div>
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 6) { setError('密碼至少 6 個字元'); return }
    if (password !== confirm) { setError('兩次密碼不一致'); return }
    setLoading(true)
    setError('')
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword: password }),
    })
    const data = await res.json()
    if (data.success) setDone(true)
    else setError(data.error || '重設失敗')
    setLoading(false)
  }

  if (done) return (
    <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center px-6">
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-[#22C55E]/10 border border-[#22C55E]/20 flex items-center justify-center mx-auto mb-4">
          <span className="text-[#22C55E] text-2xl">✓</span>
        </div>
        <p className="text-[#222222] text-lg font-medium mb-2">密碼已重設</p>
        <p className="text-[#717171] text-sm mb-4">請使用新密碼登入</p>
        <Link href="/login" className="px-6 py-2 bg-[#FF385C] text-white rounded-lg text-sm">前往登入</Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      <nav className="px-8 py-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#FF385C] flex items-center justify-center">
            <Plane className="w-4 h-4 text-white" />
          </div>
          <span className="text-[#222222] font-medium">機場接送派單平台</span>
        </Link>
      </nav>
      <div className="flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-md">
          <div className="bg-white border border-[#DDDDDD] rounded-xl p-6">
            <h1 className="text-[18px] font-medium mb-4">設定新密碼</h1>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <div className="bg-[#FCEBEB] border border-[#F5C6C6] text-[#E24B4A] px-4 py-3 rounded-lg text-sm">{error}</div>}
              <div className="space-y-1">
                <label className="text-[11px] text-[#717171]">新密碼</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="至少 6 個字元"
                  className="w-full bg-white border border-[#DDDDDD] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#222222]" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-[#717171]">確認密碼</label>
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                  placeholder="再次輸入密碼"
                  className="w-full bg-white border border-[#DDDDDD] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#222222]" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-[#FF385C] text-white h-11 rounded-lg text-sm disabled:opacity-50">
                {loading ? '處理中...' : '確認重設'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/reset-password/page.tsx
git commit -m "feat: 重設密碼頁面 /reset-password"
```

---

#### Task 8: 註冊精靈主體 + 5個 Step 元件

**Files:**
- Create: `src/components/auth/ProgressBar.tsx`
- Create: `src/components/auth/RegisterStep1.tsx`
- Create: `src/components/auth/RegisterStep2.tsx`
- Create: `src/components/auth/RegisterStep3.tsx`
- Create: `src/components/auth/RegisterStep4.tsx`
- Create: `src/components/auth/RegisterStep5.tsx`
- Create: `src/components/auth/RegisterWizard.tsx`
- Modify: `src/app/register/page.tsx`

車型下拉選項（對應 Prisma VehicleSizeType）：
```typescript
const VEHICLE_SIZE_OPTIONS = [
  { value: 'small_sedan', label: '5人座（小車/轎車）' },
  { value: 'small_suv', label: '5人座（休旅/SUV）' },
  { value: 'van7', label: '7人座' },
  { value: 'van9', label: '9人座' },
]
```

- [ ] **Step 1: `src/components/auth/ProgressBar.tsx`**

5 步橫向進度條，當前步 highlight，淺色已完成，已完成顯示勾選。

- [ ] **Step 2: `src/components/auth/RegisterStep1.tsx`**

兩個大字卡片：司機（車子 icon）/ 派單方（大樓 icon）。點擊後呼叫 `onSelect('DRIVER')` 或 `onSelect('DISPATCHER')`。

- [ ] **Step 3: `src/components/auth/RegisterStep2.tsx`**

根據 role 顯示對應欄位：
- DRIVER: 姓名、手機（格式驗證）、Email
- DISPATCHER: 公司名稱、聯絡電話、Email、統一編號（8碼數字驗證）

使用即時驗證（onBlur）：必填欄位空值時顯示錯誤提示。

- [ ] **Step 4: `src/components/auth/RegisterStep3.tsx`（僅司機）**

欄位：車牌（自動大寫）、車廠（自動大寫）、車型/型號（自動大寫）、車色（自由）、車型（下拉）。`carType` 存入 Prisma 的 `Driver.carType` 欄位。

- [ ] **Step 5: `src/components/auth/RegisterStep4.tsx`**

上傳區塊：
- DRIVER: 3個上傳框（行照、駕照、保險證），每個 label + 上傳按鈕 + 預覽缩略图
- DISPATCHER: 2個上傳框（負責人身分證、商業登記公文）

實作：每個上傳框使用 `<input type="file" accept="image/*,.pdf">`，選擇檔案後立即上傳到 `/api/uploads`，成功後顯示预览。支援格式：JPG/PNG/PDF，最大 5MB。

上傳時 UI：`/api/uploads` 還沒實作，所以這步先做「選擇檔案」的 UI，上傳部分在 Task 12 處理。

- [ ] **Step 6: `src/components/auth/RegisterStep5.tsx`**

密碼 + 確認密碼（驗證一致性）+ 同意書勾選（核取方塊，連結到 `/terms`）。提交時呼叫 `/api/auth` (POST)。

- [ ] **Step 7: `src/components/auth/RegisterWizard.tsx`**

主容器，管理當前步驟（1-5）、表單狀態（所有步驟的資料）、下一步/上一步導航。

完成後（Step 5 提交成功）：顯示「註冊成功！請至 Email 收取驗證連結」的成功畫面。

- [ ] **Step 8: 更新 `src/app/register/page.tsx`**

```typescript
export default function RegisterPage() {
  return <RegisterWizard />
}
```

- [ ] **Step 9: Commit**

```bash
git add src/components/auth/ProgressBar.tsx src/components/auth/RegisterStep1.tsx src/components/auth/RegisterStep2.tsx src/components/auth/RegisterStep3.tsx src/components/auth/RegisterStep4.tsx src/components/auth/RegisterStep5.tsx src/components/auth/RegisterWizard.tsx src/app/register/page.tsx
git commit -m "feat: 註冊頁重寫為5步驟精靈（身份/基本資料/車輛/文件/密碼）"
```

---

#### Task 9: Email 驗證成功頁

**Files:**
- Create: `src/app/email-verified/page.tsx`

- [ ] **Step 1: 建立頁面**

驗證成功：顯示勾選動畫 + 「Email 驗證成功！」+ 「您的資料已送出，我們將在 1-2 個工作天內完成審核。」+ 「前往登入」按鈕。

- [ ] **Step 2: Commit**

```bash
git add src/app/email-verified/page.tsx
git commit -m "feat: Email 驗證成功頁 /email-verified"
```

---

### 階段三：檔案上傳 API

#### Task 10: 檔案上傳 API

**Files:**
- Create: `src/app/api/uploads/route.ts`

- [ ] **Step 1: 建立上傳端點**

使用 Vercel Blob 或本地 `public/uploads/` 作為過渡實作：
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

export async function POST(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json<ApiResponse>({ success: false, error: '未授權' }, { status: 401 })
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json<ApiResponse>({ success: false, error: '無效的 token' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json<ApiResponse>({ success: false, error: '未選擇檔案' }, { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json<ApiResponse>({ success: false, error: '僅支援 JPG、PNG、PDF' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json<ApiResponse>({ success: false, error: '檔案需小於 5MB' }, { status: 400 })
  }

  // 儲存到 public/uploads/{userId}/
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', user.id)
  await mkdir(uploadDir, { recursive: true })
  const ext = file.name.split('.').pop() || 'bin'
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const filePath = path.join(uploadDir, fileName)
  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(filePath, buffer)
  const fileUrl = `/uploads/${user.id}/${fileName}`

  return NextResponse.json<ApiResponse>({ success: true, data: { fileUrl, fileName } })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/uploads/route.ts
git commit -m "feat: 檔案上傳 API /api/uploads（local storage）"
```

---

### 階段四：Register API 更新（支援新流程）

#### Task 11: 註冊 API 更新

**Files:**
- Modify: `src/app/api/auth/[[...nextauth]]/route.ts`

- [ ] **Step 1: 更新 POST register 邏輯**

更新 Prisma 建立邏輯以支援新欄位：
- Driver: carBrand, carModel（從 extraData 傳入）
- Dispatcher: taxId, contactPhone（從 extraData 傳入）
- User: accountStatus 預設 `PENDING_VERIFICATION`

修改 `/api/auth` (POST) 的 `register` 呼叫：
```typescript
await register(email, password, name, phone, role, {
  licensePlate: licensePlate || '',
  carType: carType || '轎車',
  carColor: carColor || '',
  companyName: companyName || '',
  // 新增欄位
  carBrand: carBrand || '',
  carModel: carModel || '',
  taxId: taxId || '',
  contactPhone: contactPhone || '',
})
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/auth/[[...nextauth]]/route.ts
git commit -m "feat: 註冊 API 支援新欄位（carBrand/carModel/taxId/contactPhone）"
```

---

### 階段五：Admin 審核後台

#### Task 12: Admin 審核 API

**Files:**
- Create: `src/app/api/admin/reviews/route.ts`
- Create: `src/app/api/admin/reviews/[id]/route.ts`

- [ ] **Step 1: GET `/api/admin/reviews`**

取得所有 `accountStatus = 'PENDING_REVIEW'` 的用戶，包含上傳文件：
```typescript
const users = await prisma.user.findMany({
  where: { accountStatus: 'PENDING_REVIEW' },
  include: {
    driver: true,
    dispatcher: true,
    // 透過 userId 查 UserDocument
  },
  orderBy: { createdAt: 'asc' },
})
// UserDocument 单独查询
const docs = await prisma.userDocument.findMany({
  where: { userId: { in: users.map(u => u.id) } },
})
// 组合返回
```

- [ ] **Step 2: POST `/api/admin/reviews/[id]`**

通過：更新 `accountStatus = 'ACTIVE'`，所有文件 `status = 'APPROVED'`
拒絕：更新 `accountStatus = 'REJECTED'`，`rejectReason = body.note`，所有文件 `status = 'REJECTED'`

寄送通知 Email（console.log 模擬）。

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/reviews/route.ts src/app/api/admin/reviews/[id]/route.ts
git commit -m "feat: Admin 審核 API — 取得清單、通過、拒絕"
```

---

#### Task 13: Admin 審核頁面

**Files:**
- Create: `src/app/dashboard/admin/reviews/page.tsx`

- [ ] **Step 1: 建立審核頁面**

分頁顯示：司機 / 派單方 Tab切換。每列顯示：
- 基本資訊（姓名/公司名、帳號/車牌、Email、手機）
- 文件列表（可點擊在新分頁開啟 `/uploads/{userId}/{filename}` 檢視）
- 時間
- 操作按鈕：通過 / 拒絕（附理由輸入框）

審核完成後重新 fetch 清單。

- [ ] **Step 2: Commit**

```bash
git add src/app/dashboard/admin/reviews/page.tsx
git commit -m "feat: Admin 審核頁面 /dashboard/admin/reviews"
```

---

### 階段六：Dashboard 帳號狀態門控

#### Task 14: Dashboard 帳號狀態門控

**Files:**
- Modify: `src/app/dashboard/driver/page.tsx`
- Modify: `src/app/dashboard/dispatcher/page.tsx`
- Modify: `src/lib/auth-context.tsx`

- [ ] **Step 1: 更新 auth-context User type**

```typescript
driver?: {
  id: string
  status: string
  balance: number
  isPremium?: boolean
  accountStatus?: string  // 新增
}
```

- [ ] **Step 2: Driver Dashboard 入口檢查**

在顯示任何功能前，檢查 `user.accountStatus`：
- `PENDING_VERIFICATION`：顯示「請至 Email 收取驗證連結」
- `PENDING_REVIEW`：顯示「資料審核中，預計 1-2 工作天」
- `REJECTED`：顯示「審核未通過」+ rejectReason
- `ACTIVE`：正常顯示所有功能

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/driver/page.tsx src/lib/auth-context.tsx
git commit -m "feat: Dashboard 新增帳號狀態門控（待驗證/待審核/已拒絕）"
```

---

### 最終檢查

- [ ] **Step 1: `npm run build`**

Run: `npm run build 2>&1`
Expected: 無錯誤，所有路由正確生成

- [ ] **Step 2: 推送並更新 CURRENT_WORK.md**

```bash
git push
```

---

## 實作覆蓋對照

| 規格需求 | 對應 Task |
|----------|-----------|
| 車牌登入 | Task 3, 4 |
| 雙 Tab 登入頁 | Task 6 |
| 多步驟註冊精靈 | Task 8 |
| 車型下拉選單 | Task 8 |
| 英文自動大寫 | Task 6, 8 |
| 文件上傳 | Task 4, 10 |
| Email 驗證 | Task 5, 9 |
| 密碼重設 | Task 5, 7 |
| Admin 審核後台 | Task 12, 13 |
| 帳號狀態門控 | Task 14 |
| Prisma Schema | Task 1 |
| Types | Task 2 |
