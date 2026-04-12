# 銀行帳號列為註冊必填 — 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 司機註冊時必須填寫銀行代碼與帳號，做為接單前的必要條件。派單方不需要。

**Architecture:**
- 新增 `RegisterStep4Bank.tsx` 元件（銀行代碼下拉 + 帳號輸入），司機專屬
- `RegisterWizard.tsx` 重構：司機走 6 步，派單方走 4 步（跳過 Bank）
- 舊 `RegisterStep4`（文件上傳）改為 `RegisterStep5`，舊 `RegisterStep5`（密碼）改為 `RegisterStep6`
- 接單 API 加入 bankCode/bankAccount 門控，未填寫者無法接單

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS

---

## Task 1: 建立銀行代碼常數檔

**Files:**
- Create: `src/lib/bank-codes.ts`

- [ ] **Step 1: Create bank codes constant file**

```typescript
// src/lib/bank-codes.ts
// 銀行代碼與名稱對照表（共 23 家）

export const BANK_OPTIONS = [
  { code: '004', name: '臺灣銀行股份有限公司' },
  { code: '005', name: '臺灣土地銀行股份有限公司' },
  { code: '006', name: '合作金庫商業銀行股份有限公司' },
  { code: '007', name: '第一商業銀行股份有限公司' },
  { code: '008', name: '華南商業銀行股份有限公司' },
  { code: '009', name: '彰化商業銀行股份有限公司' },
  { code: '011', name: '上海商業儲蓄銀行股份有限公司' },
  { code: '012', name: '台北富邦商業銀行股份有限公司' },
  { code: '013', name: '國泰世華商業銀行股份有限公司' },
  { code: '015', name: '中國輸出入銀行' },
  { code: '016', name: '高雄銀行股份有限公司' },
  { code: '017', name: '兆豐國際商業銀行股份有限公司' },
  { code: '021', name: '花旗(台灣)商業銀行股份有限公司' },
  { code: '048', name: '王道商業銀行股份有限公司' },
  { code: '050', name: '臺灣中小企業銀行股份有限公司' },
  { code: '052', name: '渣打國際商業銀行股份有限公司' },
  { code: '053', name: '台中商業銀行股份有限公司' },
  { code: '054', name: '京城商業銀行股份有限公司' },
  { code: '081', name: '滙豐(台灣)商業銀行股份有限公司' },
  { code: '101', name: '瑞興商業銀行股份有限公司' },
  { code: '102', name: '華泰商業銀行股份有限公司' },
  { code: '103', name: '臺灣新光商業銀行股份有限公司' },
  { code: '108', name: '陽信商業銀行股份有限公司' },
  { code: '118', name: '板信商業銀行股份有限公司' },
  { code: '147', name: '三信商業銀行股份有限公司' },
  { code: '803', name: '聯邦商業銀行股份有限公司' },
  { code: '805', name: '遠東國際商業銀行股份有限公司' },
  { code: '806', name: '元大商業銀行股份有限公司' },
  { code: '807', name: '永豐商業銀行股份有限公司' },
  { code: '808', name: '玉山商業銀行股份有限公司' },
  { code: '809', name: '凱基商業銀行股份有限公司' },
  { code: '810', name: '星展(台灣)商業銀行股份有限公司' },
  { code: '812', name: '台新國際商業銀行股份有限公司' },
  { code: '816', name: '安泰商業銀行股份有限公司' },
  { code: '822', name: '中國信託商業銀行股份有限公司' },
  { code: '823', name: '將來商業銀行股份有限公司' },
  { code: '824', name: '連線商業銀行股份有限公司' },
  { code: '826', name: '樂天國際商業銀行股份有限公司' },
] as const

export function getBankName(code: string): string {
  return BANK_OPTIONS.find(b => b.code === code)?.name ?? code
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/bank-codes.ts && git commit -m "feat: 新增銀行代碼常數檔（23家銀行）"
```

---

## Task 2: 建立銀行資料 Step 元件

