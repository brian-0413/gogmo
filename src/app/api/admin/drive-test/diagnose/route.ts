import { NextRequest, NextResponse } from 'next/server'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxuAYUk0IX_yUE5Igu3dk4sVeKtlCwHjVWtLdzhNuKMFf6JDv-iRpIc_K4kyBS0dt8pfQ/exec'

// GET /api/admin/drive-test/diagnose — 診斷 Drive API 設定問題
export async function GET(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json<ApiResponse>({ success: false, error: '未授權' }, { status: 401 })
  const user = await getUserFromToken(token)
  if (!user || user.role !== 'ADMIN') return NextResponse.json<ApiResponse>({ success: false, error: '僅限管理員' }, { status: 403 })

  const result: Record<string, unknown> = {}

  // Test Apps Script connection
  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })
    const text = await res.text()
    result.appsScriptStatus = res.status
    result.appsScriptResponse = text
  } catch (e) {
    result.appsScriptStatus = 'ERROR'
    result.appsScriptError = e instanceof Error ? e.message : String(e)
  }

  return NextResponse.json<ApiResponse>({ success: true, data: result }, { status: 200 })
}
