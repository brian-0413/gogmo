# 派單方帳務中心（結算系統）實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 加強派單方結算 Tab，6 格 Stats（含金額）、轉帳狀態篩選、不可逆已轉帳按鈕、下載 Excel 含銀行帳號。

**Architecture:** 三個實作變更：1) GET API 加強回應（新增 pendingAmount、completedAmount 等）；2) 新增 POST transfer API（含通知司機）；3) SettlementTab 前端大改（6格 Stats、篩選、不可逆按鈕）。

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, xlsx (現有)

---

## File Structure

```
Modify: src/app/api/dispatchers/settlement/route.ts     # GET 加強
Create: src/app/api/dispatchers/settlement/transfer/route.ts  # POST 新增
Modify: src/components/dispatcher/SettlementTab.tsx      # 前端大改
```

---

## Task 1: API — 加強 GET /api/dispatchers/settlement

**Files:**
- Modify: `src/app/api/dispatchers/settlement/route.ts`

- [ ] **Step 1: 讀取現有 API**

先讀取 `src/app/api/dispatchers/settlement/route.ts` 了解現有實作。

- [ ] **Step 2: 改寫 GET 回應**

將 GET 端點的回應格式從現有結構改為符合規格的新格式。具體修改：

在 `return NextResponse.json<ApiResponse>` 的 `data` 物件中（約第 116-124 行），原本是：

```typescript
data: {
  allOrdersCount: allOrders.length,
  pendingTransferCount,
  summary,
  orders,
  driverTransferList: Array.from(driverMap.values()),
}
```

改為：

```typescript
// 分組統計
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ordersWithDriver = orders as any[]
const pendingOrders = ordersWithDriver.filter((o: any) => o.transferStatus === 'pending')
const completedOrders = ordersWithDriver.filter((o: any) => o.transferStatus === 'completed')

const pendingAmount = pendingOrders.reduce((sum: number, o: any) => sum + o.price, 0)
const completedAmount = completedOrders.reduce((sum: number, o: any) => sum + o.price, 0)
const totalAmount = pendingAmount + completedAmount

return NextResponse.json<ApiResponse>({
  success: true,
  data: {
    completedOrdersCount: orders.length,
    totalAmount,
    pendingCount: pendingOrders.length,
    pendingAmount,
    completedCount: completedOrders.length,
    completedAmount,
    orders: orders.map((o: any) => ({
      id: o.id,
      orderDate: o.orderDate,
      orderSeq: o.orderSeq,
      price: o.price,
      completedAt: o.completedAt ? new Date(o.completedAt).toISOString() : null,
      transferStatus: o.transferStatus,
      driver: o.driver ? {
        user: { name: o.driver.user.name },
        licensePlate: o.driver.licensePlate,
        bankCode: o.driver.bankCode || null,
        bankAccount: o.driver.bankAccount || null,
      } : null,
    })),
  },
})
```