**Files:**
- Create: `src/components/auth/RegisterStep4Bank.tsx`
- Modify: `src/components/auth/RegisterWizard.tsx:35-36`（新增 step4BankData state）

- [ ] **Step 1: Create RegisterStep4Bank.tsx**

```typescript
// src/components/auth/RegisterStep4Bank.tsx
'use client'
import { BANK_OPTIONS } from '@/lib/bank-codes'

export interface Step4BankData {
  bankCode: string
  bankAccount: string
}

interface RegisterStep4BankProps {
  data: Step4BankData
  onChange: (data: Step4BankData) => void
  onNext: () => void
  onBack: () => void
}

export function RegisterStep4Bank({ data, onChange, onNext, onBack }: RegisterStep4BankProps) {
  const canProceed = data.bankCode.trim() && data.bankAccount.trim().length >= 10

  return (
    <div className="space-y-4">
      <h2 className="text-[18px] font-medium text-[#222222] text-center">填寫銀行帳號</h2>
      <p className="text-[13px] text-[#717171] text-center">做為收款用，請填寫真實帳號</p>

      <div className="space-y-3 pt-2">
        <div className="space-y-1">
          <label className="text-[11px] text-[#717171] font-normal">
            銀行代碼<span className="text-[#E24B4A] ml-0.5">*</span>
          </label>
          <select
            value={data.bankCode}
            onChange={e => onChange({ ...data, bankCode: e.target.value })}
            className="w-full bg-white border border-[#DDDDDD] rounded-lg px-3 py-2.5 text-[#222222] text-sm focus:outline-none focus:border-[#222222]"
          >
            <option value="">請選擇銀行</option>
            {BANK_OPTIONS.map(bank => (
              <option key={bank.code} value={bank.code}>
                {bank.code} {bank.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] text-[#717171] font-normal">
            銀行帳號<span className="text-[#E24B4A] ml-0.5">*</span>
          </label>
          <input
            type="text"
            value={data.bankAccount}
            onChange={e => {
              // 純數字，去除前置零
              const raw = e.target.value.replace(/\D/g, '')
              const normalized = raw.replace(/^0+/, '') || ''
              onChange({ ...data, bankAccount: normalized })
            }}
            placeholder="請輸入帳號（至少 10 碼）"
            maxLength={16}
            inputMode="numeric"
            className="w-full bg-white border border-[#DDDDDD] rounded-lg px-3 py-2.5 text-[#222222] text-sm placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#222222] font-mono-nums"
          />
          <span className="text-[10px] text-[#B0B0B0]">請輸入數字，前置零將自動去除</span>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 border border-[#DDDDDD] text-[#717171] hover:bg-[#F7F7F7] h-11 rounded-lg text-sm transition-colors"
        >
          上一步
        </button>
        <button
          onClick={onNext}
          disabled={!canProceed}
          className="flex-1 bg-[#FF385C] hover:bg-[#D70466] text-white font-medium h-11 rounded-lg text-sm transition-colors disabled:opacity-40"
        >
          下一步
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/auth/RegisterStep4Bank.tsx && git commit -m "feat: 新增 RegisterStep4Bank 銀行資料 Step 元件"
```

---

## Task 3: 重構 RegisterWizard — 加入 Bank 步（司機專屬）

**Files:**
- Modify: `src/components/auth/RegisterWizard.tsx`

- [ ] **Step 1: Rewrite RegisterWizard.tsx**

The new RegisterWizard has 6 possible steps (1-6) but with role-based routing:
- DRIVER: 1 → 2 → 3 → 4(bank) → 5(files) → 6(password)
- DISPATCHER: 1 → 2 → 3(files) → 4(password)

Read the current file first, then replace it entirely with:

