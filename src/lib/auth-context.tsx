'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useRouter } from 'next/navigation'

interface User {
  id: string
  email: string
  name: string
  role: 'DRIVER' | 'DISPATCHER' | 'ADMIN'
  driver?: {
    id: string
    status: string
    balance: number
  }
  dispatcher?: {
    id: string
    companyName: string
  }
}

interface AuthContextType {
  user: User | null
  token: string | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string }>
  logout: () => void
}

interface RegisterData {
  email: string
  password: string
  name: string
  phone: string
  role: 'DRIVER' | 'DISPATCHER'
  licensePlate?: string
  carType?: string
  carColor?: string
  companyName?: string
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    // Check for existing token on mount
    const storedToken = localStorage.getItem('token')
    if (storedToken) {
      setToken(storedToken)
      fetchUser(storedToken)
    } else {
      setIsLoading(false)
    }
  }, [])

  const fetchUser = async (authToken: string) => {
    try {
      const res = await fetch('/api/auth/[...nextauth]', {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      const data = await res.json()
      if (data.success) {
        setUser(data.data)
      } else {
        localStorage.removeItem('token')
        setToken(null)
      }
    } catch {
      localStorage.removeItem('token')
      setToken(null)
    } finally {
      setIsLoading(false)
    }
  }

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/[...nextauth]', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()

      if (data.success) {
        setToken(data.data.token)
        setUser(data.data.user)
        localStorage.setItem('token', data.data.token)
        router.push(data.data.user.role === 'DRIVER' ? '/dashboard/driver' : '/dashboard/dispatcher')
        return { success: true }
      } else {
        return { success: false, error: data.error }
      }
    } catch {
      return { success: false, error: '網路錯誤，請稍後再試' }
    }
  }

  const register = async (data: RegisterData) => {
    try {
      const res = await fetch('/api/auth/[...nextauth]', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const resData = await res.json()

      if (resData.success) {
        setToken(resData.data.token)
        setUser(resData.data.user)
        localStorage.setItem('token', resData.data.token)
        router.push(data.role === 'DRIVER' ? '/dashboard/driver' : '/dashboard/dispatcher')
        return { success: true }
      } else {
        return { success: false, error: resData.error }
      }
    } catch {
      return { success: false, error: '網路錯誤，請稍後再試' }
    }
  }

  const logout = () => {
    setUser(null)
    setToken(null)
    localStorage.removeItem('token')
    router.push('/login')
  }

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