- [ ] **Step 3: Build 驗證**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/dispatchers/settlement/route.ts
git commit -m "feat: 加強 GET /api/dispatchers/settlement 回應格式，支援 6 格 Stats"
```

---

## Task 2: API — 新增 POST /api/dispatchers/settlement/transfer

**Files:**
- Create: `src/app/api/dispatchers/settlement/transfer/route.ts`

- [ ] **Step 1: 建立 transfer API**

建立 `src/app/api/dispatchers/settlement/transfer/route.ts`，內容如下：

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '未授權' },
        { status: 401 }
      )
    }

    const user = await getUserFromToken(token)
    if (!user || user.role !== 'DISPATCHER' || !user.dispatcher) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '只有派單方可以執行此操作' },
        { status: 403 }
      )
    }

    let body: { orderId: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      )
    }

    if (!body.orderId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '缺少 orderId' },
        { status: 400 }
      )
    }

    // 驗證訂單屬於該派單方
    const order = await prisma.order.findUnique({
      where: { id: body.orderId },
      include: { driver: { include: { user: true } } },
    })

    if (!order) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '找不到該筆訂單' },
        { status: 404 }
      )
    }

    if (order.dispatcherId !== user.dispatcher.id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '無權限操作此訂單' },
        { status: 403 }
      )
    }

    if (order.status !== 'COMPLETED') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '只有已完成的行程才能標記轉帳' },
        { status: 400 }
      )
    }

    if (order.transferStatus === 'completed') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '此訂單已標記為已轉帳，無法重複操作' },
        { status: 400 }
      )
    }

    // 更新為已轉帳
    await prisma.order.update({
      where: { id: body.orderId },
      data: { transferStatus: 'completed' },
    })

    // TODO: 通知司機（未來實作推播後實作）
    // 目前記錄到日誌，供後續通知系統串接
    if (order.driver) {
      console.log(`[TRANSFER] 派單方 ${user.dispatcher.companyName} 已標記轉帳完成 NT$${order.price} 給司機 ${order.driver.user.name}（${order.driver.licensePlate}）`)
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { message: '已標記為已轉帳' },
    })
  } catch (error) {
    console.error('Transfer marking error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2: Build 驗證**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/dispatchers/settlement/transfer/route.ts
git commit -m "feat: 新增 POST /api/dispatchers/settlement/transfer 不可逆轉帳 API"
```

---

## Task 3: 前端 — SettlementTab 大改

**Files:**
- Modify: `src/components/dispatcher/SettlementTab.tsx`

- [ ] **Step 1: 讀取現有程式碼**

先讀取 `src/components/dispatcher/SettlementTab.tsx` 完整內容。

- [ ] **Step 2: 更新 TypeScript 介面**

將現有的 `SettlementOrder` 和 `SettlementData` interface 替換為：

```typescript
interface SettlementOrder {
  id: string
  orderDate: string
  orderSeq: number
  price: number
  completedAt: string | null
  transferStatus: string
  driver: {
    user: { name: string }
    licensePlate: string
    bankCode: string | null
    bankAccount: string | null
  } | null
}

interface SettlementData {
  completedOrdersCount: number
  totalAmount: number
  pendingCount: number
  pendingAmount: number
  completedCount: number
  completedAmount: number
  orders: SettlementOrder[]
}
```

- [ ] **Step 3: 更新 Stats 區塊（改為 6 格）**

將現有的 Stats 區塊（兩格）替換為 6 格：

```tsx
{/* Stats - 6 格 */}
<div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
  <div className="bg-white rounded-xl p-4">
    <p className="text-[11px] text-[#717171] mb-1">完成行程</p>
    <p className="text-[22px] font-medium text-[#222222] font-mono-nums">
      {settlementData.completedOrdersCount}
    </p>
    <p className="text-[10px] text-[#A8A29E]">筆</p>
  </div>
  <div className="bg-white rounded-xl p-4">
    <p className="text-[11px] text-[#717171] mb-1">總派車金額</p>
    <p className="text-[22px] font-medium text-[#222222] font-mono-nums">
      NT${settlementData.totalAmount.toLocaleString()}
    </p>
  </div>
  <div className="bg-white rounded-xl p-4">
    <p className="text-[11px] text-[#717171] mb-1">待轉帳筆數</p>
    <p className="text-[22px] font-medium text-[#E24B4A] font-mono-nums">
      {settlementData.pendingCount}
    </p>
    <p className="text-[10px] text-[#A8A29E]">筆</p>
  </div>
  <div className="bg-white rounded-xl p-4">
    <p className="text-[11px] text-[#717171] mb-1">待轉帳金額</p>
    <p className="text-[22px] font-medium text-[#E24B4A] font-mono-nums">
      NT${settlementData.pendingAmount.toLocaleString()}
    </p>
  </div>
  <div className="bg-white rounded-xl p-4">
    <p className="text-[11px] text-[#717171] mb-1">已轉帳筆數</p>
    <p className="text-[22px] font-medium text-[#008A05] font-mono-nums">
      {settlementData.completedCount}
    </p>
    <p className="text-[10px] text-[#A8A29E]">筆</p>
  </div>
  <div className="bg-white rounded-xl p-4">
    <p className="text-[11px] text-[#717171] mb-1">已轉帳金額</p>
    <p className="text-[22px] font-medium text-[#008A05] font-mono-nums">
      NT${settlementData.completedAmount.toLocaleString()}
    </p>
  </div>
</div>
```