```typescript
// src/components/auth/RegisterWizard.tsx
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Plane } from 'lucide-react'
import { ProgressBar } from './ProgressBar'
import { RegisterStep1 } from './RegisterStep1'
import { RegisterStep2, type Step2Data } from './RegisterStep2'
import { RegisterStep3, type Step3Data } from './RegisterStep3'
import { RegisterStep4Bank, type Step4BankData } from './RegisterStep4Bank'
import { RegisterStep5, type UploadedFile } from './RegisterStep4' // renamed from RegisterStep4
import { RegisterStep6, type Step5Data } from './RegisterStep5' // renamed from RegisterStep5

export function RegisterWizard() {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1)
  const [role, setRole] = useState<'DRIVER' | 'DISPATCHER' | null>(null)
  const [step2Data, setStep2Data] = useState<Step2Data>({
    name: '',
    phone: '',
    email: '',
    companyName: '',
    taxId: '',
    contactPhone: '',
  })
  const [step3Data, setStep3Data] = useState<Step3Data>({
    licensePlate: '',
    carBrand: '',
    carModel: '',
    carColor: '',
    vehicleSize: '',
  })
  const [step4BankData, setStep4BankData] = useState<Step4BankData>({
    bankCode: '',
    bankAccount: '',
  })
  const [step5Files, setStep5Files] = useState<UploadedFile[]>([])
  const [step6Data, setStep6Data] = useState<Step5Data>({
    password: '',
    confirmPassword: '',
    agreedToTerms: false,
  })
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  // 司機：6步；派單方：4步
  const totalSteps = role === 'DISPATCHER' ? 4 : 6
  const driverLabels = ['身份選擇', '基本資料', '車輛資料', '銀行資料', '文件上傳', '密碼設定']
  const dispatcherLabels = ['身份選擇', '基本資料', '文件上傳', '密碼設定']
  const progressLabels = role === 'DISPATCHER' ? dispatcherLabels : driverLabels

  const handleRoleSelect = (selectedRole: 'DRIVER' | 'DISPATCHER') => {
    setRole(selectedRole)
    setStep5Files([])
    setStep(2)
  }

  const handleStep2Next = () => setStep(3)

  // 司機：Step3 next → 銀行資料（Step4）
  // 派單方：Step2 next → 文件上傳（Step3）
  const handleStep3Next = () => {
    if (role === 'DISPATCHER') {
      setStep(5) // 派單方 Step3 = files (Step5 in rendering)
    } else {
      setStep(4) // 司機 Step3 → 銀行資料
    }
  }

  // 司機：銀行資料 next → 文件上傳（Step5）
  const handleStep4BankNext = () => setStep(5)

  // 文件上傳 next → 密碼設定（Step6）
  const handleStep5Next = () => setStep(6)

  const handleBack = () => {
    if (step === 2) setStep(1)
    else if (step === 3) setStep(2)
    else if (step === 4 && role === 'DRIVER') setStep(3) // 司機 Bank → 車輛
    else if (step === 5) {
      if (role === 'DISPATCHER') setStep(3) // 派單方 files → 基本資料
      else setStep(4) // 司機 files → 銀行資料
    }
    else if (step === 6) setStep(5)
  }

  const handleSubmit = async () => {
    if (!role) return
    setSubmitting(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('email', step2Data.email)
      fd.append('password', step6Data.password)
      fd.append('name', step2Data.name)
      fd.append('phone', step2Data.phone)
      fd.append('role', role)
      if (role === 'DRIVER') {
        fd.append('licensePlate', step3Data.licensePlate)
        fd.append('carType', step3Data.vehicleSize || '轎車')
        fd.append('carColor', step3Data.carColor)
        fd.append('carBrand', step3Data.carBrand)
        fd.append('carModel', step3Data.carModel)
        fd.append('bankCode', step4BankData.bankCode)
        fd.append('bankAccount', step4BankData.bankAccount)
      } else {
        fd.append('companyName', step2Data.companyName || '')
        fd.append('taxId', step2Data.taxId || '')
        fd.append('contactPhone', step2Data.contactPhone || '')
      }
      // Append uploaded files
      for (const { type, file } of step5Files) {
        fd.append(type, file)
      }

      const res = await fetch('/api/auth', {
        method: 'POST',
        body: fd,
      })
      const data = await res.json()
      if (!data.success) {
        setError(data.error || '註冊失敗')
        setSubmitting(false)
        return
      }

      setSuccess(true)
    } catch { setError('網路錯誤') }
    setSubmitting(false)
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] text-[#222222]">
        <nav className="px-6 py-4 bg-[#FAF8F5]">
          <Link href="/" className="flex items-center gap-2 w-fit">
            <div className="w-8 h-8 rounded-lg bg-[#FF385C] flex items-center justify-center">
              <Plane className="w-4 h-4 text-white" />
            </div>
            <span className="text-[#222222] font-medium">機場接送派單平台</span>
          </Link>
        </nav>
        <div className="flex items-center justify-center px-6 py-8">
          <div className="w-full max-w-md">
            <div className="bg-white border border-[#DDDDDD] rounded-xl p-8">
              <div className="flex flex-col items-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-[#E8F5E9] border-2 border-[#4CAF50] flex items-center justify-center">
                  <svg className="w-10 h-10 text-[#4CAF50]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-[20px] font-medium text-[#222222]">註冊成功！</h3>
                <p className="text-[13px] text-[#717171] text-center leading-relaxed">
                  請至 Email 收取驗證連結，<br />完成帳號驗證
                </p>
                <Link href="/login" className="mt-2 w-full text-center bg-[#FF385C] hover:bg-[#D70466] text-white font-medium h-11 rounded-lg text-sm transition-colors">
                  前往登入
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#222222]">
      <nav className="px-6 py-4 bg-[#FAF8F5]">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#FF385C] flex items-center justify-center">
              <Plane className="w-4 h-4 text-white" />
            </div>
            <span className="text-[#222222] font-medium">機場接送派單平台</span>
          </Link>
          <Link href="/login" className="text-[13px] text-[#717171] hover:text-[#222222] transition-colors">
            已有帳戶？
          </Link>
        </div>
      </nav>

      <div className="flex items-center justify-center px-6 py-4">
        <div className="w-full max-w-md">
          <ProgressBar currentStep={step} totalSteps={totalSteps} labels={progressLabels} />

          <div className="bg-white border border-[#DDDDDD] rounded-xl p-6 mt-2">
            {step === 1 && <RegisterStep1 onSelect={handleRoleSelect} />}
            {step === 2 && role && (
              <RegisterStep2
                role={role}
                data={step2Data}
                onChange={setStep2Data}
                onNext={handleStep2Next}
              />
            )}
            {step === 3 && (
              <RegisterStep3
                data={step3Data}
                onChange={setStep3Data}
                onNext={handleStep3Next}
                onBack={handleBack}
              />
            )}
            {step === 4 && role === 'DRIVER' && (
              <RegisterStep4Bank
                data={step4BankData}
                onChange={setStep4BankData}
                onNext={handleStep4BankNext}
                onBack={handleBack}
              />
            )}
            {step === 5 && role && (
              <RegisterStep5
                role={role}
                uploadedFiles={step5Files}
                onChange={setStep5Files}
                onNext={handleStep5Next}
                onBack={handleBack}
              />
            )}
            {step === 6 && (
              <RegisterStep6
                data={step6Data}
                onChange={setStep6Data}
                onSubmit={handleSubmit}
                onBack={handleBack}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
```

