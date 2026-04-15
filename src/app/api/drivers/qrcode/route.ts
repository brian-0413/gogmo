/**
 * GET /api/drivers/qrcode — 取得司機的 QR code 資料
 * 包含下載連結和分享資訊
 */
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromToken } from '@/lib/auth'

// GET /api/drivers/qrcode
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    const user = token ? await getUserFromToken(token) : null
    if (!user || user.role !== 'DRIVER') {
      return NextResponse.json({ success: false, error: '未授權' }, { status: 401 })
    }
    if (!user.driver) {
      return NextResponse.json({ success: false, error: '找不到司機資料' }, { status: 404 })
    }

    const driverId = user.driver.id
    const bookingUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://gogmo.app'}/book/${driverId}`
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(bookingUrl)}&format=png&margin=10`

    return NextResponse.json({
      success: true,
      data: {
        driverId,
        bookingUrl,
        qrCodeUrl,
      },
    })
  } catch {
    return NextResponse.json({ success: false, error: '伺服器錯誤' }, { status: 500 })
  }
}