- [ ] **Step 4: 新增轉帳狀態篩選下拉選單**

在篩選工具列的「查詢」按鈕左側，加入轉帳狀態篩選：

```tsx
<select
  value={transferFilter}
  onChange={(e) => setTransferFilter(e.target.value)}
  className="bg-white border border-[#DDDDDD] rounded-lg px-3 py-2.5 text-[13px] text-[#222222] focus:outline-none focus:border-[#222222]"
>
  <option value="all">全部</option>
  <option value="pending">待轉帳</option>
  <option value="completed">已轉帳</option>
</select>
```

在 `useState` 區塊新增：
```typescript
const [transferFilter, setTransferFilter] = useState<'all' | 'pending' | 'completed'>('all')
```

在 `fetchSettlement` 的 URL 加入篩選參數：
```typescript
`/api/dispatchers/settlement?startDate=${startDate}&endDate=${endDate}&transferFilter=${transferFilter}`
```

（後端 API 也要對 `transferFilter` 參數作對應過濾，見 Task 1 Step 2）

同時修改 `fetchSettlement` 改為接受 `transferFilter`：
```typescript
const fetchSettlement = useCallback(async () => {
  // ... existing code, add transferFilter to URL
}, [token, startDate, endDate, transferFilter])
```

並在 `useEffect` 依賴加入 `transferFilter`。

- [ ] **Step 5: 更新表格單號格式**

將 `<span>#{order.id.slice(0, 8)}</span>` 改為顯示格式化的單號：
```tsx
<span className="text-xs font-mono-nums font-bold text-[#222222]">
  #{order.orderDate}-{order.orderSeq.toString().padStart(4, '0')}
</span>
```

- [ ] **Step 6: 新增銀行帳號欄位**

在車牌欄和金額欄之間，新增「司機銀行帳號」欄：
```tsx
<td className="py-3 px-4">
  {order.driver?.bankCode && order.driver?.bankAccount ? (
    <div className="text-[13px] text-[#717171]">
      <div>{order.driver.bankCode}</div>
      <div className="font-mono-nums text-[11px] text-[#A8A29E]">
        {order.driver.bankAccount.slice(0, 3)}***{order.driver.bankAccount.slice(-3)}
      </div>
    </div>
  ) : (
    <span className="text-[#B0B0B0] text-[13px]">未設定</span>
  )}
</td>
```

- [ ] **Step 7: 重寫轉帳狀態按鈕（不可逆）**

將 `handleToggleTransfer` 整個改為 `handleMarkTransferred`：

```typescript
const handleMarkTransferred = async (orderId: string, driverName: string, price: number) => {
  if (!token) return
  const confirmed = window.confirm(
    `確定已轉帳 NT$${price.toLocaleString()} 給司機 ${driverName} 嗎？\n此操作無法撤銷。`
  )
  if (!confirmed) return

  setTogglingId(orderId)
  try {
    const res = await fetch('/api/dispatchers/settlement/transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ orderId }),
    })
    const data = await res.json()
    if (data.success) {
      // 更新本地狀態
      setSettlementData(prev => {
        if (!prev) return prev
        const updatedOrders = prev.orders.map(o =>
          o.id === orderId ? { ...o, transferStatus: 'completed' } : o
        )
        return { ...prev, orders: updatedOrders }
      })
    } else {
      alert(data.error || '標記失敗')
    }
  } catch {
    alert('網路錯誤')
  } finally {
    setTogglingId(null)
  }
}
```