NOTE: In the above, `RegisterStep5` is the renamed file (was `RegisterStep4.tsx` for file upload) and `RegisterStep6` is the renamed file (was `RegisterStep5.tsx` for password).

- [ ] **Step 2: Rename RegisterStep4.tsx → RegisterStep5.tsx (file upload)**

On Windows, use PowerShell:

```bash
mv src/components/auth/RegisterStep4.tsx src/components/auth/RegisterStep5.tsx
```

- [ ] **Step 3: Rename RegisterStep5.tsx → RegisterStep6.tsx (password)**

```bash
mv src/components/auth/RegisterStep5.tsx src/components/auth/RegisterStep6.tsx
```

- [ ] **Step 4: Update the component exports and imports in RegisterStep5.tsx**

In `src/components/auth/RegisterStep5.tsx`, rename the function and props:

```typescript
// Change from:
// export interface Step5Data { ... }
// export function RegisterStep5({ ... }: RegisterStep5Props) {

// Change to:
// export interface UploadedFile { ... }  // keep
// export interface Step5Props { ... }    // rename from RegisterStep5Props
// export function RegisterStep5({ ... }: Step5Props) {  // keep function name
```

The `RegisterStep4.tsx` content exports `{ UploadedFile }` as interface. In the renamed `RegisterStep5.tsx`:
```typescript
// File: src/components/auth/RegisterStep5.tsx (renamed from RegisterStep4.tsx)
// Change export names to match import expectations:
export interface UploadedFile { type: string; file: File }  // already correct

interface RegisterStep5Props {  // rename from RegisterStep4Props
  role: 'DRIVER' | 'DISPATCHER'
  uploadedFiles: UploadedFile[]
  onChange: (files: UploadedFile[]) => void
  onNext: () => void
  onBack: () => void
}

export function RegisterStep5({ role, uploadedFiles, onChange, onNext, onBack }: RegisterStep5Props) {
  // ... existing code, no other changes needed
}
```

