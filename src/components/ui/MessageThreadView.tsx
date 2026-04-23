'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { Send, X, MessageCircle, CheckCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface Message {
  id: string
  senderId: string
  senderRole: string
  content: string
  isRead: boolean
  isSystem: boolean
  createdAt: string
}

interface Thread {
  id: string
  dispatcher: { id: string; companyName: string; user: { id: string; name: string } }
  driver: { id: string; licensePlate: string; user: { id: string; name: string } }
  lastMessage: { content: string; createdAt: string; isSystem: boolean } | null
  lastMessageAt: string
}

interface ThreadListProps {
  onSelect: (threadId: string) => void
  selectedId?: string
}

function ThreadList({ onSelect, selectedId }: ThreadListProps) {
  const { token, user } = useAuth()
  const [threads, setThreads] = useState<Thread[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    fetch('/api/messages/threads', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => {
        if (d.success) setThreads(d.data.threads)
      })
      .finally(() => setLoading(false))
  }, [token])

  if (loading) return <div className="p-4 text-sm text-[#717171]">載入中...</div>
  if (threads.length === 0) return <div className="p-4 text-sm text-[#717171]">尚無對話</div>

  return (
    <div className="divide-y divide-[#EAEAEA]">
      {threads.map(thread => {
        const otherName = user?.role === 'DISPATCHER'
          ? `${thread.driver.licensePlate} ${thread.driver.user.name}`
          : thread.dispatcher.companyName
        const isSelected = thread.id === selectedId
        return (
          <button
            key={thread.id}
            onClick={() => onSelect(thread.id)}
            className={`w-full text-left px-4 py-3 hover:bg-[#F7F7F7] transition-colors ${isSelected ? 'bg-[#F0F7FF]' : ''}`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold text-[#222222] truncate">{otherName}</span>
              {thread.lastMessage && (
                <span className="text-[10px] text-[#B0B0B0]">
                  {new Date(thread.lastMessage.createdAt).toLocaleDateString('zh-TW')}
                </span>
              )}
            </div>
            {thread.lastMessage && (
              <p className="text-[12px] text-[#717171] truncate">
                {thread.lastMessage.isSystem ? '[系統] ' : ''}
                {thread.lastMessage.content}
              </p>
            )}
          </button>
        )
      })}
    </div>
  )
}

interface ChatViewProps {
  threadId: string
  onClose: () => void
}

function ChatView({ threadId, onClose }: ChatViewProps) {
  const { token, user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadMessages = () => {
    if (!token) return
    fetch(`/api/messages/threads/${threadId}/messages`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => {
        if (d.success) setMessages(d.data.messages)
      })
  }

  useEffect(() => {
    loadMessages()
    // Mark as read
    if (token) {
      fetch(`/api/messages/threads/${threadId}/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
    }
  }, [threadId, token])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || !token || sending) return
    setSending(true)
    try {
      const res = await fetch(`/api/messages/threads/${threadId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: input }),
      })
      const data = await res.json()
      if (data.success) {
        setMessages(prev => [...prev, data.data.message])
        setInput('')
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#EAEAEA]">
        <span className="text-sm font-semibold text-[#222222]">對話</span>
        <button onClick={onClose} className="p-1 hover:bg-[#F7F7F7] rounded-lg">
          <X className="w-4 h-4 text-[#717171]" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map(msg => {
          const isMe = msg.senderId === user?.id
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                msg.isSystem
                  ? 'bg-[#F4EFE9] text-[#717171] text-center mx-auto'
                  : isMe
                    ? 'bg-[#FF385C] text-white rounded-br-md'
                    : 'bg-[#EEEEEE] text-[#222222] rounded-bl-md'
              }`}>
                {msg.content}
                <div className={`text-[10px] mt-1 ${isMe ? 'text-white/60' : 'text-[#B0B0B0]'}`}>
                  {new Date(msg.createdAt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t border-[#EAEAEA]">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="輸入訊息..."
            className="flex-1 text-sm px-3 py-2 border border-[#DDDDDD] rounded-xl focus:outline-none focus:border-[#FF385C]"
          />
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="btn-physics"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

interface MessageThreadViewProps {
  className?: string
}

export function MessageThreadView({ className = '' }: MessageThreadViewProps) {
  const { token } = useAuth()
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [markingRead, setMarkingRead] = useState(false)
  const [threadListKey, setThreadListKey] = useState(0)

  const fetchUnreadCount = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch('/api/messages/unread-count', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) setUnreadCount(data.data.count)
    } catch {
      // ignore
    }
  }, [token])

  useEffect(() => {
    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 30000)
    return () => clearInterval(interval)
  }, [fetchUnreadCount])

  const handleMarkAllRead = async () => {
    if (!token || markingRead) return
    setMarkingRead(true)
    try {
      const res = await fetch('/api/messages/read-all', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) {
        setUnreadCount(0)
        // Refresh thread list to show read state
        setSelectedThreadId(null)
        setThreadListKey(k => k + 1)
      }
    } finally {
      setMarkingRead(false)
    }
  }

  return (
    <div className={`bg-white border border-[#EAEAEA] rounded-2xl overflow-hidden ${className}`}
      style={{ height: '500px' }}>
      <div className="flex h-full">
        {/* Thread list */}
        <div className="w-1/3 border-r border-[#EAEAEA] overflow-y-auto">
          <div className="px-4 py-3 border-b border-[#EAEAEA]">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-[#222222]">訊息</span>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  disabled={markingRead}
                  className="flex items-center gap-1 text-[11px] font-bold text-[#FF385C] hover:text-[#D70466] transition-colors disabled:opacity-50"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  全部已讀
                </button>
              )}
            </div>
          </div>
          <ThreadList
            key={threadListKey}
            onSelect={id => setSelectedThreadId(id)}
            selectedId={selectedThreadId ?? undefined}
          />
        </div>

        {/* Chat area */}
        <div className="w-2/3 flex flex-col">
          {selectedThreadId ? (
            <ChatView
              threadId={selectedThreadId}
              onClose={() => setSelectedThreadId(null)}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-[#B0B0B0]">
              <div className="text-center">
                <MessageCircle className="w-10 h-10 mx-auto mb-2" />
                <p className="text-sm">選擇對話開始聊天</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
