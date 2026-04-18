'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { MessageCircle } from 'lucide-react'

interface MessageBadgeProps {
  className?: string
}

export function MessageBadge({ className = '' }: MessageBadgeProps) {
  const { token } = useAuth()
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    if (!token) return

    const fetchUnread = async () => {
      try {
        const res = await fetch('/api/messages/unread-count', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json()
        if (data.success) setUnread(data.data.count)
      } catch {
        // ignore
      }
    }

    fetchUnread()
    const interval = setInterval(fetchUnread, 30000) // poll every 30s
    return () => clearInterval(interval)
  }, [token])

  if (unread === 0) return null

  return (
    <div className={`relative ${className}`}>
      <MessageCircle className="w-5 h-5 text-[#717171]" />
      <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-[#FF385C] text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
        {unread > 99 ? '99+' : unread}
      </span>
    </div>
  )
}
