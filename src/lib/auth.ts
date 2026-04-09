import bcrypt from 'bcryptjs'
import jwt, { SignOptions } from 'jsonwebtoken'
import { prisma } from './prisma'
import { NEW_USER_BONUS } from './constants'

const JWT_SECRET = process.env.JWT_SECRET
const JWT_EXPIRES_IN = '7d'

// Get JWT secret with lazy validation
function getJwtSecret(): string {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is not set')
  }
  return JWT_SECRET
}

export interface JwtPayload {
  userId: string
  role: string
  exp?: number
}

export interface AuthResult {
  success: boolean
  token?: string
  user?: {
    id: string
    email: string
    name: string
    role: string
    isPremium?: boolean
  }
  error?: string
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}

export function generateToken(payload: JwtPayload, expiresIn: SignOptions['expiresIn'] = '7d'): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn })
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as JwtPayload
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
    carBrand?: string
    carModel?: string
    taxId?: string
    contactPhone?: string
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
        accountStatus: 'PENDING_VERIFICATION',
        ...(role === 'DRIVER' && {
          driver: {
            create: {
              licensePlate: extraData.licensePlate || '',
              carType: extraData.carType || '轎車',
              carColor: extraData.carColor || '',
              balance: NEW_USER_BONUS, // 新用戶贈送點數
              carBrand: extraData.carBrand || null,
              carModel: extraData.carModel || null,
            },
          },
        }),
        ...(role === 'DISPATCHER' && {
          dispatcher: {
            create: {
              companyName: extraData.companyName || '',
              commissionRate: 0, // 初期免費
              taxId: extraData.taxId || null,
              contactPhone: extraData.contactPhone || null,
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
        isPremium: user.driver?.isPremium ?? false,
      },
    }
  } catch (error) {
    console.error('Register error:', error)
    return { success: false, error: '註冊失敗，請稍後再試' }
  }
}

export async function login(email: string, password: string): Promise<AuthResult> {
  try {
    console.log('[AUTH] Login attempt for:', email)

    const user = await prisma.user.findUnique({
      where: { email },
      include: { driver: true, dispatcher: true },
    })

    console.log('[AUTH] User found:', user ? `yes (id=${user.id}, role=${user.role})` : 'no')

    if (!user) {
      return { success: false, error: '帳號或密碼錯誤' }
    }

    const isValid = await verifyPassword(password, user.password)
    if (!isValid) {
      console.log('[AUTH] Password verification failed')
      return { success: false, error: '帳號或密碼錯誤' }
    }

    let token: string
    try {
      token = generateToken({ userId: user.id, role: user.role })
      console.log('[AUTH] Token generated successfully')
    } catch (tokenError) {
      console.error('[AUTH] Token generation failed:', tokenError)
      return { success: false, error: '伺服器設定錯誤，JWT_SECRET 可能未設定' }
    }

    return {
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isPremium: user.driver?.isPremium ?? false,
      },
    }
  } catch (error) {
    console.error('Login error:', error)
    return { success: false, error: '登入失敗，請稍後再試' }
  }
}

export async function loginByPlate(licensePlate: string, password: string): Promise<AuthResult> {
  try {
    const user = await prisma.user.findFirst({
      where: {
        role: 'DRIVER',
        driver: { licensePlate },
      },
      include: { driver: true, dispatcher: true },
    })
    if (!user) return { success: false, error: '車牌號碼不存在' }
    const isValid = await verifyPassword(password, user.password)
    if (!isValid) return { success: false, error: '密碼錯誤' }
    const token = generateToken({ userId: user.id, role: user.role })
    return {
      success: true,
      token,
      user: {
        id: user.id, email: user.email, name: user.name, role: user.role,
        isPremium: user.driver?.isPremium ?? false,
      },
    }
  } catch (error) {
    console.error('LoginByPlate error:', error)
    return { success: false, error: '登入失敗' }
  }
}

export async function sendVerifyEmail(userId: string, email: string): Promise<void> {
  const token = generateToken({ userId, role: 'VERIFY' }, '1d')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const verifyUrl = `${appUrl}/api/auth/verify-email?token=${token}`
  await prisma.user.update({
    where: { id: userId },
    data: { emailVerifyToken: token },
  })
  // TODO: call email.ts sendVerifyEmail(email, token)
  console.log(`[EMAIL] Verify link for ${email}: ${verifyUrl}`)
}

export async function verifyEmail(token: string): Promise<{ success: boolean; error?: string }> {
  try {
    const payload = verifyToken(token) as (JwtPayload & { role: string }) | null
    if (!payload) return { success: false, error: '驗證連結已過期或無效' }
    if (payload.role !== 'VERIFY') return { success: false, error: '無效的驗證連結' }
    const user = await prisma.user.findUnique({ where: { id: payload.userId } })
    if (!user) return { success: false, error: '找不到使用者' }
    await prisma.user.update({
      where: { id: payload.userId },
      data: { emailVerified: true, emailVerifyToken: null, accountStatus: 'PENDING_REVIEW' },
    })
    return { success: true }
  } catch (error) {
    console.error('verifyEmail error:', error)
    return { success: false, error: '驗證失敗' }
  }
}

export async function forgotPassword(
  account: string, role: 'DRIVER' | 'DISPATCHER', email?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    if (role === 'DRIVER') {
      if (!email) return { success: false, error: '請提供註冊時的 Email' }
      const user = await prisma.user.findFirst({
        where: { role: 'DRIVER', email, driver: { licensePlate: account } },
      })
      if (!user) return { success: false, error: '車牌與 Email 不匹配' }
      const token = generateToken({ userId: user.id, role: 'RESET' }, '1h')
      const resetUrl = `${appUrl}/reset-password?token=${token}`
      console.log(`[EMAIL] Reset link for ${email}: ${resetUrl}`)
      return { success: true }
    } else {
      const user = await prisma.user.findUnique({ where: { email: account, role: 'DISPATCHER' } })
      if (!user) return { success: false, error: '此 Email 未註冊' }
      const token = generateToken({ userId: user.id, role: 'RESET' }, '1h')
      const resetUrl = `${appUrl}/reset-password?token=${token}`
      console.log(`[EMAIL] Reset link for ${email}: ${resetUrl}`)
      return { success: true }
    }
  } catch (error) {
    console.error('forgotPassword error:', error)
    return { success: false, error: '處理失敗' }
  }
}

export async function resetPassword(token: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  try {
    const payload = verifyToken(token) as (JwtPayload & { role: string }) | null
    if (!payload) return { success: false, error: '重設連結已過期或無效' }
    if (payload.role !== 'RESET') return { success: false, error: '無效的重設連結' }
    const hashed = await hashPassword(newPassword)
    await prisma.user.update({ where: { id: payload.userId }, data: { password: hashed } })
    return { success: true }
  } catch (error) {
    console.error('resetPassword error:', error)
    return { success: false, error: '重設失敗' }
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