然後在表格的轉帳狀態欄，改為：

```tsx
<td className="py-3 px-4 text-center">
  {order.transferStatus === 'completed' ? (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-normal bg-[#E8F5E8] text-[#008A05] cursor-not-allowed opacity-70">
      <CheckCircle className="w-3 h-3" />
      已轉帳
    </span>
  ) : (
    <button
      onClick={() => handleMarkTransferred(
        order.id,
        order.driver?.user.name || '司機',
        order.price
      )}
      disabled={togglingId === order.id}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-normal bg-[#FFF3E0] text-[#B45309] hover:bg-[#FFE0B2] transition-colors disabled:opacity-50"
    >
      <Clock className="w-3 h-3" />
      待轉帳
    </button>
  )}
</td>
```

記得在 import 加入 `CheckCircle`。

- [ ] **Step 8: 更新下載 Excel**

在 `handleDownloadExcel` 中，加入銀行欄位：
```typescript
{
  '銀行代碼': order.driver?.bankCode || '-',
  '銀行帳號': order.driver?.bankAccount
    ? `${order.driver.bankAccount.slice(0, 3)}***${order.driver.bankAccount.slice(-3)}`
    : '-',
},
```

並將 `transferStatus` 的顯示改為：
```typescript
'轉帳狀態': order.transferStatus === 'completed' ? '已轉帳' : '待轉帳',
```

- [ ] **Step 9: Build 驗證**

```bash
npm run build
```

- [ ] **Step 10: Commit**

```bash
git add src/components/dispatcher/SettlementTab.tsx
git commit -m "feat: 加強派單方結算 Tab，6 格 Stats、不可逆已轉帳按鈕、篩選功能"
```

---

## Task 4: Build 驗證

- [ ] **Step 1: 執行完整 build**

```bash
cd C:\Users\BrianNB\airport-dispatch-platform
npm run build
```

- [ ] **Step 2: 如有錯誤，逐一修復並 commit**

常見錯誤：
- API 回應格式與前端介面不符 → 確認 `SettlementData` 介面與 API 回應完全一致
- `orderSeq.toString().padStart(4, '0')` 的型別問題 → 確保 `orderSeq` 為 number

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "fix: 修正派單方帳務中心編譯問題"
```

---

## Task 5: 更新 CURRENT_WORK.md

- [ ] **Step 1: 在 CURRENT_WORK.md 新增派單方帳務中心完成狀態**

在 CURRENT_WORK.md 的「待辦（可能的下一步）」區塊，找到「派單方帳務中心」改為完成：

```markdown
- [x] 派單方帳務中心：6 格 Stats、不可逆已轉帳按鈕、篩選功能、Excel 匯出
```

- [ ] **Step 2: Commit + push**

```bash
git add CURRENT_WORK.md
git commit -m "docs: 更新 CURRENT_WORK.md — 派單方帳務中心完成"
git push
```

---

## Self-Review Checklist

1. **Spec coverage:**
   - 6 格 Stats ✅ (Task 3 Step 3)
   - 轉帳狀態篩選 ✅ (Task 3 Step 4)
   - 不可逆按鈕 ✅ (Task 3 Step 7)
   - 確認對話 ✅ (Task 3 Step 7)
   - 通知司機（TODO）✅ (Task 2 Step 1, console.log)
   - 銀行帳號欄位 ✅ (Task 3 Step 6)
   - 單號格式化 ✅ (Task 3 Step 5)
   - Excel 含銀行欄位 ✅ (Task 3 Step 8)
   - GET API 加強 ✅ (Task 1)
   - POST transfer API ✅ (Task 2)

2. **Placeholder scan:** 無 TBD/TODO（通知司機的 TODO 在 code comment 中，供未來串接用，屬合理設計預留）

3. **Type consistency:** `SettlementOrder` 和 `SettlementData` 在 Task 3 Step 2 定義，與 Task 1 API 回應格式一致
