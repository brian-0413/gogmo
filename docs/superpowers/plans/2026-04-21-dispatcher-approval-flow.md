# 派單方審核司機接單 — 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 司機接單後需經派單方審核同意，訂單才正式生效並扣點；逾時未接單的訂單自動移除。

**Architecture:** `ASSIGNED` 狀態作為「等待審核」的中間態。派單方有新的「待同意」Tab 可審核司機資料並決定是否同意。逾時邏輯在現有 cron job 中擴充。

**Tech Stack:** Next.js 14 App Router, Prisma, SSE, existing message system

---

## 檔案變更對照

| 檔案 | 動作 |
|------|------|
| `src/app/api/orders/[id]/accept/route.ts` | 修改：改為寫入 `ASSIGNED`，移除扣點 |
| `src/app/api/orders/[id]/dispatcher-approve/route.ts` | 新建：派單方同意 |
| `src/app/api/orders/[id]/dispatcher-reject/route.ts` | 新建：派單方拒絕 |
| `src/app/api/dispatcher/pending-approvals/route.ts` | 新建：取待審核訂單 |
| `src/app/api/cron/lock-orders/route.ts` | 修改：加入逾時自動取消邏輯 |
| `src/app/dashboard/dispatcher/page.tsx` | 修改：新增「待同意」Tab |
| `src/components/dispatcher/PendingApprovalCard.tsx` | 新建：待審核卡片元件 |

---

## Task 1: 修改 accept route — 司機接單改為 ASSIGNED

**Files:**
- Modify: `src/app/api/orders/[id]/accept/route.ts`

- [ ] **Step 1: 移除扣點與 Transaction 邏輯**

在 `accept/route.ts` 第 248-251 行，移除整個 `driver.balance - platformFee` 的 `update` 與第 253-262 行的 `transaction.create`（PLATFORM_FEE 寫入）。

```typescript
// 移除這段：
await tx.driver.update({
  where: { id: driverId },
  data: { balance: driver.balance - platformFee },
})

await tx.transaction.create({
  data: {
    orderId: id,
    driverId,
    amount: -platformFee,
    type: 'PLATFORM_FEE',
    status: 'SETTLED',
    description: `接單平台費 (5%) - 訂單 #${id.slice(0, 8)}`,
  },
})
```

- [ ] **Step 2: 將狀態從 `ACCEPTED` 改為 `ASSIGNED`**

第 226 行：
```typescript
// 舊：
data: { driverId, status: 'ACCEPTED' },

