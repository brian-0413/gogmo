'use client'
import { useState, useRef } from 'react'

export interface UploadedFile {
  type: string
  file: File
}

interface RegisterStep5Props {
  role: 'DRIVER' | 'DISPATCHER'
  uploadedFiles: UploadedFile[]
  onChange: (files: UploadedFile[]) => void
  onNext: () => void
  onBack: () => void
}

const DRIVER_UPLOADS = [
  { type: 'VEHICLE_REGISTRATION', label: '行照（行車執照）', required: true },
  { type: 'DRIVER_LICENSE', label: '駕照（汽車駕駛執照）', required: true },
  { type: 'INSURANCE', label: '乘客險 500 萬（含）以上保險證', required: true },
]

const DISPATCHER_UPLOADS = [
  { type: 'ID_CARD', label: '負責人身分證（正面）', required: true },
  { type: 'BUSINESS_REGISTRATION', label: '公司/商業登記核准公文', required: true },
]

export function RegisterStep5({ role, uploadedFiles, onChange, onNext, onBack }: RegisterStep5Props) {
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const uploadItems = role === 'DRIVER' ? DRIVER_UPLOADS : DISPATCHER_UPLOADS

  const handleFileSelect = (type: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    onChange(
      uploadedFiles.filter(f => f.type !== type).concat({ type, file })
    )
  }

  const isFileUploaded = (type: string) => uploadedFiles.some(f => f.type === type)
  const allRequiredUploaded = uploadItems.filter(i => i.required).every(i => isFileUploaded(i.type))

  const getFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="space-y-4">
      <h2 className="text-[18px] font-medium text-[#222222] text-center">上傳證件</h2>
      <p className="text-[13px] text-[#717171] text-center">
        {role === 'DRIVER' ? '請上傳您的行照、駕照及保險證' : '請上傳負責人證件及公司登記文件'}
      </p>

      <div className="space-y-3 pt-2">
        {uploadItems.map(item => {
          const uploaded = uploadedFiles.find(f => f.type === item.type)
          const isUploaded = !!uploaded

          return (
            <div key={item.type} className="border border-[#DDDDDD] rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[13px] text-[#222222] font-normal">
                  {item.label}
                  {item.required && <span className="text-[#E24B4A] ml-0.5">*</span>}
                </label>
                {isUploaded && (
                  <div className="flex items-center gap-1 text-[#22C55E]">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-[11px]">已選擇</span>
                  </div>
                )}
              </div>

              <input
                ref={el => { fileInputRefs.current[item.type] = el }}
                type="file"
                accept="image/*,.pdf"
                onChange={e => handleFileSelect(item.type, e)}
                className="hidden"
              />

              {!isUploaded ? (
                <button
                  type="button"
                  onClick={() => fileInputRefs.current[item.type]?.click()}
                  className="w-full border-2 border-dashed border-[#DDDDDD] rounded-lg py-3 text-[13px] text-[#717171] hover:border-[#0C447C] hover:text-[#0C447C] transition-colors"
                >
                  選擇檔案
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-2 bg-[#F7F7F7] rounded-lg px-3 py-2">
                    <svg className="w-4 h-4 text-[#717171] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-[#222222] truncate">{uploaded.file.name}</p>
                      <p className="text-[10px] text-[#B0B0B0]">{getFileSize(uploaded.file.size)}</p>
                    </div>
                    <span className="text-[10px] text-[#FF9800] bg-[#FFF8E1] px-1.5 py-0.5 rounded">待上傳</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRefs.current[item.type]?.click()}
                    className="text-[11px] text-[#717171] hover:text-[#222222] transition-colors"
                  >
                    重新選擇
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 border border-[#DDDDDD] text-[#717171] hover:bg-[#F7F7F7] h-11 rounded-lg text-sm transition-colors"
        >
          上一步
        </button>
        <button
          onClick={onNext}
          className="flex-1 bg-[#FF385C] hover:bg-[#D70466] text-white font-medium h-11 rounded-lg text-sm transition-colors"
        >
          下一步
        </button>
      </div>
    </div>
  )
}
