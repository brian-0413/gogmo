import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { decryptPayuni } from '@/lib/payuni'

// POST /api/payuni/topup/notify
// PAYUNi server-to-server notify callback
export async function POST(request: NextRequest) {
  try {
    // PAYUNi 可能以 application/x-www-form-urlencoded 或 JSON 格式傳送
    let encryptInfo = ''

    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      encryptInfo = formData.get('EncryptInfo') as string
    } else {
      const body = await request.json()
      encryptInfo = body.EncryptInfo || body.encryptInfo || ''
    }

    if (!encryptInfo) {
      console.error('[PAYUNI] No EncryptInfo in notify')
      return new NextResponse('FAIL', { status: 400 })
    }

    // 解密
    const decrypted = decryptPayuni(encryptInfo)
    if (process.env.NODE_ENV !== 'production') console.log('[PAYUNI] Topup notify decrypted:', decrypted)

    const { Status, MerchantOrderNo, TradeAmt, TradeNo } = decrypted

    // Status === '1' 表示付款成功
    if (Status !== '1') {
      if (process.env.NODE_ENV !== 'production') console.log(`[PAYUNI] Topup trade ${MerchantOrderNo} status=${Status}, not success`)
      return new NextResponse('OK')
    }

    // MerchantOrderNo 格式: TOP + topup.id 的後 12 碼
    // 從 MerchantOrderNo 反推 topup id（截掉前綴 TOP）
    const topupIdCandidate = MerchantOrderNo.slice(3)
    const topup = await prisma.topup.findFirst({
      where: {
        id: { endsWith: topupIdCandidate },
        status: 'pending',
        method: 'credit',
      },
      include: { driver: true },
    })

    if (!topup) {
      console.error(`[PAYUNI] Topup record not found for order: ${MerchantOrderNo}`)
      return new NextResponse('FAIL', { status: 404 })
    }

    // 已經處理過（防止重複通知）
    if (topup.status === 'paid') {
      if (process.env.NODE_ENV !== 'production') console.log(`[PAYUNI] Topup ${topup.id} already paid, skip`)
      return new NextResponse('OK')
    }

    // 更新 Topup status、Driver balance、Transaction 記錄（原子性操作）
    await prisma.$transaction([
      prisma.topup.update({
        where: { id: topup.id },
        data: {
          status: 'paid',
          paidAt: new Date(),
          payuniTradeNo: TradeNo || '',
        },
      }),
      prisma.driver.update({
        where: { id: topup.driverId },
        data: {
          balance: { increment: topup.amount },
        },
      }),
      prisma.transaction.create({
        data: {
          driverId: topup.driverId,
          topupId: topup.id,
          amount: topup.amount,
          type: 'RECHARGE',
          status: 'SETTLED',
          settledAt: new Date(),
          description: `信用卡加值（${TradeAmt}元，含3%手續費）`,
        },
      }),
    ])

    if (process.env.NODE_ENV !== 'production') console.log(`[PAYUNI] Topup ${topup.id} completed: +${topup.amount} to driver ${topup.driverId}`)

    return new NextResponse('OK')
  } catch (error) {
    console.error('[PAYUNI] Topup notify error:', error)
    return new NextResponse('FAIL', { status: 500 })
  }
}
