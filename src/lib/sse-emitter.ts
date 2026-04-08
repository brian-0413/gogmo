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
  type: 'TRANSFER_CREATED' | 'TRANSFER_ACCEPTED' | 'TRANSFER_APPROVED' | 'TRANSFER_REJECTED' | 'TRANSFER_CANCELLED'
  transferId: string
  orderId: string
  fromDriverId: string
  toDriverId?: string
  squadId: string
  status: string
  reason?: string
  dispatcherNote?: string
}

/** Dispatcher notification event payload */
export interface DispatcherNotifyEvent {
  type: 'TRANSFER_PENDING' | 'TRANSFER_APPROVED' | 'TRANSFER_REJECTED'
  transferId: string
  orderId: string
  fromDriverId: string
  toDriverId?: string
  status: string
  note?: string
}

/** Broadcast a squad transfer event to all listening clients */
export function broadcastSquadEvent(event: SquadTransferEvent) {
  globalEmitter.emit('squad-event', event)
}

/** Broadcast a dispatcher notification event */
export function broadcastDispatcherEvent(event: DispatcherNotifyEvent) {
  globalEmitter.emit('dispatcher-event', event)
}
