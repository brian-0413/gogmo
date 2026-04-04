# 司機行程狀態更新實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 司機可在手機上依序執行「開始 → 抵達 → 客上 → 客下」，派單方行控中心的卡片即時同步顯示4格進度燈號。

**Architecture:** 新增 3 個 Prisma 欄位（startedAt/arrivedAt/pickedUpAt）、擴展狀態流程、新增派單方 SSE 端點、前端新增訂單詳情頁 + 進度條元件。

**Tech Stack:** Next.js App Router, Prisma, SSE (Server-Sent Events), Tailwind CSS

---

## 檔案變更總覽

| 檔案 | 動作 | 負責 |
|------|------|------|
| `prisma/schema.prisma` | 修改 | Task 1 |
| `src/app/api/orders/[id]/route.ts` | 修改 | Task 2 |
| `src/app/api/orders/[id]/status/route.ts` | 新增 | Task 2 |
| `src/app/api/dispatchers/events/route.ts` | 新增 | Task 3 |
| `src/types/index.ts` | 修改 | Task 4 |
| `src/components/driver/ProgressBar.tsx` | 新增 | Task 4 |
| `src/components/driver/OrderDetailActions.tsx` | 新增 | Task 4 |
| `src/app/dashboard/driver/order/[id]/page.tsx` | 新增 | Task 5 |
| `src/app/dashboard/driver/page.tsx` | 修改 | Task 5 |
| `src/components/dispatcher/DispatcherOrderCard.tsx` | 修改 | Task 6 |
| `src/app/dashboard/dispatcher/page.tsx` | 修改 | Task 6 |

---

## Task 1: Prisma Schema 異動

**Files:**
- Modify: `prisma/schema.prisma:117-192`
- Run: `npx prisma db push`

- [ ] **Step 1: 修改 schema — 新增時間戳記欄位**

在 `Order` model 的 `completedAt` 欄位下方新增：

```prisma
  startedAt    DateTime?  // 司機按「開始」
  arrivedAt   DateTime?  // 司機按「抵達」
  pickedUpAt   DateTime?  // 司機按「客上」
```

位置：在 `completedAt     DateTime?` 之後（第 180 行附近）。

- [ ] **Step 2: 執行 db push 同步至 Supabase**

```bash
cd C:/Users/BrianNB/airport-dispatch-platform
npx prisma db push
```

預期：成功輸出「Your database is now in sync with your Prisma schema」

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(db): Order model 新增 startedAt/arrivedAt/pickedUpAt 時間戳記

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 2: API — 狀態更新端點

**Files:**
- Modify: `src/app/api/orders/[id]/route.ts:176-246`
- Create: `src/app/api/orders/[id]/status/route.ts`

### Part A: 修改現有 PATCH 邏輯

- [ ] **Step 1: 修改 validTransitions 狀態流程**

檔案：`src/app/api/orders/[id]/route.ts:179-184`

原本：
```typescript
const validTransitions: Record<string, string[]> = {
  ACCEPTED: ['ARRIVED'],
  ARRIVED: ['IN_PROGRESS'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: [],
}
```

改為：
```typescript
const validTransitions: Record<string, string[]> = {
  ACCEPTED: ['IN_PROGRESS'],
  IN_PROGRESS: ['ARRIVED'],
  ARRIVED: ['PICKED_UP'],
  PICKED_UP: ['COMPLETED'],
  COMPLETED: [],
}
```

- [ ] **Step 2: 新增時間戳記寫入邏輯**

在 `const updateData: Record<string, unknown> = { status }` 之後加入：

```typescript
// 時間戳記寫入
if (status === 'IN_PROGRESS') updateData.startedAt = new Date()
if (status === 'ARRIVED')    updateData.arrivedAt = new Date()
if (status === 'PICKED_UP')  updateData.pickedUpAt = new Date()
```

位置：在第 195 行（`const updateData` 之後）。

- [ ] **Step 3: 移除 IN_PROGRESS 時的 driver balance 更新**

原本在 `status === 'COMPLETED'` 時，IN_PROGRESS 時也更新了 balance（driver status 改回 ONLINE）。但根據新流程，IN_PROGRESS 只是司機「開始」，還沒完成，所以 driver 應該保持 ONLINE 而非還原。找到這段並移除：

```typescript
// Update driver balance
await prisma.driver.update({
  where: { id: user.driver.id },
  data: { status: 'ONLINE' }, // Set back to online after completion
})
```

這段程式碼（`src/app/api/orders/[id]/route.ts:235-238`）只應該在 `COMPLETED` 時執行，不需要移除，只需要確認它只在 `if (status === 'COMPLETED')` 區塊內。

確認 `COMPLETED` 區塊（`src/app/api/orders/[id]/route.ts:210-238`）已經正確，只在 `COMPLETED` 時執行 balance 更新。

- [ ] **Step 4: 修改 driver status 為 BUSY**

在 `status === 'IN_PROGRESS'` 時，將司機狀態改為 BUSY。在 `updateData` 宣告後加入：

```typescript
// 司機出發，改為忙碌
await prisma.driver.update({
  where: { id: user.driver.id },
  data: { status: 'BUSY' },
})
```

- [ ] **Step 5: 驗證 TypeScript 編譯**

```bash
cd C:/Users/BrianNB/airport-dispatch-platform
npm run build 2>&1 | head -30
```

預期：無 TypeScript 錯誤（warning 可忽略）

- [ ] **Step 6: Commit**

