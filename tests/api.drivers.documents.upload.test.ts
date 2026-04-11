/**
 * POST /api/drivers/documents/upload — 司機上傳文件
 *
 * 覆蓋情境：
 * 1. 成功上傳（mock Drive API）
 * 2. 未授權 → 401
 * 3. 非司機角色 → 403
 * 4. 未選擇檔案 → 400
 * 5. 不支援的檔案類型 → 400
 * 6. 檔案過大 → 400
 * 7. 無效的文件類型 → 400
 * 8. Drive 上傳失敗 → uploadFailed=true 但仍建立文件記錄
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockDriver = {
  id: 'driver-1',
  userId: 'user-1',
  licensePlate: 'ABC-1234',
  carBrand: 'Toyota',
  carModel: 'Camry',
  carType: 'small',
  carColor: '白色',
  isPremium: false,
  bankCode: null,
  bankAccount: null,
  balance: 500,
}

const mockUser = {
  id: 'user-1',
  name: '測試司機',
  email: 'driver@test.com',
  phone: '0912345678',
  role: 'DRIVER' as const,
  driver: mockDriver,
}

vi.mock('@/lib/prisma', () => ({
  prisma: {
    driver: { findUnique: vi.fn() },
    userDocument: { create: vi.fn() },
  },
}))

vi.mock('@/lib/auth', () => ({
  getUserFromToken: vi.fn(),
}))

vi.mock('@/lib/google-drive', () => ({
  getOrCreateUserFolder: vi.fn().mockResolvedValue('folder-id-123'),
  uploadFileToDrive: vi.fn().mockResolvedValue({
    fileId: 'file-id-456',
    webViewLink: 'https://drive.google.com/file/d/file-id-456/view',
    webContentLink: 'https://drive.google.com/uc?export=download&id=file-id-456',
  }),
  setFilePublic: vi.fn().mockResolvedValue(undefined),
}))

import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { POST } from '@/app/api/drivers/documents/upload/route'

const mockedPrisma = prisma as unknown as {
  driver: { findUnique: ReturnType<typeof vi.fn> }
  userDocument: { create: ReturnType<typeof vi.fn> }
}
const mockedGetUser = getUserFromToken as unknown as ReturnType<typeof vi.fn>

function makeUploadRequest(formData: FormData, token = 'valid-token') {
  return new NextRequest('http://localhost:3000/api/drivers/documents/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })
}

function createValidFormData() {
  const form = new FormData()
  form.set('userId', 'user-1')
  form.set('type', 'VEHICLE_REGISTRATION')
  // 建立一個小的 mock File
  const file = new File(['dummy'], 'car-reg.jpg', { type: 'image/jpeg' })
  // Replace with actual file
  form.delete('file')
  form.set('file', file)
  return form
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedGetUser.mockResolvedValue(mockUser)
  mockedPrisma.driver.findUnique.mockResolvedValue(mockDriver)
})

describe('POST /api/drivers/documents/upload', () => {
  it('1. 成功上傳 → 200，status=PENDING', async () => {
    mockedPrisma.userDocument.create.mockResolvedValue({
      id: 'doc-new',
      userId: 'user-1',
      type: 'VEHICLE_REGISTRATION',
      fileUrl: 'https://drive.google.com/file/d/file-id-456/view',
      status: 'PENDING',
      uploadFailed: false,
    })

    const form = new FormData()
    form.set('type', 'VEHICLE_REGISTRATION')
    const file = new File(['dummy-content'], 'car-reg.jpg', { type: 'image/jpeg' })
    form.set('file', file)

    const req = makeUploadRequest(form)
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.status).toBe('PENDING')
    expect(json.data.documentId).toBe('doc-new')
  })

  it('2. Drive 上傳失敗 → uploadFailed=true，仍建立文件記錄', async () => {
    const { uploadFileToDrive } = await import('@/lib/google-drive')
    ;(uploadFileToDrive as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Drive API error'))

    mockedPrisma.userDocument.create.mockResolvedValue({
      id: 'doc-failed',
      userId: 'user-1',
      type: 'VEHICLE_REGISTRATION',
      fileUrl: 'upload-failed:car-reg.jpg',
      status: 'PENDING',
      uploadFailed: true,
    })

    const form = new FormData()
    form.set('type', 'VEHICLE_REGISTRATION')
    const file = new File(['dummy-content'], 'car-reg.jpg', { type: 'image/jpeg' })
    form.set('file', file)

    const req = makeUploadRequest(form)
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.fileUrl).toContain('upload-failed:')
  })

  it('3. 無 token → 401', async () => {
    mockedGetUser.mockResolvedValue(null)
    const form = new FormData()
    form.set('type', 'VEHICLE_REGISTRATION')
    form.set('file', new File(['x'], 'x.jpg', { type: 'image/jpeg' }))
    const req = makeUploadRequest(form, 'bad-token')
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('4. 非司機角色 → 403', async () => {
    mockedGetUser.mockResolvedValue({ ...mockUser, role: 'DISPATCHER' as const, driver: null })
    const form = new FormData()
    form.set('type', 'VEHICLE_REGISTRATION')
    form.set('file', new File(['x'], 'x.jpg', { type: 'image/jpeg' }))
    const req = makeUploadRequest(form)
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it('5. 未選擇檔案 → 400', async () => {
    const form = new FormData()
    form.set('type', 'VEHICLE_REGISTRATION')
    const req = makeUploadRequest(form)
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('未選擇檔案')
  })

  it('6. 不支援的 MIME type → 400', async () => {
    const form = new FormData()
    form.set('type', 'VEHICLE_REGISTRATION')
    form.set('file', new File(['x'], 'x.gif', { type: 'image/gif' }))
    const req = makeUploadRequest(form)
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('JPG、PNG、PDF')
  })

  it('7. 檔案超過 5MB → 400', async () => {
    const largeContent = new Array(6 * 1024 * 1024).fill('x').join('')
    const form = new FormData()
    form.set('type', 'VEHICLE_REGISTRATION')
    form.set('file', new File([largeContent], 'big.jpg', { type: 'image/jpeg' }))
    const req = makeUploadRequest(form)
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('5MB')
  })

  it('8. 無效的文件類型 → 400', async () => {
    const form = new FormData()
    form.set('type', 'INVALID_TYPE')
    form.set('file', new File(['x'], 'x.jpg', { type: 'image/jpeg' }))
    const req = makeUploadRequest(form)
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('文件類型需為')
  })

  it('9. 嘗試替他人上傳 → 403', async () => {
    const form = new FormData()
    form.set('userId', 'other-user-id')
    form.set('type', 'VEHICLE_REGISTRATION')
    form.set('file', new File(['x'], 'x.jpg', { type: 'image/jpeg' }))
    const req = makeUploadRequest(form)
    const res = await POST(req)
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toContain('無法替他人上傳')
  })

  it('10. 新建文件狀態為 PENDING（待審核）', async () => {
    mockedPrisma.userDocument.create.mockResolvedValue({
      id: 'doc-new',
      userId: 'user-1',
      type: 'VEHICLE_REGISTRATION',
      status: 'PENDING',
      uploadFailed: false,
    })

    const form = new FormData()
    form.set('type', 'DRIVER_LICENSE')
    form.set('file', new File(['x'], 'license.pdf', { type: 'application/pdf' }))
    const req = makeUploadRequest(form)
    await POST(req)

    expect(mockedPrisma.userDocument.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        type: 'DRIVER_LICENSE',
        status: 'PENDING',
      }),
    })
  })
})
