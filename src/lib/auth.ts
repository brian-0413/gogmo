import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from './prisma'

const JWT_SECRET = process.env.JWT_SECRET as string // Type assertion - env vars are set at runtime

// Validate at startup
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set')
}

const JWT_EXPIRES_IN = '7d'

export interface JwtPayload {
  userId: string
  role: string
}

export interface AuthResult {
  success: boolean
  token?: string
  user?: {
    id: string
    email: string
    name: string
    role: string
  }
  error?: string
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}

export function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload
  } catch {
    return null
  }
}

export async function register(
  email: string,
  password: string,
  name: string,
  phone: string,
  role: 'DRIVER' | 'DISPATCHER',
  extraData: {
    licensePlate?: string
    carType?: string
    carColor?: string
    companyName?: string
  }
): Promise<AuthResult> {
  try {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return { success: false, error: '此 Email 已經註冊' }
    }

    const hashedPassword = await hashPassword(password)

    // Create user with role-specific data
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        phone,
        role,
        ...(role === 'DRIVER' && {
          driver: {
            create: {
              licensePlate: extraData.licensePlate || '',
              carType: extraData.carType || '轎車',
              carColor: extraData.carColor || '',
              balance: 500, // 新用戶贈送 500 點
            },
          },
        }),
        ...(role === 'DISPATCHER' && {
          dispatcher: {
            create: {
              companyName: extraData.companyName || '',
              commissionRate: 0, // 初期免費
            },
          },
        }),
      },
      include: {
        driver: true,
        dispatcher: true,
      },
    })

    const token = generateToken({ userId: user.id, role: user.role })

    return {
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    }
  } catch (error) {
    console.error('Register error:', error)
    return { success: false, error: '註冊失敗，請稍後再試' }
  }
}

export async function login(email: string, password: string): Promise<AuthResult> {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { driver: true, dispatcher: true },
    })

    if (!user) {
      return { success: false, error: '帳號或密碼錯誤' }
    }

    const isValid = await verifyPassword(password, user.password)
    if (!isValid) {
      return { success: false, error: '帳號或密碼錯誤' }
    }

    const token = generateToken({ userId: user.id, role: user.role })

    return {
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    }
  } catch (error) {
    console.error('Login error:', error)
    return { success: false, error: '登入失敗，請稍後再試' }
  }
}

export async function getUserFromToken(token: string) {
  const payload = verifyToken(token)
  if (!payload) return null

  return prisma.user.findUnique({
    where: { id: payload.userId },
    include: { driver: true, dispatcher: true },
  })
}
