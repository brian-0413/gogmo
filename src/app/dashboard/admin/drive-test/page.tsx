'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { Shield, LogOut, Upload, CheckCircle, XCircle, Loader2, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'

const DOC_TYPES = [
  { type: 'DRIVER_LICENSE', label: '駕照', color: 'bg-blue-50 border-blue-200 hover:bg-blue-100' },
  { type: 'VEHICLE_REGISTRATION', label: '行照', color: 'bg-green-50 border-green-200 hover:bg-green-100' },
  { type: 'INSURANCE', label: '保險證', color: 'bg-orange-50 border-orange-200 hover:bg-orange-100' },
]

interface UploadResult {
  success: boolean
  fileName?: string
  fileUrl?: string
  error?: string
  docType: string
}

export default function AdminDriveTestPage() {
  const { user, token, isLoading, logout } = useAuth()
  const router = useRouter()
  const [results, setResults] = useState<UploadResult[]>([])
  const [uploading, setUploading] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'ADMIN')) {
      router.push('/login')
    }
  }, [user, isLoading, router])

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-[#F59E0B] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  async function handleUpload(docType: string) {
    if (!selectedFile) {
      alert('請先選擇一個檔案')
      return
    }
    if (!token) return

    setUploading(docType)
    const fd = new FormData()
    fd.append('file', selectedFile)
    fd.append('type', docType)

    try {
      const res = await fetch('/api/admin/drive-test/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      const data = await res.json()

      setResults(prev => [
        { success: data.success, fileName: data.data?.fileName, fileUrl: data.data?.fileUrl, error: data.error, docType },
        ...prev,
      ])
    } catch {
      setResults(prev => [
        { success: false, error: '網路錯誤', docType },
        ...prev,
      ])
    }
    setUploading(null)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setSelectedFile(f)
    if (f) {
      setResults([])
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#222222]">
      {/* Header */}
      <header className="bg-[#FAF8F5] border-b border-[#DDDDDD] sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#1C1917] flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <span className="text-[18px] font-medium text-[#222222]">管理員後台</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-[#717171]">{user.name}</span>
              <Button variant="outline" size="sm" onClick={logout} className="text-[13px]">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <div className="bg-[#FAF8F5] border-b border-[#DDDDDD]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex gap-2 py-3">
            <Link href="/dashboard/admin"
              className="px-4 py-2 text-sm rounded-full transition-colors flex items-center gap-2 bg-transparent text-[#717171] border border-[#DDDDDD] hover:bg-[#F7F7F7]">
              費率設定
            </Link>
            <Link href="/dashboard/admin/reviews"
              className="px-4 py-2 text-sm rounded-full transition-colors flex items-center gap-2 bg-transparent text-[#717171] border border-[#DDDDDD] hover:bg-[#F7F7F7]">
              帳號審核
            </Link>
            <Link href="/dashboard/admin/users"
              className="px-4 py-2 text-sm rounded-full transition-colors flex items-center gap-2 bg-transparent text-[#717171] border border-[#DDDDDD] hover:bg-[#F7F7F7]">
              使用者管理
            </Link>
            <Link href="/dashboard/admin/drive-test"
              className="px-4 py-2 text-sm rounded-full transition-colors flex items-center gap-2 bg-[#FF385C] text-white">
              <Upload className="w-3.5 h-3.5" />
              Storage 測試
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-[20px] font-medium text-[#222222]">Storage 上傳測試區</h1>
          <p className="text-[13px] text-[#717171] mt-1">
            選擇一個檔案，點選下方按鈕測試上傳到 Supabase Storage。
          </p>
        </div>

        {/* 檔案選擇 */}
        <div className="bg-white border border-[#DDDDDD] rounded-xl p-6 mb-4">
          <div className="flex items-center gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              選擇檔案
            </Button>
            <div className="flex-1">
              {selectedFile ? (
                <span className="text-[13px] text-[#222222]">
                  已選擇：<span className="font-medium">{selectedFile.name}</span>
                  <span className="text-[#717171] ml-2">
                    ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </span>
                </span>
              ) : (
                <span className="text-[13px] text-[#717171]">尚未選擇檔案（支援 JPG、PNG、PDF，最大 5MB）</span>
              )}
            </div>
          </div>
        </div>

        {/* 上傳按鈕 */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {DOC_TYPES.map(({ type, label, color }) => (
            <button
              key={type}
              disabled={uploading !== null}
              onClick={() => handleUpload(type)}
              className={`
                flex flex-col items-center justify-center gap-2 py-6 px-4 rounded-xl border-2 transition-all
                disabled:opacity-50 disabled:cursor-not-allowed
                ${color}
              `}
            >
              {uploading === type ? (
                <Loader2 className="w-8 h-8 text-[#717171] animate-spin" />
              ) : (
                <Upload className="w-8 h-8 text-[#717171]" />
              )}
              <span className="text-[15px] font-medium text-[#222222]">{label}</span>
            </button>
          ))}
        </div>

        {/* 結果列表 */}
        {results.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-[15px] font-medium text-[#222222]">上傳結果</h2>
            {results.map((r, i) => (
              <div key={i} className="bg-white border border-[#DDDDDD] rounded-xl p-4">
                <div className="flex items-start gap-3">
                  {r.success ? (
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-medium text-[#222222]">
                        {DOC_TYPES.find(d => d.type === r.docType)?.label ?? r.docType}
                      </span>
                      <span className={`text-[12px] px-2 py-0.5 rounded-full ${
                        r.success ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                      }`}>
                        {r.success ? '成功' : '失敗'}
                      </span>
                    </div>
                    {r.success && r.fileName && (
                      <p className="text-[12px] text-[#717171] mt-1 truncate">檔名：{r.fileName}</p>
                    )}
                    {r.success && r.fileUrl && (
                      <a
                        href={r.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[12px] text-[#FF385C] hover:underline mt-1"
                      >
                        在瀏覽器開啟
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {r.error && (
                      <p className="text-[12px] text-red-500 mt-1">錯誤：{r.error}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
