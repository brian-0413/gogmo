import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { encryptPayuni, getPayuniEndpoint } from '@/lib/payuni'
import { ApiResponse } from '@/types'

// POST /api/drivers/topup/create - 建立加值訂單
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
    if (!user || user.role !== 'DRIVER' || !user.driver) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '找不到司機資料' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { amount, method } = body as { amount: number; method: 'credit' | 'transfer' }

    // 驗證 amount
    if (!amount || typeof amount !== 'number' || amount < 100) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '加值金額最低 100 元' },
        { status: 400 }
      )
    }

    // 驗證 method
    if (!method || !['credit', 'transfer'].includes(method)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '加值方式只能是 credit 或 transfer' },
        { status: 400 }
      )
    }

    const driverId = user.driver.id

    if (method === 'credit') {
      // credit: 計算含 3% 手續費的最終金額
      const finalAmount = Math.ceil(amount * 1.03)

      // 建立 Topup record
      const topup = await prisma.topup.create({
        data: {
          driverId,
          amount: finalAmount,
          method: 'credit',
          status: 'pending',
        },
      })

      // 呼叫 PAYUNi 加密（driver.user 需另外查）
      const driverWithUser = await prisma.driver.findUnique({
        where: { id: driverId },
        include: { user: true },
      })
      const merId = process.env.PAYUNI_MER_ID || ''
      const orderNo = `TOP${topup.id.slice(-12).toUpperCase()}`
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

      const encryptData = encryptPayuni({
        MerID:        merId,
        MerTradeNo:   orderNo,
        TradeAmt:     String(finalAmount),
        Timestamp:    String(Math.floor(Date.now() / 1000)),
        ProdDesc:     `司機加值 ${amount} 元（含3%手續費）`,
        BuyerName:    driverWithUser?.user.name || user.name,
        BuyerMail:    user.email,
        BuyerPhone:   user.phone,
        ReturnURL:    `${appUrl}/dashboard/driver`,
        NotifyURL:    `${appUrl}/api/payuni/topup/notify`,
        CardInst:     '0',
      })

      return NextResponse.json<ApiResponse>({
        success: true,
        data: {
          topupId: topup.id,
          payuniUrl: getPayuniEndpoint(),
          formData: {
            MerID: merId,
            Version: '1.0',
            EncryptInfo: encryptData.EncryptInfo,
            HashInfo: encryptData.HashInfo,
          },
          finalAmount,
        },
      })
    } else {
      // transfer: 建立 Topup record（待客服確認）
      const topup = await prisma.topup.create({
        data: {
          driverId,
          amount,
          method: 'transfer',
          status: 'pending',
        },
      })

      return NextResponse.json<ApiResponse>({
        success: true,
        data: {
          topupId: topup.id,
          method: 'transfer',
          amount,
        },
      })
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error('Create topup error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: `伺服器錯誤: ${errMsg}` },
      { status: 500 }
    )
  }
}