// 新：
data: { driverId, status: 'ASSIGNED' },
```

- [ ] **Step 3: 移除點數與平台費檢查**

第 210-214 行的點數檢查仍保留（司機帳號需要有足夠點數才能開始），但 `platformFee` 扣款移到 `dispatcher-approve` route。
第 248-251 行（扣點 update）移除。

- [ ] **Step 4: 移除 accept route 中的 `createSystemMessage` 發送邏輯（因為現在是等待審核，不是已完成）**

第 268-277 行（`createSystemMessage` 區塊）移除。派單方的通知是透過「待同意」Tab 看到，不是靠訊息。

- [ ] **Step 5: Build 確認**

```bash
npm run build 2>&1 | tail -15
```
Expected: 無錯誤

- [ ] **Step 6: Commit**

```bash
git add src/app/api/orders/\[id\]/accept/route.ts
git commit -m "feat: 司機接單改為 ASSIGNED 等待派單方審核"
```

---

## Task 2: 新建 dispatcher-approve API

**Files:**
- Create: `src/app/api/orders/[id]/dispatcher-approve/route.ts`

- [ ] **Step 1: 撰寫 dispatcher-approve route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'
import { PLATFORM_FEE_RATE } from '@/lib/constants'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json<ApiResponse>({ success: false, error: '未授權' }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user || user.role !== 'DISPATCHER' || !user.dispatcher) {
      return NextResponse.json<ApiResponse>({ success: false, error: '只有派單方可以審核' }, { status: 403 })
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: { driver: { include: { user: true } }, dispatcher: true },
    })

    if (!order) {
      return NextResponse.json<ApiResponse>({ success: false, error: '找不到訂單' }, { status: 404 })
    }

    if (order.status !== 'ASSIGNED') {
      return NextResponse.json<ApiResponse>({ success: false, error: '此訂單不在待審核狀態' }, { status: 400 })
    }

    if (order.dispatcherId !== user.dispatcher.id) {
      return NextResponse.json<ApiResponse>({ success: false, error: '無權限審核此訂單' }, { status: 403 })
    }

    const driverId = order.driverId!
    const platformFee = Math.floor(order.price * PLATFORM_FEE_RATE)

    // Transaction: 扣點 + 寫 Transaction 記錄 + 改狀態為 ACCEPTED
    const updated = await prisma.$transaction(async (tx) => {
      const driver = await tx.driver.findUnique({ where: { id: driverId } })
      if (!driver) throw new Error('找不到司機資料')

      if (driver.balance < platformFee) {
        throw new Error(`司機點數不足，需要 ${platformFee} 點`)
      }

      await tx.driver.update({
        where: { id: driverId },
        data: { balance: driver.balance - platformFee },
      })

      await tx.transaction.create({
        data: {
          orderId: id,
          driverId,
          amount: -platformFee,
          type: 'PLATFORM_FEE',
          status: 'SETTLED',
          description: `接單平台費 (5%) - 訂單 #${id.slice(0, 8)}`,
        },
      })

      return tx.order.update({
        where: { id },
        data: { status: 'ACCEPTED' },
        include: { driver: { include: { user: true } } },
      })
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { order: updated, platformFee },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('點數不足')) {
      return NextResponse.json<ApiResponse>({ success: false, error: message }, { status: 400 })
    }
    console.error('Dispatcher approve error:', error)
    return NextResponse.json<ApiResponse>({ success: false, error: '伺服器錯誤' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Build 確認**

```bash
npm run build 2>&1 | tail -15
```
Expected: 無錯誤

- [ ] **Step 3: Commit**

```bash
git add src/app/api/orders/\[id\]/dispatcher-approve/route.ts
git commit -m "feat: 新增派單方同意司機接單 API"
```

---

## Task 3: 新建 dispatcher-reject API

**Files:**
- Create: `src/app/api/orders/[id]/dispatcher-reject/route.ts`

- [ ] **Step 1: 撰寫 dispatcher-reject route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'
import { getOrCreateThread, createSystemMessage } from '@/lib/messages'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    let body: { reason?: string } = {}
    try { body = await request.json() } catch {}

    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json<ApiResponse>({ success: false, error: '未授權' }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user || user.role !== 'DISPATCHER' || !user.dispatcher) {
      return NextResponse.json<ApiResponse>({ success: false, error: '只有派單方可以審核' }, { status: 403 })
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: { driver: { include: { user: true } }, dispatcher: true },
    })

    if (!order) {
      return NextResponse.json<ApiResponse>({ success: false, error: '找不到訂單' }, { status: 404 })
    }

    if (order.status !== 'ASSIGNED') {
      return NextResponse.json<ApiResponse>({ success: false, error: '此訂單不在待審核狀態' }, { status: 400 })
    }

    if (order.dispatcherId !== user.dispatcher.id) {
      return NextResponse.json<ApiResponse>({ success: false, error: '無權限審核此訂單' }, { status: 403 })
    }

    const driverId = order.driverId!

    // 回復為 PUBLISHED，清空 driverId
    await prisma.order.update({
      where: { id },
      data: { status: 'PUBLISHED', driverId: null },
    })

    // 發系統訊息給司機
    try {
      const { id: threadId } = await getOrCreateThread(user.dispatcher.id, driverId)
      const reasonText = body.reason ? `\n原因：${body.reason}` : ''
      await createSystemMessage(
        threadId,
        `派單方拒絕了您的接單申請（${order.pickupLocation} → ${order.dropoffLocation}）${reasonText}`
      )
    } catch (e) {
      // 發訊息失敗不影響主要邏輯
      console.error('Failed to send reject message:', e)
    }

    return NextResponse.json<ApiResponse>({ success: true })
  } catch (error) {
    console.error('Dispatcher reject error:', error)
    return NextResponse.json<ApiResponse>({ success: false, error: '伺服器錯誤' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Build 確認**

```bash
npm run build 2>&1 | tail -15
```
Expected: 無錯誤

- [ ] **Step 3: Commit**

```bash
git add src/app/api/orders/\[id\]/dispatcher-reject/route.ts
git commit -m "feat: 新增派單方拒絕司機接單 API"
```

---

## Task 4: 新建 GET dispatcher/pending-approvals API

**Files:**
- Create: `src/app/api/dispatcher/pending-approvals/route.ts`

- [ ] **Step 1: 撰寫 pending-approvals GET route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json<ApiResponse>({ success: false, error: '未授權' }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user || user.role !== 'DISPATCHER' || !user.dispatcher) {
      return NextResponse.json<ApiResponse>({ success: false, error: '只有派單方可以查看' }, { status: 403 })
    }

    // 取所有 ASSIGNED 訂單（等待此派單方審核）
    const orders = await prisma.order.findMany({
      where: {
        dispatcherId: user.dispatcher.id,
        status: 'ASSIGNED',
      },
      include: {
        driver: {
          include: {
            user: {
              include: {
                documents: {
                  where: {
                    type: { in: ['DRIVER_LICENSE', 'VEHICLE_REGISTRATION', 'INSURANCE'] },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { scheduledTime: 'asc' },
    })

    return NextResponse.json<ApiResponse>({ success: true, data: { orders } })
  } catch (error) {
    console.error('Pending approvals error:', error)
    return NextResponse.json<ApiResponse>({ success: false, error: '伺服器錯誤' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Build 確認**

```bash
npm run build 2>&1 | tail -15
```
Expected: 無錯誤

- [ ] **Step 3: Commit**

```bash
git add src/app/api/dispatcher/pending-approvals/route.ts
git commit -m "feat: 新增派單方待審核訂單查詢 API"
```

---

## Task 5: 新建 PendingApprovalCard 元件

**Files:**
- Create: `src/components/dispatcher/PendingApprovalCard.tsx`

- [ ] **Step 1: 撰寫 PendingApprovalCard 元件**

此卡片顯示在派單方行控中心的「待同意」Tab。

Props:
```typescript
interface PendingApprovalCardProps {
  order: {
    id: string
    orderSeq: number
    type: string
    scheduledTime: string
    pickupLocation: string
    dropoffLocation: string
    price: number
    vehicleType?: string | null
    vehicleRequirement?: string | null
    passengerName: string
    passengerCount: number
    luggageCount: number
    driver: {
      licensePlate: string
      vehicleType: string
      carColor: string
      user: {
        name: string
        documents: Array<{
          type: string
          status: string
        }>
      }
    } | null
  }
  onApprove: (orderId: string) => void
  onReject: (orderId: string, reason?: string) => void
  loading?: boolean
}
```

卡片的司機資料區塊：
- 司機姓名（只顯示名：`driver.user.name.slice(0, 1) + '師傅'`）
- 車號：`driver.licensePlate`
- 車型：比對 `driver.vehicleType` 與 `order.vehicleType`/`order.vehicleRequirement`，顯示 ✅/❌
- 三證（DRIVER_LICENSE / VEHICLE_REGISTRATION / INSURANCE）：根據 `documents` 中是否存在且 status !== 'REJECTED'，顯示 ✅/❌

```typescript
'use client'

import { CheckCircle, XCircle, ArrowRight, Clock } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { VEHICLE_LABELS, isVehicleCompatible, normalizeVehicleInput } from '@/lib/vehicle'
import { TYPE_LABELS } from '@/lib/constants'
import { PLATFORM_FEE_RATE } from '@/lib/constants'
import type { VehicleType, RequirementLevel } from '@/lib/vehicle'

interface PendingApprovalCardProps {
  order: {
    id: string
    orderSeq: number
    type: string
    scheduledTime: string | Date
    pickupLocation: string
    dropoffLocation: string
    price: number
    vehicleType?: string | null
    vehicleRequirement?: RequirementLevel | null
    passengerName: string
    passengerCount: number
    luggageCount: number
    driver: {
      licensePlate: string
      vehicleType: string
      carColor: string
      user: {
        name: string
        documents: Array<{
          type: string
          status: string
        }>
      }
    } | null
  }
  onApprove: (orderId: string) => void
  onReject: (orderId: string, reason?: string) => void
  loading?: boolean
}

function getDocStatus(docs: PendingApprovalCardProps['order']['driver']['user']['documents'], type: string) {
  const doc = docs.find(d => d.type === type)
  return doc && doc.status !== 'REJECTED' ? 'approved' : 'missing'
}

export function PendingApprovalCard({ order, onApprove, onReject, loading }: PendingApprovalCardProps) {
  const driver = order.driver
  const platformFee = Math.floor(order.price * PLATFORM_FEE_RATE)

  // 車型是否合乎要求
  const vehicleOk = driver && order.vehicleType
    ? isVehicleCompatible(driver.vehicleType as VehicleType, order.vehicleType as VehicleType, order.vehicleRequirement || 'MIN')
    : false

  // 三證狀態
  const docLicense = driver ? getDocStatus(driver.user.documents, 'DRIVER_LICENSE') : 'missing'
  const docVehicle = driver ? getDocStatus(driver.user.documents, 'VEHICLE_REGISTRATION') : 'missing'
  const docInsurance = driver ? getDocStatus(driver.user.documents, 'INSURANCE') : 'missing'

  const driverName = driver ? `${driver.user.name.slice(0, 1)}師傅` : '未知'

  return (
    <div className="bg-white rounded-xl border border-[#DDDDDD] p-4 shadow-sm">
      {/* 訂單基本資訊 */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center px-2 py-0.5 bg-[#1C1917] text-white text-[12px] font-bold font-mono-nums rounded">
              #{order.orderSeq.toString().padStart(4, '0')}
            </span>
            <span className="text-[12px] text-[#717171]">
              {TYPE_LABELS[order.type as keyof typeof TYPE_LABELS] ?? order.type}
            </span>
          </div>
          <p className="text-[14px] font-medium text-[#222222]">
            {order.pickupLocation} <ArrowRight className="w-3 h-3 inline mx-1" /> {order.dropoffLocation}
          </p>
          <div className="flex items-center gap-2 mt-1 text-[12px] text-[#717171]">
            <Clock className="w-3 h-3" />
            <span className="font-mono-nums">
              {format(parseISO(order.scheduledTime as string), 'M/dd HH:mm', { locale: zhTW })}
            </span>
            <span>{order.passengerName} {order.passengerCount}人</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[18px] font-bold font-mono-nums text-[#FF385C]">NT${order.price.toLocaleString()}</p>
          <p className="text-[10px] text-[#78716C]">平台費 -{platformFee} 點</p>
        </div>
      </div>

      {/* 司機資料 */}
      {driver && (
        <div className="bg-[#FAFAFA] rounded-lg p-3 mb-3 border border-[#EBEBEB]">
          <p className="text-[11px] text-[#78716C] uppercase tracking-wider mb-2 font-medium">接單司機</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[14px] font-bold text-[#222222]">{driverName}</p>
              <p className="text-[12px] text-[#717171]">{driver.carColor} {driver.licensePlate}</p>
              <p className="text-[11px] text-[#717171]">
                車型：{VEHICLE_LABELS[driver.vehicleType as VehicleType] ?? driver.vehicleType}
              </p>
            </div>
            <div className="flex gap-4">
              {/* 車型是否符合 */}
              <div className="text-center">
                {vehicleOk ? (
                  <CheckCircle className="w-5 h-5 text-green-600 mx-auto" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500 mx-auto" />
                )}
                <p className="text-[10px] text-[#717171] mt-0.5">車型</p>
              </div>
              {/* 三證 */}
              <div className="text-center">
                {docLicense === 'approved' && docVehicle === 'approved' && docInsurance === 'approved' ? (
                  <CheckCircle className="w-5 h-5 text-green-600 mx-auto" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500 mx-auto" />
                )}
                <p className="text-[10px] text-[#717171] mt-0.5">三證</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 操作按鈕 */}
      <div className="flex gap-2">
        <button
          onClick={() => onApprove(order.id)}
          disabled={loading}
          className="flex-1 py-2.5 bg-[#008A05] hover:bg-[#006E04] text-white text-[14px] font-bold rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          <CheckCircle className="w-4 h-4" />
          同意
        </button>
        <button
          onClick={() => onReject(order.id)}
          disabled={loading}
          className="flex-1 py-2.5 border border-[#DDDDDD] text-[#717171] hover:border-red-400 hover:text-red-500 text-[14px] font-bold rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          <XCircle className="w-4 h-4" />
          拒絕
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Build 確認**

```bash
npm run build 2>&1 | tail -15
```
Expected: 無錯誤

- [ ] **Step 3: Commit**

```bash
git add src/components/dispatcher/PendingApprovalCard.tsx
git commit -m "feat: 新增派單方待審核卡片元件"
```

---

## Task 6: 派單方行控中心新增「待同意」Tab

**Files:**
- Modify: `src/app/dashboard/dispatcher/page.tsx`

- [ ] **Step 1: 加入新 Tab 類型**

第 32 行：
```typescript
// 舊：
type Tab = 'orders' | 'create' | 'review' | 'drivers' | 'settlement'

// 新：
type Tab = 'orders' | 'create' | 'review' | 'drivers' | 'settlement' | 'pending-approval'
```

- [ ] **Step 2: 加入 state**

```typescript
const [pendingApprovals, setPendingApprovals] = useState<any[]>([])
const [approvalLoading, setApprovalLoading] = useState(false)
```

- [ ] **Step 3: 新增 fetch pending approvals 的函式**

```typescript
const fetchPendingApprovals = useCallback(async () => {
  const res = await fetch('/api/dispatcher/pending-approvals', {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json()
  if (data.success) {
    setPendingApprovals(data.data.orders)
  }
}, [token])

useEffect(() => {
  if (activeTab === 'pending-approval') {
    fetchPendingApprovals()
  }
}, [activeTab, fetchPendingApprovals])
```

- [ ] **Step 4: 加入 approve/reject handler**

```typescript
const handleApprove = async (orderId: string) => {
  setApprovalLoading(true)
  try {
    const res = await fetch(`/api/orders/${orderId}/dispatcher-approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    })
    const data = await res.json()
    if (data.success) {
      setPendingApprovals(prev => prev.filter(o => o.id !== orderId))
      // 重新抓派單方的 orders（已從待審核消失）
    } else {
      alert(data.error || '審核失敗')
    }
  } finally {
    setApprovalLoading(false)
  }
}

const handleReject = async (orderId: string) => {
  setApprovalLoading(true)
  try {
    const res = await fetch(`/api/orders/${orderId}/dispatcher-reject`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const data = await res.json()
    if (data.success) {
      setPendingApprovals(prev => prev.filter(o => o.id !== orderId))
    } else {
      alert(data.error || '審核失敗')
    }
  } finally {
    setApprovalLoading(false)
  }
}
```

- [ ] **Step 5: Tab 按鈕列加入「待同意」**

在現有 Tab 按鈕列加入（注意：只有 pendingApprovals.length > 0 時顯示 badge 數量）：

```tsx
<button
  onClick={() => setActiveTab('pending-approval')}
  className={`flex items-center gap-1.5 px-3 py-2 text-[14px] font-medium rounded-lg transition-colors ${
    activeTab === 'pending-approval'
      ? 'bg-[#FFF7ED] text-[#B45309]'
      : 'text-[#717171] hover:bg-[#F5F4F0]'
  }`}
>
  待同意
  {pendingApprovals.length > 0 && (
    <span className="bg-[#FF385C] text-white text-[11px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
      {pendingApprovals.length}
    </span>
  )}
</button>
```

- [ ] **Step 6: Tab 內容 render**

在現有 Tab switch 內加入：

```tsx
case 'pending-approval':
  return (
    <div className="space-y-3">
      {pendingApprovals.length === 0 ? (
        <div className="text-center py-12 text-[#78716C]">
          <p className="text-[14px]">目前沒有待審核的接單申請</p>
        </div>
      ) : (
        pendingApprovals.map(order => (
          <PendingApprovalCard
            key={order.id}
            order={order}
            onApprove={handleApprove}
            onReject={handleReject}
            loading={approvalLoading}
          />
        ))
      )}
    </div>
  )
```

- [ ] **Step 7: 引入 PendingApprovalCard**

```typescript
import { PendingApprovalCard } from '@/components/dispatcher/PendingApprovalCard'
```

- [ ] **Step 8: Build 確認**

```bash
npm run build 2>&1 | tail -15
```
Expected: 無錯誤

- [ ] **Step 9: Commit**

```bash
git add src/app/dashboard/dispatcher/page.tsx
git commit -m "feat: 派單方行控中心新增待同意 Tab"
```

---

## Task 7: 逾時自動取消 — 擴充 lock-orders cron

**Files:**
- Modify: `src/app/api/cron/lock-orders/route.ts`

- [ ] **Step 1: 在 lock-orders cron 中加入逾時自動取消邏輯**

在現有邏輯最後（return 之前），加入：

```typescript
// 逾時自動取消：PUBLISHED 且 scheduledTime + 寬限期 < now 的訂單
const EXPIRE_GRACE_MINUTES = parseInt(process.env.ORDER_EXPIRE_GRACE_MINUTES ?? '90')
const expireThreshold = new Date(now.getTime() - EXPIRE_GRACE_MINUTES * 60 * 1000)

const expiredOrders = await prisma.order.findMany({
  where: {
    status: 'PUBLISHED',
    scheduledTime: { lt: expireThreshold },
  },
  select: { id: true, dispatcherId: true },
})

let expiredCount = 0
for (const order of expiredOrders) {
  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: { status: 'CANCELLED' },
    })

    // 通知派單方（找到派單方的 user）
    const dispatcher = await tx.dispatcher.findUnique({
      where: { id: order.dispatcherId },
      include: { user: true },
    })
    if (dispatcher) {
      // 嘗試發送系統訊息（若訊息功能已就緒）
      try {
        const { getOrCreateThread, createSystemMessage } = await import('@/lib/messages')
        const { id: threadId } = await getOrCreateThread(dispatcher.id, 'SYSTEM' as any)
        await createSystemMessage(
          threadId,
          `系統通知：訂單（${order.id.slice(0, 8)}）因超過上車時間 {EXPIRE_GRACE_MINUTES} 分鐘仍无人接单，已被系統自動取消`
        )
      } catch {
        // 發訊息失敗不影響取消防疫
      }
    }
  })
  expiredCount++
}
```

然後更新 return 的計數：
```typescript
return NextResponse.json({
  success: true,
  message: 'Lock orders cron completed',
  lockedCount: orderIds.length,
  expiredCount,
})
```

**注意**：`getOrCreateThread` 需要 `driverId`，但這裡是派單方自己被通知，不需要 thread。可以直接寫一個輕量的 `createDispatcherNotification` 或者跳過訊息（反正派單方可以在 UI 上看到已取消）。先做不做訊息，確認基本邏輯正確。

- [ ] **Step 2: Build 確認**

```bash
npm run build 2>&1 | tail -15
```
Expected: 無錯誤

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cron/lock-orders/route.ts
git commit -m "feat: lock-orders cron 加入逾時自動取消邏輯"
```

---

## Self-Review Checklist

- [ ] Spec Section 2（狀態流程）：每個狀態轉換都有對應的 API task
- [ ] Spec Section 3（派單方審核區塊）：Tab、卡片、司機資料顯示、同意/拒絕按鈕
- [ ] Spec Section 4.3（司機視角）：accept route 改為 ASSIGNED 後，行程中心看不見（因為 status !== ACCEPTED/ARRIVED/IN_PROGRESS）
- [ ] Spec Section 4.5（逾時自動取消）：lock-orders cron 已擴充
- [ ] 三證顯示：文件狀態比對（`status !== 'REJECTED'`）
- [ ] 無 placeholder/TODO
- [ ] 所有 `VehicleType` 從 `@/lib/vehicle` import
