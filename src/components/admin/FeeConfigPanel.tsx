'use client'

import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, CheckCircle, Loader2, Shield } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface FeeConfig {
  PLATFORM_FEE_RATE: number
  CANCELLATION_FEE_RATE: number
  TRANSFER_FEE_RATE: number
  MIN_BONUS_POINTS: number
  isOverridden: boolean
}

interface FeeConfigPanelProps {
  token: string | null
}

interface ConfigDraft {
  PLATFORM_FEE_RATE: string
  CANCELLATION_FEE_RATE: string
  TRANSFER_FEE_RATE: string
  MIN_BONUS_POINTS: string
}

export function FeeConfigPanel({ token }: FeeConfigPanelProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [config, setConfig] = useState<FeeConfig | null>(null)
  const [draft, setDraft] = useState<ConfigDraft>({
    PLATFORM_FEE_RATE: '',
    CANCELLATION_FEE_RATE: '',
    TRANSFER_FEE_RATE: '',
    MIN_BONUS_POINTS: '',
  })
  const [hasChanges, setHasChanges] = useState(false)

  const fetchConfig = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/config', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) {
        const cfg = data.data.config
        setConfig(cfg)
        setDraft({
          PLATFORM_FEE_RATE: (cfg.PLATFORM_FEE_RATE * 100).toFixed(2),
          CANCELLATION_FEE_RATE: (cfg.CANCELLATION_FEE_RATE * 100).toFixed(2),
          TRANSFER_FEE_RATE: (cfg.TRANSFER_FEE_RATE * 100).toFixed(2),
          MIN_BONUS_POINTS: cfg.MIN_BONUS_POINTS.toString(),
        })
      } else {
        setError(data.error || '讀取失敗')
      }
    } catch {
      setError('網路錯誤，請稍後再試')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  const handleDraftChange = (key: keyof ConfigDraft, value: string) => {
    setDraft(prev => ({ ...prev, [key]: value }))
    setHasChanges(true)
    setSuccess('')
    setError('')
  }

  const handleSave = async () => {
    if (!token) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/admin/config', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          PLATFORM_FEE_RATE: parseFloat(draft.PLATFORM_FEE_RATE) / 100,
          CANCELLATION_FEE_RATE: parseFloat(draft.CANCELLATION_FEE_RATE) / 100,
          TRANSFER_FEE_RATE: parseFloat(draft.TRANSFER_FEE_RATE) / 100,
          MIN_BONUS_POINTS: parseInt(draft.MIN_BONUS_POINTS) || 0,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setSuccess(data.data.note || '設定已儲存')
        setHasChanges(false)
        await fetchConfig()
      } else {
        setError(data.error || '儲存失敗')
      }
    } catch {
      setError('網路錯誤，請稍後再試')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    if (!config) return
    setDraft({
      PLATFORM_FEE_RATE: (config.PLATFORM_FEE_RATE * 100).toFixed(2),
      CANCELLATION_FEE_RATE: (config.CANCELLATION_FEE_RATE * 100).toFixed(2),
      TRANSFER_FEE_RATE: (config.TRANSFER_FEE_RATE * 100).toFixed(2),
      MIN_BONUS_POINTS: config.MIN_BONUS_POINTS.toString(),
    })
    setHasChanges(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-[#F59E0B] animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 警告提示 */}
      <div className="flex items-start gap-2 px-4 py-3 bg-[#FFF3E0] border border-[#F59E0B]/30 rounded-xl text-[13px] text-[#B45309]">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>費率設定影響所有司機的交易結算。修改後即時生效，但重啟伺服器後會重設為預設值。</span>
      </div>

      {/* 費率表 */}
      <div className="bg-white border border-[#DDDDDD] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#DDDDDD]">
          <h3 className="text-[16px] font-bold text-[#222222]">費率設定</h3>
          {config?.isOverridden && (
            <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded bg-[#FFF3E0] text-[#B45309] text-[11px] font-bold">
              <AlertTriangle className="w-3 h-3" />
              有自訂設定（已偏離預設值）
            </span>
          )}
        </div>

        <div className="p-5 space-y-4">
          {/* 平台費率 */}
          <div>
            <label className="block text-[12px] text-[#717171] mb-1.5 font-medium">
              平台抽成費率
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={draft.PLATFORM_FEE_RATE}
                onChange={e => handleDraftChange('PLATFORM_FEE_RATE', e.target.value)}
                className="w-28 px-3 py-2 border border-[#DDDDDD] rounded-lg text-[14px] text-[#222222] font-mono-nums focus:outline-none focus:ring-2 focus:ring-[#0C447C]/30 focus:border-[#0C447C]"
              />
              <span className="text-[14px] text-[#717171]">%</span>
              <span className="text-[12px] text-[#A8A29E]">
                （目前 {((config?.PLATFORM_FEE_RATE ?? 0) * 100).toFixed(2)}%）
              </span>
            </div>
            <p className="text-[11px] text-[#A8A29E] mt-1">司機完成行程後，平台從車資中抽取的比例</p>
          </div>

          {/* 取消費率 */}
          <div>
            <label className="block text-[12px] text-[#717171] mb-1.5 font-medium">
              取消訂單手續費率
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={draft.CANCELLATION_FEE_RATE}
                onChange={e => handleDraftChange('CANCELLATION_FEE_RATE', e.target.value)}
                className="w-28 px-3 py-2 border border-[#DDDDDD] rounded-lg text-[14px] text-[#222222] font-mono-nums focus:outline-none focus:ring-2 focus:ring-[#0C447C]/30 focus:border-[#0C447C]"
              />
              <span className="text-[14px] text-[#717171]">%</span>
              <span className="text-[12px] text-[#A8A29E]">
                （目前 {((config?.CANCELLATION_FEE_RATE ?? 0) * 100).toFixed(2)}%）
              </span>
            </div>
            <p className="text-[11px] text-[#A8A29E] mt-1">司機退單時扣除的比例</p>
          </div>

          {/* 轉單費率 */}
          <div>
            <label className="block text-[12px] text-[#717171] mb-1.5 font-medium">
              轉單手續費率
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={draft.TRANSFER_FEE_RATE}
                onChange={e => handleDraftChange('TRANSFER_FEE_RATE', e.target.value)}
                className="w-28 px-3 py-2 border border-[#DDDDDD] rounded-lg text-[14px] text-[#222222] font-mono-nums focus:outline-none focus:ring-2 focus:ring-[#0C447C]/30 focus:border-[#0C447C]"
              />
              <span className="text-[14px] text-[#717171]">%</span>
              <span className="text-[12px] text-[#A8A29E]">
                （目前 {((config?.TRANSFER_FEE_RATE ?? 0) * 100).toFixed(2)}%）
              </span>
            </div>
            <p className="text-[11px] text-[#A8A29E] mt-1">小隊轉單時原司機需支付的費用比例</p>
          </div>

          {/* 最低 bonus */}
          <div>
            <label className="block text-[12px] text-[#717171] mb-1.5 font-medium">
              bonus 最低點數
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="1"
                min="0"
                value={draft.MIN_BONUS_POINTS}
                onChange={e => handleDraftChange('MIN_BONUS_POINTS', e.target.value)}
                className="w-28 px-3 py-2 border border-[#DDDDDD] rounded-lg text-[14px] text-[#222222] font-mono-nums focus:outline-none focus:ring-2 focus:ring-[#0C447C]/30 focus:border-[#0C447C]"
              />
              <span className="text-[14px] text-[#717171]">點</span>
              <span className="text-[12px] text-[#A8A29E]">
                （目前 {config?.MIN_BONUS_POINTS ?? 10} 點）
              </span>
            </div>
            <p className="text-[11px] text-[#A8A29E] mt-1">司機請求小隊支援時，bonus 點數的最低要求</p>
          </div>
        </div>

        {/* 操作區 */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-[#DDDDDD] bg-[#F4EFE9]">
          <div className="flex items-center gap-2">
            {error && (
              <div className="flex items-center gap-1 text-[12px] text-[#E24B4A]">
                <AlertTriangle className="w-3.5 h-3.5" />
                {error}
              </div>
            )}
            {success && (
              <div className="flex items-center gap-1 text-[12px] text-[#008A05]">
                <CheckCircle className="w-3.5 h-3.5" />
                {success}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleReset}
              disabled={!hasChanges || saving}
              className="px-4 py-2 border border-[#DDDDDD] text-[#717171] text-[13px] font-bold rounded-lg hover:bg-[#F5F4F0] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              還原
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className="px-5 py-2 bg-[#0C447C] text-white text-[13px] font-bold rounded-lg hover:bg-[#0a3a6e] transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {saving ? '儲存中...' : '儲存設定'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
