import { NextRequest, NextResponse } from 'next/server'
import { getUserFromToken } from '@/lib/auth'
import { parseBatchOrdersLLM } from '@/lib/ai'
import { ApiResponse } from '@/types'

// POST /api/orders/parse - Parse order text using LLM (Claude Haiku)
// API Key 只存在後端，不會暴露給前端
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
    const { text, defaults } = body

    if (!text || typeof text !== 'string') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '請提供訂單文字' },
        { status: 400 }
      )
    }

    const result = await parseBatchOrdersLLM(text, defaults || {})

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        orders: result.orders || [],
        count: (result.orders || []).length,
        rawResponse: result.rawResponse,
      },
    })
  } catch (error: any) {
    console.error('Parse order error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: error.message || '解析失敗' },
      { status: 500 }
    )
  }
}