- [ ] **Step 5: Update RegisterStep6.tsx (was RegisterStep5.tsx)**

In `src/components/auth/RegisterStep6.tsx`, rename the props interface:

```typescript
// Change from:
interface RegisterStep5Props { ... }
export function RegisterStep5({ data, onChange, onSubmit, onBack }: RegisterStep5Props) {

// To:
interface RegisterStep6Props {
  data: { password: string; confirmPassword: string; agreedToTerms: boolean }
  onChange: (data: { password: string; confirmPassword: string; agreedToTerms: boolean }) => void
  onSubmit: () => Promise<void>
  onBack: () => void
}
export function RegisterStep6({ data, onChange, onSubmit, onBack }: RegisterStep6Props) {
```

- [ ] **Step 6: Run build to verify**

```bash
npm run build 2>&1 | tail -30
```

Expected: Compiles without errors. If TypeScript errors occur, fix them before proceeding.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: 註冊精靈加入銀行資料步驟（司機專屬Step 4）

- 新增 RegisterStep4Bank.tsx（銀行代碼下拉 + 帳號輸入，23家銀行）
- RegisterStep4.tsx → RegisterStep5.tsx（文件上傳重命名）
- RegisterStep5.tsx → RegisterStep6.tsx（密碼設定重命名）
- RegisterWizard 重構：司機6步，派單方4步
- ProgressBar 支援動態總格數與標籤
- 新增 bank-codes.ts 常數檔
- 派單方跳過銀行資料步驟"
```

---

## Task 4: 更新註冊 API — 接受並寫入銀行欄位

**Files:**
- Modify: `src/app/api/auth/[[...nextauth]]/route.ts`

- [ ] **Step 1: Update registration to require and store bankCode/bankAccount for DRIVER**

Read the file first. Find the `register()` call section (around line 73). The current code passes `licensePlate`, `carType`, etc. to register. Add `bankCode` and `bankAccount`:

In the `FormData` block where we construct registration data for DRIVER, add:
```typescript
fd.append('bankCode', step4BankData.bankCode)
fd.append('bankAccount', step4BankData.bankAccount)
```

In the `register()` function in `src/lib/auth.ts`, update the driver creation to include bankCode and bankAccount. Read `src/lib/auth.ts` first, find the driver creation section (the `prisma.driver.create` call), and add:
```typescript
bankCode: body.bankCode || null,
bankAccount: body.bankAccount || null,
```

Also update the type signature of the register function to accept bankCode/bankAccount in the `DriverMeta` type.

- [ ] **Step 2: Commit**

```bash
git add src/app/api/auth/route.ts src/lib/auth.ts && git commit -m "feat: 註冊API接受bankCode/bankAccount並寫入Driver資料表"
```

---

## Task 5: 更新接單 API — 加入銀行欄位門控

**Files:**
- Modify: `src/app/api/orders/[id]/accept/route.ts`

- [ ] **Step 1: Read the accept route, find the accountStatus check**

Read `src/app/api/orders/[id]/accept/route.ts`. After the `accountStatus !== 'ACTIVE'` check (around line where it returns 400), add:

```typescript
// 檢查銀行帳號欄位（帳號啟用後的必要條件）
if (!user.driver?.bankCode || !user.driver?.bankAccount) {
  return NextResponse.json<ApiResponse>(
    { success: false, error: '請先至個人中心填寫銀行帳號，以開始接單' },
    { status: 400 }
  )
}
```

This should be added right after:
```typescript
if (user.accountStatus !== 'ACTIVE') {
  return NextResponse.json<ApiResponse>(
    { success: false, error: '帳號尚未通過審核，請聯繫客服' },
    { status: 403 }
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/orders/[id]/accept/route.ts && git commit -m "feat: 接單API加入銀行欄位門控（bankCode/bankAccount未填寫則無法接單）"
```

---

## Task 6: 司機 Dashboard 未填寫銀行帳號提醒橫幅

**Files:**
- Modify: `src/app/dashboard/driver/page.tsx`

- [ ] **Step 1: Read driver page, find where status banners are rendered**

Read `src/app/dashboard/driver/page.tsx`. Find the section where `showStatusBanner` is defined (around line 535) and the banner UI (around line 535-540). Add a new banner condition:

After the existing banner conditions (PENDING_VERIFICATION / PENDING_REVIEW / REJECTED / ACTIVE with missing fields), add:

```typescript
// 銀行帳號未填寫橫幅（帳號已啟用但缺少銀行資料）
const showBankBanner = user.accountStatus === 'ACTIVE' &&
  (!user.driver?.bankCode || !user.driver?.bankAccount)
```

In the banner rendering section (after the `showStatusBanner` block), add:

```typescript
{showBankBanner && (
  <div className="bg-[#FFF3E0] border border-[#FFE0B2] rounded-xl px-5 py-3">
    <p className="text-[#B45309] text-sm font-medium">
      請填寫銀行帳號以開始接單
    </p>
    <button
      onClick={() => setActiveTab('profile')}
      className="mt-1 text-[#FF385C] text-xs hover:text-[#D70466] font-medium"
    >
      點此填寫 →
    </button>
  </div>
)}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/dashboard/driver/page.tsx && git commit -m "feat: 司機Dashboard加入銀行帳號未填寫提醒橫幅"
```

---

## Task 7: 最終 Build 驗證

- [ ] **Step 1: Run full build**

```bash
npm run build 2>&1 | tail -30
```

- [ ] **Step 2: Verify all pages compile**

Expected output should show all routes including:
- `/login`
- `/register`
- `/dashboard/driver`
- `/dashboard/dispatcher`
- `/dashboard/admin`

If there are errors, fix and re-run until clean.

---

## Task 8: 更新 CURRENT_WORK.md 並 push

- [ ] **Step 1: Update CURRENT_WORK.md**

Update the CURRENT_WORK.md to reflect the new feature:
- Add new section under "目前開發階段"
- Update repair history table

- [ ] **Step 2: Commit and push**

```bash
git add CURRENT_WORK.md && git commit -m "docs: 更新 CURRENT_WORK.md — 銀行帳號必填功能完成" && git push
```

---

## Spec Coverage Check

| 規格需求 | 實作位置 |
|----------|----------|
| 新增 Step 4（銀行資料），司機專屬 | Task 2, Task 3 |
| 23家銀行下拉選單 | Task 1, Task 2 |
| 銀行帳號最少10碼，純數字去除前置零 | Task 2 |
| 司機6步 / 派單方4步 | Task 3 |
| ProgressBar 動態格數 | Task 3 |
| 註冊API寫入bankCode/bankAccount | Task 4 |
| 接單門控：ACTIVE + 銀行欄位 | Task 5 |
| Dashboard提醒橫幅 | Task 6 |

**No gaps found.**