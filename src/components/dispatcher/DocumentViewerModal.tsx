'use client'
import { useState, useEffect } from 'react'
import { X, FileText, Loader2, ExternalLink } from 'lucide-react'

interface Document {
  id: string
  type: string
  fileUrl: string | null
  fileName: string
  mimeType: string
  uploadFailed: boolean
}

interface DocumentViewerModalProps {
  driverId: string
  driverName: string
  licensePlate: string
  token: string
  viewerRole: 'DISPATCHER' | 'ADMIN'
  onClose: () => void
}

const TAB_LABELS: Record<string, string> = {
  VEHICLE_REGISTRATION: '行照',
  DRIVER_LICENSE: '駕照',
  INSURANCE: '保險證',
  ID_CARD: '身分證',
  BUSINESS_REGISTRATION: '商業登記',
}

// 派單方只能看司機三證
const DISPATCHER_TABS = ['VEHICLE_REGISTRATION', 'DRIVER_LICENSE', 'INSURANCE']
// 管理員可以看到全部
const ADMIN_TABS = ['VEHICLE_REGISTRATION', 'DRIVER_LICENSE', 'INSURANCE', 'ID_CARD', 'BUSINESS_REGISTRATION']

function getTabs(role: string) {
  return role === 'DISPATCHER' ? DISPATCHER_TABS : ADMIN_TABS
}

export function DocumentViewerModal({ driverId, driverName, licensePlate, token, viewerRole, onClose }: DocumentViewerModalProps) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const tabs = getTabs(viewerRole)

  useEffect(() => {
    fetch(`/api/drivers/${driverId}/documents`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => {
        if (d.success) setDocuments(d.data.documents || [])
        else setError(d.error || '載入失敗')
      })
      .catch(() => setError('網路錯誤'))
      .finally(() => setLoading(false))
  }, [driverId, token])

  const getDoc = (type: string) => documents.find(d => d.type === type)

  const firstAvailableTab = tabs.find(t => {
    const doc = getDoc(t)
    return doc && !doc.uploadFailed && doc.fileUrl
  }) || tabs[0]
  const [currentTab, setCurrentTab] = useState(firstAvailableTab)
  const currentDoc = getDoc(currentTab)

  const isImage = currentDoc?.mimeType?.startsWith('image/')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#DDDDDD]">
          <div>
            <h3 className="text-[16px] font-bold text-[#222222]">司機證件</h3>
            <p className="text-[12px] text-[#717171]">{driverName} · {licensePlate}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[#F4EFE9] rounded-lg transition-colors">
            <X className="w-5 h-5 text-[#717171]" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#DDDDDD]">
          {tabs.map(type => {
            const doc = getDoc(type)
            const isActive = type === currentTab
            const isEmpty = !doc || doc.uploadFailed || !doc.fileUrl
            return (
              <button
                key={type}
                onClick={() => !isEmpty && setCurrentTab(type)}
                className={`flex-1 py-3 text-[13px] font-medium border-b-2 transition-colors
                  ${isActive ? 'border-[#FF385C] text-[#FF385C]' : isEmpty ? 'text-[#CCCCCC] cursor-not-allowed' : 'border-transparent text-[#717171] hover:text-[#222222]'}`}
                disabled={isEmpty}
              >
                {TAB_LABELS[type] || type}
              </button>
            )
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="w-8 h-8 animate-spin text-[#717171]" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2">
              <p className="text-[#E24B4A] text-[14px]">{error}</p>
            </div>
          ) : !currentDoc || currentDoc.uploadFailed || !currentDoc.fileUrl ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <FileText className="w-12 h-12 text-[#DDDDDD]" />
              <p className="text-[#717171] text-[14px]">
                {currentDoc?.uploadFailed ? '文件上傳失敗，請通知司機重新上傳' : '尚未上傳'}
              </p>
            </div>
          ) : isImage ? (
            <img
              src={currentDoc.fileUrl}
              alt={TAB_LABELS[currentTab]}
              className="w-full h-auto max-h-[60vh] object-contain rounded-lg"
            />
          ) : (
            // PDF 或其他類型在新視窗開啟
            <div className="flex flex-col items-center justify-center h-48 gap-4">
              <FileText className="w-12 h-12 text-[#DDDDDD]" />
              <p className="text-[#717171] text-[14px]">文件預覽需在新視窗開啟</p>
              <a href={currentDoc.fileUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-[#0C447C] text-white text-[13px] rounded-lg hover:bg-[#0A3570] transition-colors">
                <ExternalLink className="w-4 h-4" />
                在新視窗開啟
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}