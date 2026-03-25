import { NextRequest, NextResponse } from 'next/server'
import { getUserFromToken } from '@/lib/auth'
import { parseOrderText, validateParsedOrder } from '@/lib/ai'
import { ApiResponse } from '@/types'

// POST /api/orders/parse - AI parse order text
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
    if (!user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '未授權' },
        { status: 401 }
      )
    }

    if (user.role !== 'DISPATCHER') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '只有車頭可以使用此功能' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { text } = body

    if (!text || typeof text !== 'string') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '請提供訂單文字' },
        { status: 400 }
      )
    }

    const parsed = parseOrderText(text)
    const validation = validateParsedOrder(parsed)

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        parsed,
        validation,
      },
    })
  } catch (error) {
    console.error('Parse order error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '解析失敗' },
      { status: 500 }
    )
  }
}