```bash
git add src/app/api/orders/\[id\]/route.ts
git commit -m "feat(api): 擴展狀態流程與時間戳記

- ACCEPTED→IN_PROGRESS→ARRIVED→PICKED_UP→COMPLETED
- 新增 startedAt/arrivedAt/pickedUpAt 時間戳記寫入
- IN_PROGRESS 時司機改為 BUSY 狀態

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

### Part B: 新增專用狀態端點

- [ ] **Step 1: 建立 `POST /api/orders/[id]/status` 端點**

建立新檔案 `src/app/api/orders/[id]/status/route.ts`：

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'

// action → status 對照
const actionMap: Record<string, string> = {
  start: 'IN_PROGRESS',
  arrive: 'ARRIVED',
  pickup: 'PICKED_UP',
  complete: 'COMPLETED',
}

// nextAction 提示
const nextActionMap: Record<string, string | null> = {
  IN_PROGRESS: 'arrive',
  ARRIVED: 'pickup',
  PICKED_UP: 'complete',
  COMPLETED: null,
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '未授權' },
        { status: 401 }
      )
    }

    const user = await getUserFromToken(token)
    if (!user || user.role !== 'DRIVER' || !user.driver) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '只有司機可以更新狀態' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { action } = body

    if (!action || !actionMap[action]) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '無效的 action，請使用 start / arrive / pickup / complete' },
        { status: 400 }
      )
    }

    const order = await prisma.order.findUnique({ where: { id } })
    if (!order) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '找不到訂單' },
        { status: 404 }
      )
    }

    if (order.driverId !== user.driver.id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '此訂單不是您承接的' },
        { status: 403 }
      )
    }

    const targetStatus = actionMap[action]

    // 驗證狀態轉換是否合法
    const validTransitions: Record<string, string[]> = {
      ACCEPTED: ['IN_PROGRESS'],
      IN_PROGRESS: ['ARRIVED'],
      ARRIVED: ['PICKED_UP'],
      PICKED_UP: ['COMPLETED'],
    }

    if (!validTransitions[order.status]?.includes(targetStatus)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `目前狀態為 ${order.status}，無法執行 ${action}` },
        { status: 400 }
      )
    }

    // 3 小時門檻檢查（只有第一個動作 start 需要）
    if (action === 'start') {
      const now = new Date()
      const scheduledTime = new Date(order.scheduledTime)
      const hoursUntil = (scheduledTime.getTime() - now.getTime()) / (1000 * 60 * 60)
      if (hoursUntil >= 3) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: '行程時間尚未接近，請在出發前 3 小時內再試' },
          { status: 400 }
        )
      }
    }

    // 構建 updateData
    const updateData: Record<string, unknown> = { status: targetStatus }
    if (targetStatus === 'IN_PROGRESS') updateData.startedAt = new Date()
    if (targetStatus === 'ARRIVED')    updateData.arrivedAt = new Date()
    if (targetStatus === 'PICKED_UP')  updateData.pickedUpAt = new Date()
    if (targetStatus === 'COMPLETED')  updateData.completedAt = new Date()

    // 更新訂單
    const updated = await prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id },
        data: updateData,
        include: {
          dispatcher: { include: { user: true } },
          driver: { include: { user: true } },
        },
      })

      // COMPLETED：建立交易紀錄
      if (targetStatus === 'COMPLETED') {
        const platformFee = Math.floor(order.price * 0.05)
        await tx.transaction.createMany({
          data: [
            {
              orderId: id,
              driverId: user.driver.id,
              amount: order.price - platformFee,
              type: 'RIDE_FARE',
              status: 'PENDING',
              description: `行程收入 - 訂單 #${id.slice(0, 8)}`,
            },
            {
              orderId: id,
              driverId: user.driver.id,
              amount: -platformFee,
              type: 'PLATFORM_FEE',
              status: 'SETTLED',
              description: '平台費 (5%)',
            },
          ],
        })
        await tx.driver.update({
          where: { id: user.driver.id },
          data: { status: 'ONLINE' },
        })
      }

      // IN_PROGRESS：司機改 BUSY
      if (targetStatus === 'IN_PROGRESS') {
        await tx.driver.update({
          where: { id: user.driver.id },
          data: { status: 'BUSY' },
        })
      }

      return updatedOrder
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        orderId: id,
        status: targetStatus,
        startedAt: updated.startedAt?.toISOString(),
        arrivedAt: updated.arrivedAt?.toISOString(),
        pickedUpAt: updated.pickedUpAt?.toISOString(),
        completedAt: updated.completedAt?.toISOString(),
        nextAction: nextActionMap[targetStatus] ?? null,
      },
    })
  } catch (error) {
    console.error('Status update error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2: 驗證 TypeScript 編譯**

```bash
npm run build 2>&1 | head -30
```

預期：無錯誤

- [ ] **Step 3: Commit**

```bash
git add src/app/api/orders/\[id\]/status/route.ts
git commit -m "feat(api): 新增 POST /api/orders/[id]/status 專用狀態端點

支援 start/arrive/pickup/complete 四個動作
包含 3 小時門檻檢查、狀態轉換驗證、完成時建立交易紀錄

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 3: API — 派單方 SSE 推播

**Files:**
- Create: `src/app/api/dispatchers/events/route.ts`

- [ ] **Step 1: 建立派單方 SSE 端點**

建立新檔案 `src/app/api/dispatchers/events/route.ts`：

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'

// In-memory map: dispatcherId → last check time
const dispatcherLastCheckMap = new Map<string, Date>()

type SSEEvent =
  | { type: 'HEARTBEAT'; timestamp: string }
  | { type: 'ORDER_STATUS_CHANGE'; orderId: string; status: string; driverName: string; startedAt?: string; arrivedAt?: string; pickedUpAt?: string; completedAt?: string }

// GET /api/dispatchers/events - SSE endpoint for dispatcher real-time updates
export async function GET(request: NextRequest) {
  let token: string | null = null

  try {
    const cookieStore = await cookies()
    token = cookieStore.get('auth_token')?.value || null
  } catch {
    token = request.headers.get('Authorization')?.replace('Bearer ', '') || null
  }

  if (!token) {
    token = request.headers.get('Authorization')?.replace('Bearer ', '') || null
  }

  if (!token) {
    return NextResponse.json({ success: false, error: '未授權' }, { status: 401 })
  }

  const user = await getUserFromToken(token)
  if (!user || user.role !== 'DISPATCHER' || !user.dispatcher) {
    return NextResponse.json({ success: false, error: '找不到派單方資料' }, { status: 404 })
  }

  const dispatcherId = user.dispatcher.id
  const encoder = new TextEncoder()
  let isClosed = false

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: SSEEvent) => {
        if (isClosed) return
        try {
          const data = `data: ${JSON.stringify(event)}\n\n`
          controller.enqueue(encoder.encode(data))
        } catch {}
      }

      // Send initial heartbeat
      sendEvent({ type: 'HEARTBEAT', timestamp: new Date().toISOString() })

      // Poll every 3 seconds for status changes on this dispatcher's orders
      const intervalId = setInterval(async () => {
        if (isClosed) {
          clearInterval(intervalId)
          return
        }

        try {
          const lastCheck = dispatcherLastCheckMap.get(dispatcherId) || new Date(Date.now() - 60000)

          // 查詢此派單方所有司機已接的訂單中，有狀態變化的
          const changedOrders = await prisma.order.findMany({
            where: {
              dispatcherId,
              status: { in: ['IN_PROGRESS', 'ARRIVED', 'PICKED_UP', 'COMPLETED'] },
              updatedAt: { gt: lastCheck },
            },
            include: {
              driver: { include: { user: true } },
            },
            orderBy: { updatedAt: 'desc' },
          })

          dispatcherLastCheckMap.set(dispatcherId, new Date())

          for (const order of changedOrders) {
            sendEvent({
              type: 'ORDER_STATUS_CHANGE',
              orderId: order.id,
              status: order.status,
              driverName: order.driver?.user?.name ?? '司機',
              startedAt: order.startedAt?.toISOString(),
              arrivedAt: order.arrivedAt?.toISOString(),
              pickedUpAt: order.pickedUpAt?.toISOString(),
              completedAt: order.completedAt?.toISOString(),
            })
          }

          sendEvent({ type: 'HEARTBEAT', timestamp: new Date().toISOString() })
        } catch (error) {
          console.error('Dispatcher SSE poll error:', error)
          sendEvent({ type: 'HEARTBEAT', timestamp: new Date().toISOString() })
        }
      }, 3000)

      request.signal.addEventListener('abort', () => {
        isClosed = true
        clearInterval(intervalId)
        try { controller.close() } catch {}
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
```

- [ ] **Step 2: 驗證 TypeScript 編譯**

```bash
npm run build 2>&1 | head -30
```

預期：無錯誤

- [ ] **Step 3: Commit**

```bash
git add src/app/api/dispatchers/events/route.ts
git commit -m "feat(api): 新增派單方 SSE 即時推播端點

GET /api/dispatchers/events
- 每 3 秒輪詢派單方訂單的狀態變化
- 推播 ORDER_STATUS_CHANGE 事件含司機名稱和時間戳記
- 支援 IN_PROGRESS/ARRIVED/PICKED_UP/COMPLETED 狀態

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 4: 前端共用元件

**Files:**
- Modify: `src/types/index.ts`
- Create: `src/components/driver/ProgressBar.tsx`
- Create: `src/components/driver/OrderDetailActions.tsx`

- [ ] **Step 1: 更新 TypeScript 類型**

檔案：`src/types/index.ts:5`

在 `OrderStatus` 新增三個狀態（目前是 8 個，新增後 11 個）：

原本：
```typescript
export type OrderStatus = 'PENDING' | 'PUBLISHED' | 'ASSIGNED' | 'ACCEPTED' | 'ARRIVED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
```

改為：
```typescript
export type OrderStatus = 'PENDING' | 'PUBLISHED' | 'ASSIGNED' | 'ACCEPTED' | 'IN_PROGRESS' | 'ARRIVED' | 'PICKED_UP' | 'COMPLETED' | 'CANCELLED'
```

注意：原本已有 IN_PROGRESS、ARRIVED，只新增 PICKED_UP。

- [ ] **Step 2: 新增 ProgressBar 元件**

建立 `src/components/driver/ProgressBar.tsx`：

```typescript
import { cn } from '@/lib/utils'

type ProgressStep = 'start' | 'arrive' | 'pickup' | 'complete'
type CurrentStatus = 'ACCEPTED' | 'IN_PROGRESS' | 'ARRIVED' | 'PICKED_UP' | 'COMPLETED'

const STEPS: { key: ProgressStep; label: string }[] = [
  { key: 'start', label: '開始' },
  { key: 'arrive', label: '抵達' },
  { key: 'pickup', label: '客上' },
  { key: 'complete', label: '客下' },
]

// 根據訂單狀態判斷每個步驟是否已亮起
function isStepLit(status: CurrentStatus, step: ProgressStep): boolean {
  const order: ProgressStep[] = ['start', 'arrive', 'pickup', 'complete']
  const currentIndex = order.indexOf(
    status === 'COMPLETED' ? 'complete' : status === 'PICKED_UP' ? 'pickup' : status === 'ARRIVED' ? 'arrive' : status === 'IN_PROGRESS' ? 'start' : 'none'
  )
  const stepIndex = order.indexOf(step)
  if (status === 'COMPLETED') return true
  return stepIndex <= currentIndex && currentIndex >= 0
}

// 下一個即將亮起的步驟（用於閃爍效果）
function isStepNext(status: CurrentStatus, step: ProgressStep): boolean {
  const order: ProgressStep[] = ['start', 'arrive', 'pickup', 'complete']
  const currentIndex = order.indexOf(
    status === 'COMPLETED' ? 'complete' : status === 'PICKED_UP' ? 'pickup' : status === 'ARRIVED' ? 'arrive' : status === 'IN_PROGRESS' ? 'start' : 'none'
  )
  const stepIndex = order.indexOf(step)
  return stepIndex === currentIndex + 1
}

interface ProgressBarProps {
  status: string
  size?: 'sm' | 'md'
  showLabel?: boolean
  animateNext?: boolean
}

export function ProgressBar({ status, size = 'md', showLabel = true, animateNext = false }: ProgressBarProps) {
  const currentStatus = status as CurrentStatus
  const isLit = (step: ProgressStep) => isStepLit(currentStatus, step)
  const isNext = (step: ProgressStep) => isNextLit(currentStatus, step)

  const dotSize = size === 'sm' ? 'w-2 h-2' : 'w-3 h-3'
  const lineWidth = size === 'sm' ? 'h-px' : 'h-0.5'
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-[11px]'
  const gapSize = size === 'sm' ? 'gap-2' : 'gap-3'

  return (
    <div className="flex items-center justify-center">
      {STEPS.map((step, i) => {
        const lit = isLit(step.key)
        const next = animateNext && isNext(step.key)
        return (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  'rounded-full flex-shrink-0 transition-all duration-300',
                  dotSize,
                  lit
                    ? 'bg-[#0C447C]'
                    : 'bg-[#DDDDDD]',
                  next && 'animate-pulse ring-2 ring-[#0C447C]/40'
                )}
              />
              {showLabel && (
                <span className={cn(textSize, 'font-medium', lit ? 'text-[#0C447C]' : 'text-[#AAAAAA]')}>
                  {step.label}
                </span>
              )}
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  'w-4 bg-[#DDDDDD] mx-1 flex-shrink-0',
                  lineWidth,
                  size === 'sm' ? 'my-2' : 'my-2.5',
                  STEPS[i + 1] && isLit(STEPS[i + 1].key) ? 'bg-[#0C447C]' : 'bg-[#DDDDDD]'
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// 修正：isNextLit 函式
function isNextLit(status: CurrentStatus, step: ProgressStep): boolean {
  const order: ProgressStep[] = ['start', 'arrive', 'pickup', 'complete']
  const currentIndex = order.indexOf(
    status === 'COMPLETED' ? 'complete' : status === 'PICKED_UP' ? 'pickup' : status === 'ARRIVED' ? 'arrive' : status === 'IN_PROGRESS' ? 'start' : 'none'
  )
  const stepIndex = order.indexOf(step)
  return stepIndex === currentIndex + 1
}
```

- [ ] **Step 3: 新增 OrderDetailActions 元件**

建立 `src/components/driver/OrderDetailActions.tsx`：

```typescript
import { Button } from '@/components/ui/Button'
import { X, Play, MapPin, Users, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

type ActionType = 'start' | 'arrive' | 'pickup' | 'complete'

interface OrderDetailActionsProps {
  status: string
  scheduledTime: Date | string
  onAction: (action: ActionType) => void
  onCancel: () => void
  loading?: boolean
}

function getHoursUntilScheduled(scheduledTime: Date | string): number {
  const now = new Date()
  const scheduled = new Date(scheduledTime)
  return (scheduled.getTime() - now.getTime()) / (1000 * 60 * 60)
}

function getAvailableActions(status: string, hoursUntil: number): ActionType[] {
  if (status === 'ACCEPTED') {
    if (hoursUntil < 3) return ['start']
    return [] // 還沒到3小時，只有退單
  }
  if (status === 'IN_PROGRESS') return ['arrive']
  if (status === 'ARRIVED') return ['pickup']
  if (status === 'PICKED_UP') return ['complete']
  return []
}

const ACTION_CONFIG: Record<ActionType, { label: string; icon: React.ReactNode; className: string }> = {
  start: {
    label: '開始',
    icon: <Play className="w-4 h-4" />,
    className: 'bg-[#0C447C] text-white hover:bg-[#0a3a6e]',
  },
  arrive: {
    label: '抵達',
    icon: <MapPin className="w-4 h-4" />,
    className: 'bg-[#0C447C] text-white hover:bg-[#0a3a6e]',
  },
  pickup: {
    label: '客上',
    icon: <Users className="w-4 h-4" />,
    className: 'bg-[#0C447C] text-white hover:bg-[#0a3a6e]',
  },
  complete: {
    label: '客下',
    icon: <Check className="w-4 h-4" />,
    className: 'bg-[#008A05] text-white hover:bg-[#006d04]',
  },
}

export function OrderDetailActions({
  status,
  scheduledTime,
  onAction,
  onCancel,
  loading = false,
}: OrderDetailActionsProps) {
  const hoursUntil = getHoursUntilScheduled(scheduledTime)
  const canCancel = status === 'ACCEPTED' && hoursUntil >= 3
  const canStart = status === 'ACCEPTED' && hoursUntil < 3
  const availableActions = getAvailableActions(status, hoursUntil)

  const allActions: ActionType[] = ['start', 'arrive', 'pickup', 'complete']
  const disabledActions: ActionType[] = allActions.filter(a => !availableActions.includes(a))

  return (
    <div className="space-y-3 pt-4 border-t border-[#EBEBEB]">
      {/* 退單按鈕 */}
      {canCancel && (
        <div className="mb-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            className="w-full border-[#E24B4A] text-[#E24B4A] hover:bg-[#FCEBEB] disabled:opacity-40"
            disabled={loading}
          >
            <X className="w-4 h-4 mr-1" />
            取消退單
          </Button>
        </div>
      )}

      {/* 4鍵按鈕列 */}
      <div className="grid grid-cols-2 gap-2">
        {allActions.map(action => {
          const config = ACTION_CONFIG[action]
          const isAvailable = availableActions.includes(action)
          return (
            <Button
              key={action}
              variant="custom"
              size="sm"
              onClick={() => isAvailable && onAction(action)}
              className={cn(
                'flex items-center justify-center gap-2 font-bold py-3 text-[14px] transition-all duration-200',
                config.className,
                !isAvailable && 'bg-[#EEEEEE] text-[#AAAAAA] cursor-not-allowed hover:bg-[#EEEEEE]'
              )}
              disabled={!isAvailable || loading}
            >
              {config.icon}
              {config.label}
            </Button>
          )
        })}
      </div>

      {/* 提示文字 */}
      {status === 'ACCEPTED' && hoursUntil >= 3 && (
        <p className="text-center text-[12px] text-[#717171]">
          行程時間尚未接近，請在出發前 3 小時內再試
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: 驗證 TypeScript 編譯**

```bash
npm run build 2>&1 | head -40
```

預期：無 TypeScript 錯誤

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/components/driver/ProgressBar.tsx src/components/driver/OrderDetailActions.tsx
git commit -m "feat(components): 新增 ProgressBar 和 OrderDetailActions 元件

- ProgressBar：4格進度條，支援 lit/next 閃爍狀態
- OrderDetailActions：4鍵按鈕列，含狀態鎖定邏輯
- OrderStatus 新增 PICKED_UP 狀態

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 5: 司機端 — 訂單詳情頁

**Files:**
- Create: `src/app/dashboard/driver/order/[id]/page.tsx`
- Modify: `src/app/dashboard/driver/page.tsx:1137-1163`

### Part A: 訂單詳情頁

- [ ] **Step 1: 建立訂單詳情頁**

建立 `src/app/dashboard/driver/order/[id]/page.tsx`：

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/Button'
import { ProgressBar } from '@/components/driver/ProgressBar'
import { OrderDetailActions } from '@/components/driver/OrderDetailActions'
import { format, parseISO } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { ArrowLeft, Phone, Clock, MapPin, User, Package } from 'lucide-react'
import { formatOrderNo } from '@/lib/utils'
import type { OrderType } from '@/types'

const TYPE_LABELS: Record<string, string> = {
  pickup: '接機', dropoff: '送機', pickup_boat: '接船',
  dropoff_boat: '送船', transfer: '接駁', charter: '包車',
}

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  pickup: { bg: '#E6F1FB', text: '#0C447C' },
  dropoff: { bg: '#FFF3E0', text: '#92400E' },
  pickup_boat: { bg: '#E0F7FA', text: '#006064' },
  dropoff_boat: { bg: '#E0F7FA', text: '#006064' },
  transfer: { bg: '#F4EFE9', text: '#717171' },
  charter: { bg: '#F3E8FF', text: '#6B21A8' },
}

interface OrderDetail {
  id: string
  orderSeq: number
  scheduledTime: string
  status: string
  type: string
  vehicle: string
  plateType: string
  kenichiRequired: boolean
  pickupLocation: string
  dropoffLocation: string
  passengerName: string
  passengerPhone: string
  flightNumber: string
  passengerCount: number
  luggageCount: number
  price: number
  note?: string
  startedAt?: string
  arrivedAt?: string
  pickedUpAt?: string
  completedAt?: string
  dispatcher?: { user?: { name?: string } }
}

export default function OrderDetailPage() {
  const { user, token, isLoading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const orderId = params.id as string

  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [showCompleteHint, setShowCompleteHint] = useState(false)

  const fetchOrder = useCallback(async () => {
    if (!token || !orderId) return
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) {
        setOrder(data.data)
      } else {
        alert(data.error || '載入失敗')
        router.back()
      }
    } catch {
      alert('網路錯誤')
      router.back()
    } finally {
      setLoading(false)
    }
  }, [token, orderId, router])

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'DRIVER')) {
      router.push('/login')
    }
    if (token && orderId) fetchOrder()
  }, [isLoading, user, token, orderId, fetchOrder, router])

  const handleAction = async (action: 'start' | 'arrive' | 'pickup' | 'complete') => {
    if (!token || !order) return

    if (action === 'complete') {
      const confirmed = window.confirm('確認已抵達目的地？行程將標記為完成並計入帳務。')
      if (!confirmed) return
    }

    setActionLoading(true)
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (data.success) {
        setOrder(prev => prev ? { ...prev, ...data.data } : null)

        if (action === 'complete') {
          setShowCompleteHint(true)
          setTimeout(() => {
            setShowCompleteHint(false)
            router.push('/dashboard/driver?tab=myorders')
          }, 2000)
        }
      } else {
        alert(data.error || '操作失敗')
      }
    } catch {
      alert('網路錯誤')
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancel = async () => {
    if (!token || !order) return
    const cancelFee = Math.floor(order.price * 0.1)
    const confirmed = window.confirm(
      `確定要退單嗎？退單將扣除 NT$${order.price} 的 10%，共 ${cancelFee} 點`
    )
    if (!confirmed) return

    setActionLoading(true)
    try {
      const res = await fetch(`/api/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) {
        alert(`退單成功`)
        router.push('/dashboard/driver?tab=myorders')
      } else {
        alert(data.error || '退單失敗')
      }
    } catch {
      alert('網路錯誤')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading || !order) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-[#F59E0B] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const scheduledDate = new Date(order.scheduledTime)
  const orderNo = formatOrderNo(scheduledDate, order.orderSeq)
  const typeColor = TYPE_COLORS[order.type] ?? { bg: '#F4EFE9', text: '#717171' }
  const orderTypeLabel = TYPE_LABELS[order.type] ?? order.type
  const isBoat = order.type === 'pickup_boat' || order.type === 'dropoff_boat'
  const isPickup = order.type === 'pickup'
  const pickupLabel = isBoat ? '出發港' : isPickup ? '桃園機場' : '上車'
  const dropoffLabel = isBoat ? '目的地港' : isPickup ? '目的地' : '桃園機場'

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#1C1917]">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#FAF7F2]/95 backdrop-blur-xl border-b border-[#E7E5E4]">
        <div className="flex items-center h-14 px-4">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-[#717171] hover:text-[#222222] transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">返回</span>
          </button>
        </div>
      </div>

      {/* 完成提示 */}
      {showCompleteHint && (
        <div className="fixed top-0 left-0 right-0 bg-[#008A05] text-white text-center py-3 text-sm font-bold z-50 animate-slideDown">
          行程已完成，2 秒後返回列表
        </div>
      )}

      <main className="px-4 py-6 space-y-5">
        {/* 單號橫幅 */}
        <div className="w-full bg-[#1C1917] rounded-xl px-4 py-3">
          <span className="text-white text-[18px] font-bold font-mono-nums">
            #{orderNo}
          </span>
        </div>

        {/* 進度條 */}
        <div className="bg-white rounded-xl p-5 border border-[#DDDDDD]">
          <ProgressBar status={order.status} size="md" showLabel={true} animateNext={true} />
        </div>

        {/* 行程資訊卡片 */}
        <div className="bg-white rounded-xl p-5 border border-[#DDDDDD] space-y-4">
          {/* 類型 + 狀態 */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="inline-flex items-center px-3 py-1.5 text-[15px] font-bold font-mono-nums rounded"
              style={{ backgroundColor: typeColor.bg, color: typeColor.text }}
            >
              {orderTypeLabel}
            </span>
            <span className="inline-flex items-center px-3 py-1.5 text-[15px] font-bold font-mono-nums rounded bg-[#F4EFE9] text-[#717171]">
              {order.vehicle === 'small' ? '小車' : order.vehicle === 'suv' ? '休旅' : order.vehicle === 'van9' ? '9人座' : order.vehicle === 'any' ? '任意' : order.vehicle === 'any_r' ? '任意R' : '待確認'}
            </span>
            {order.kenichiRequired && (
              <span className="inline-flex items-center px-3 py-1.5 text-[15px] font-bold font-mono-nums rounded bg-[#F3E8FF] text-[#6B21A8]">
                肯驛
              </span>
            )}
          </div>

          {/* 時間 */}
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#717171]" />
            <span className="text-[15px] font-bold font-mono-nums text-[#222222]">
              {format(scheduledDate, 'M/dd (E)', { locale: zhTW })} {format(scheduledDate, 'HH:mm')}
            </span>
          </div>

          {/* 起訖點 */}
          <div className="flex items-start gap-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full flex-shrink-0 mt-1" style={{ backgroundColor: typeColor.bg === '#F4EFE9' ? '#FF385C' : typeColor.bg }} />
              <div>
                <p className="text-[11px] text-[#717171] uppercase tracking-wider">{pickupLabel}</p>
                <p className="text-[16px] font-bold text-[#222222]">{order.pickupLocation}</p>
              </div>
            </div>
            <span className="text-[20px] font-bold text-[#DDDDDD] mt-1 flex-shrink-0">→</span>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#DDDDDD] flex-shrink-0 mt-1" />
              <div>
                <p className="text-[11px] text-[#717171] uppercase tracking-wider">{dropoffLabel}</p>
                <p className="text-[16px] font-bold text-[#222222]">{order.dropoffLocation}</p>
              </div>
            </div>
          </div>

          {/* 金額 */}
          <div>
            <span className="text-[32px] font-bold font-mono-nums text-[#FF385C]">
              NT${order.price.toLocaleString()}
            </span>
          </div>

          {/* 乘客資訊 */}
          <div className="flex items-center gap-4 text-[13px] text-[#717171]">
            <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> {order.passengerName}</span>
            <span className="flex items-center gap-1"><Package className="w-3.5 h-3.5" /> {order.passengerCount}人 / {order.luggageCount}行李</span>
          </div>

          {/* 電話 + 航班 */}
          <div className="flex items-center gap-4 text-[13px] text-[#717171]">
            <a
              href={`tel:${order.passengerPhone}`}
              className="flex items-center gap-1 text-[#0C447C] font-bold hover:underline"
            >
              <Phone className="w-3.5 h-3.5" />
              {order.passengerPhone}
            </a>
            {order.flightNumber && (
              <span className="bg-[#F4EFE9] px-2 py-1 rounded font-mono-nums text-[13px] text-[#717171] font-bold">
                {order.flightNumber}
              </span>
            )}
          </div>

          {/* 備註 */}
          {order.note && (
            <div className="text-[13px] text-[#717171] bg-[#FFF3E0] border border-[#FFE0B2] p-2.5 rounded-lg">
              {order.note}
            </div>
          )}

          {/* 派單方 */}
          {order.dispatcher?.user?.name && (
            <div className="text-[12px] text-[#AAAAAA]">
              派單方：{order.dispatcher.user.name}
            </div>
          )}
        </div>

        {/* 按鈕列 */}
        <div className="bg-white rounded-xl p-5 border border-[#DDDDDD]">
          <OrderDetailActions
            status={order.status}
            scheduledTime={order.scheduledTime}
            onAction={handleAction}
            onCancel={handleCancel}
            loading={actionLoading}
          />
        </div>
      </main>
    </div>
  )
}
```

### Part B: 列表頁加入進入手勢

- [ ] **Step 2: 修改司機端列表頁，讓 ACCEPTED 卡片可點擊進詳情**

檔案：`src/app/dashboard/driver/page.tsx:1137-1163`

原本的訂單卡片渲染（第 1137-1163 行）：
```tsx
{filteredOrders.map(order => (
  <div key={order.id} className="relative">
    <OrderCard order={order} showActions={true} compact={true} />
    ...
  </div>
))}
```

改為：在 `<OrderCard>` 外層包一個 `<Link>` 或加 `onClick`：

```tsx
{filteredOrders.map(order => (
  <div key={order.id} className="relative">
    <div
      onClick={() => router.push(`/dashboard/driver/order/${order.id}`)}
      className="cursor-pointer"
    >
      <OrderCard order={order} showActions={true} compact={true} />
    </div>
    {order.status === 'ACCEPTED' && (
      <div className="mt-2 flex gap-2">
        <button
          onClick={() => router.push(`/dashboard/driver/order/${order.id}`)}
          className="flex-1 py-2 px-3 bg-[#0C447C] text-white text-[13px] font-bold rounded-lg hover:bg-[#0a3a6e] transition-colors"
        >
          執行行程
        </button>
        <button
          onClick={() => handleCancelOrder(order.id)}
          disabled={actionLoading === order.id}
          className="flex-1 py-2 px-3 bg-white border border-[#E24B4A] text-[#E24B4A] text-[13px] font-bold rounded-lg hover:bg-[#FCEBEB] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {actionLoading === order.id ? '處理中...' : '退單'}
        </button>
      </div>
    )}
  </div>
))}
```

注意：原本有智慧排單按鈕的邏輯也保留，但只有在 ACCEPTED 狀態且行程前 ≥3 小時時顯示（因為智慧排單是排未來的銜接）。

- [ ] **Step 3: 驗證 TypeScript 編譯**

```bash
npm run build 2>&1 | head -40
```

預期：無錯誤。若有錯誤，檢查 `router` 是否已 import（第 1-2 行）。

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/driver/order/\[id\]/page.tsx src/app/dashboard/driver/page.tsx
git commit -m "feat(driver): 司機端訂單詳情頁

- 新增 /dashboard/driver/order/[id] 全螢幕訂單詳情頁
- 顯示進度條、4鍵按鈕、乘客電話可撥號
- 列表頁 ACCEPTED 卡片加入「執行行程」按鈕
- 客下完成後 2 秒自動返回列表

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 6: 派單方端 — 進度條燈號

**Files:**
- Modify: `src/components/dispatcher/DispatcherOrderCard.tsx`
- Modify: `src/app/dashboard/dispatcher/page.tsx`

### Part A: DispatcherOrderCard 加入進度條

- [ ] **Step 1: 修改 DispatcherOrderCard — 加入 ProgressBar**

檔案：`src/components/dispatcher/DispatcherOrderCard.tsx`

在 card 內某個位置（第 60 行之後）新增進度條。只對已接單的訂單（status 含 ACCEPTED/IN_PROGRESS/ARRIVED/PICKED_UP/COMPLETED）顯示。

在 `<div className="p-4">` 之後、狀態顯示區域加入：

```tsx
{/* 進度條（僅司機已接單後顯示） */}
{['ACCEPTED', 'IN_PROGRESS', 'ARRIVED', 'PICKED_UP', 'COMPLETED'].includes(order.status) && (
  <div className="px-4 pb-3 -mt-1">
    <ProgressBar status={order.status} size="sm" showLabel={true} animateNext={true} />
    {order.driver && (
      <p className="text-[11px] text-[#717171] mt-1 text-center">
        司機：{order.driver.user.name}
      </p>
    )}
  </div>
)}
```

需要 import ProgressBar：
```tsx
import { ProgressBar } from '@/components/driver/ProgressBar'
```

- [ ] **Step 2: 驗證編譯**

```bash
npm run build 2>&1 | head -40
```

### Part B: Dispatcher SSE 接收

- [ ] **Step 3: 修改派單方頁面 — 接收 SSE 更新燈號**

檔案：`src/app/dashboard/dispatcher/page.tsx`

在 `useEffect` 中（第 170 行附近）加入 SSE 連線：

```tsx
// 派單方 SSE 即時接收狀態更新
useEffect(() => {
  if (!token || user?.role !== 'DISPATCHER') return

  const es = new EventSource('/api/dispatchers/events')
  es.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      if (data.type === 'ORDER_STATUS_CHANGE') {
        // 更新對應卡片的燈號狀態
        setOrders(prev => prev.map(order =>
          order.id === data.orderId
            ? {
                ...order,
                status: data.status,
                startedAt: data.startedAt,
                arrivedAt: data.arrivedAt,
                pickedUpAt: data.pickedUpAt,
                completedAt: data.completedAt,
              }
            : order
        ))
      }
    } catch {}
  }
  es.onerror = () => es.close()
  return () => es.close()
}, [token, user?.role])
```

需要確認 `setOrders` 存在且 state 名稱正確。檢查現有 `page.tsx` 中的 state 名稱（可能叫 `orders` 或 `localOrders`）。

- [ ] **Step 4: 驗證編譯**

```bash
npm run build 2>&1 | head -40
```

- [ ] **Step 5: Commit**

```bash
git add src/components/dispatcher/DispatcherOrderCard.tsx src/app/dashboard/dispatcher/page.tsx
git commit -m "feat(dispatcher): 行控中心卡片加入進度條燈號

- 已接單訂單顯示 4 格進度條（取代純文字狀態）
- 支援 SSE 即時接收司機狀態更新
- 燈號閃爍提示下一狀態即將亮起

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 7: 整合測試

**Files:**
- Test manually in browser

- [ ] **Step 1: 本機啟動開發伺服器**

```bash
npm run dev
```

在瀏覽器中：

1. 以司機身份登入 `driver1@test.com`
2. 進入「我的行程」
3. 點擊一張 ACCEPTED 狀態的卡片，確認進入了詳情頁
4. 確認進度條顯示正確（只有第一個燈亮）
5. 確認按鈕邏輯正確（行程前 <3 小時，「開始」可點）

6. 以派單方身份登入 `dispatcher1@test.com`
7. 進入行控中心
8. 確認已接單的卡片有進度條燈號

- [ ] **Step 2: Commit 最終變更**

```bash
git add -A
git commit -m "feat: 司機行程狀態更新功能完成

- 司機端：全螢幕訂單詳情頁、4鍵依序執行、乘客電話可撥號
- 派單方：行控中心進度條燈號即時同步
- API：狀態端點 + SSE 推播
- DB：新增時間戳記欄位

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

- [ ] **Step 3: 更新 CURRENT_WORK.md**

在 CURRENT_WORK.md 的「近期進度」最上方新增一項：

```
### [完成] 司機行程狀態更新（2026-04-04）
- 司機端：全螢幕訂單詳情頁、4鍵流程（開始→抵達→客上→客下）
- 按鈕邏輯：3小時門檻、嚴格依序、客下需確認
- 派單方：行控中心卡片進度條燈號、SSE 即時同步
- API：POST /api/orders/[id]/status、GET /api/dispatchers/events
- 資料庫：startedAt/arrivedAt/pickedUpAt 時間戳記
```

然後：
```bash
git add CURRENT_WORK.md && git commit -m "docs: 更新 CURRENT_WORK.md 加入司機行程狀態更新" && git push
```

---

## 自我審查清單

### Spec 覆蓋檢查

| 規格需求 | 實作位置 |
|---------|---------|
| 司機 4 鍵依序執行 | Task 4 (OrderDetailActions) + Task 5 |
| 3 小時門檻 | Task 2 Part B (status route) + Task 4 |
| 客下確認視窗 | Task 5 (handleAction) |
| 客下完成後 2 秒返回 | Task 5 (setTimeout) |
| 進度條（司機端） | Task 4 (ProgressBar) + Task 5 |
| 乘客電話可撥號 | Task 5 (tel: link) |
| 派單方進度條燈號 | Task 6 Part A (DispatcherOrderCard) |
| SSE 即時同步 | Task 3 + Task 6 Part B |
| 燈號閃爍下一狀態 | Task 4 (animateNext prop) |
| 時間戳記寫入 | Task 2 (updateData) |
| 完成後歸入帳務 | Task 2 (Transaction 建立) |

### 佔位符檢查

無任何 TBD / TODO / fill in details 等佔位符。

### 類型一致性

- `actionMap`: `start` → `IN_PROGRESS` → `ARRIVED` → `PICKED_UP` → `COMPLETED`
- `validTransitions`（PATCH 和 POST）：皆為 ACCEPTED→IN_PROGRESS→ARRIVED→PICKED_UP→COMPLETED
- `ProgressBar` 的 `isStepLit`：正確映射每個狀態到燈號亮起
- `OrderStatus` type：新增 PICKED_UP

---

## 執行選項

**Plan complete and saved to `docs/superpowers/plans/2026-04-04-driver-status-flow.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
