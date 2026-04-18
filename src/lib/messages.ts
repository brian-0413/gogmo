import { prisma } from './prisma'
import { UserRole } from '@prisma/client'

/**
 * 產生系統訊息並附加至指定的對話執行緒。
 * 通常用於訂單狀態變更等事件。
 */
export async function createSystemMessage(
  threadId: string,
  content: string
): Promise<void> {
  await prisma.message.create({
    data: {
      threadId,
      senderId: 'SYSTEM',
      senderRole: 'ADMIN' as UserRole,
      content,
      isSystem: true,
    },
  })

  await prisma.messageThread.update({
    where: { id: threadId },
    data: { lastMessageAt: new Date() },
  })
}

/**
 * 確保兩個使用者之間存在一個對話執行緒，若不存在則建立。
 * 回傳 thread。
 */
export async function getOrCreateThread(
  dispatcherId: string,
  driverId: string
): Promise<{ id: string }> {
  const existing = await prisma.messageThread.findUnique({
    where: { dispatcherId_driverId: { dispatcherId, driverId } },
  })
  if (existing) return existing

  // 取得對應的 userId
  const [dispatcher, driver] = await Promise.all([
    prisma.dispatcher.findUnique({ where: { id: dispatcherId }, select: { userId: true } }),
    prisma.driver.findUnique({ where: { id: driverId }, select: { userId: true } }),
  ])
  if (!dispatcher || !driver) throw new Error('找不到司機或派單方')

  return prisma.messageThread.create({
    data: {
      dispatcherId,
      driverId,
      participants: {
        create: [
          { userId: dispatcher.userId, role: 'DISPATCHER' },
          { userId: driver.userId, role: 'DRIVER' },
        ],
      },
    },
  })
}

/**
 * 取得某使用者的所有未讀訊息總數。
 */
export async function getUnreadCountByUser(userId: string): Promise<number> {
  const participants = await prisma.messageParticipant.findMany({
    where: { userId },
    select: { threadId: true, lastReadAt: true },
  })
  if (participants.length === 0) return 0

  const threadIds = participants.map(p => p.threadId)
  const lastReadMap = new Map<string, Date | null>()
  participants.forEach(p => lastReadMap.set(p.threadId, p.lastReadAt))

  const counts = await Promise.all(
    threadIds.map(async (threadId) => {
      const lastRead = lastReadMap.get(threadId)
      const where: Record<string, unknown> = {
        threadId,
        isRead: false,
        senderId: { not: userId },
      }
      if (lastRead) {
        where.createdAt = { gt: lastRead }
      }
      return prisma.message.count({ where })
    })
  )
  return counts.reduce((sum, c) => sum + c, 0)
}
