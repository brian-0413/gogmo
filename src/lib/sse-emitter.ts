// Shared SSE emitter for real-time notifications across API routes.
// Squads and dispatchers subscribe to receive events broadcast from transfer operations.

import { EventEmitter } from 'events'

// Singleton emitter instance shared across all API routes
const globalEmitter = new EventEmitter()
globalEmitter.setMaxListeners(100)

export type SSEEmitter = EventEmitter
export { globalEmitter }

/** Squad transfer event payload */
export interface SquadTransferEvent {
  type: 'SQUAD_POOL_NEW' | 'TRANSFER_CREATED' | 'TRANSFER_ACCEPTED' | 'TRANSFER_APPROVED' | 'TRANSFER_REJECTED' | 'TRANSFER_CANCELLED' | 'TRANSFER_WITHDRAWN' | 'TRANSFER_EXPIRED'
  transferId: string
  orderId: string
  fromDriverId: string
  toDriverId?: string
  squadId: string
  status: string
  reason?: string
  dispatcherNote?: string
  bonusPoints?: number
}

/** Dispatcher notification event payload */
export interface DispatcherNotifyEvent {
  type: 'SQUAD_TRANSFER_PENDING' | 'TRANSFER_APPROVED' | 'TRANSFER_REJECTED' | 'TRANSFER_WITHDRAWN' | 'SQUAD_POOL_NEW' | 'TRANSFER_POOL_READY'
  transferId: string
  orderId: string
  fromDriverId: string
  toDriverId?: string
  squadId?: string
  status: string
  note?: string
  bonusPoints?: number
}

/** Broadcast a squad transfer event to all listening clients */
export function broadcastSquadEvent(event: SquadTransferEvent) {
  globalEmitter.emit('squad-event', event)
}

/** Broadcast a dispatcher notification event */
export function broadcastDispatcherEvent(event: DispatcherNotifyEvent) {
  globalEmitter.emit('dispatcher-event', event)
}

/** Squad invite event payload */
export interface SquadInviteEvent {
  type: 'SQUAD_INVITE' | 'SQUAD_INVITE_ACCEPTED' | 'SQUAD_INVITE_REJECTED'
  inviteId: string
  squadId: string
  squadName: string
  driverId: string
  founderName?: string
}

/** Broadcast a squad invite event to a specific driver */
export function broadcastSquadInviteEvent(event: SquadInviteEvent) {
  globalEmitter.emit('squad-invite', event)
}
