// TypeScript type definitions for Airport Dispatch Platform

export type UserRole = 'DRIVER' | 'DISPATCHER' | 'ADMIN'
export type DriverStatus = 'ONLINE' | 'OFFLINE' | 'BUSY'
export type OrderStatus = 'PENDING' | 'ASSIGNED' | 'ACCEPTED' | 'ARRIVED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
export type TransactionType = 'RIDE_FARE' | 'PLATFORM_FEE' | 'RECHARGE' | 'WITHDRAW'
export type TransactionStatus = 'PENDING' | 'SETTLED'

export interface User {
  id: string
  email: string
  name: string
  phone: string
  role: UserRole
  createdAt: Date
}

export interface Driver {
  id: string
  userId: string
  licensePlate: string
  carType: string
  carColor: string
  balance: number
  status: DriverStatus
  currentLat?: number
  currentLng?: number
  lastLocationAt?: Date
  user?: User
}

export interface Dispatcher {
  id: string
  userId: string
  companyName: string
  commissionRate: number
  user?: User
}

export interface Order {
  id: string
  dispatcherId: string
  driverId?: string
  status: OrderStatus
  passengerName: string
  passengerPhone: string
  flightNumber: string
  pickupLocation: string
  pickupAddress: string
  pickupLat?: number
  pickupLng?: number
  dropoffLocation: string
  dropoffAddress: string
  dropoffLat?: number
  dropoffLng?: number
  passengerCount: number
  luggageCount: number
  scheduledTime: Date
  price: number
  note?: string
  rawText?: string
  createdAt: Date
  updatedAt: Date
  completedAt?: Date
  dispatcher?: Dispatcher
  driver?: Driver
}

export interface Transaction {
  id: string
  orderId?: string
  driverId: string
  amount: number
  type: TransactionType
  status: TransactionStatus
  description?: string
  createdAt: Date
  settledAt?: Date
}

// API Request/Response types
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

export interface RegisterRequest {
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

export interface LoginRequest {
  email: string
  password: string
}

export interface CreateOrderRequest {
  passengerName: string
  passengerPhone: string
  flightNumber: string
  pickupLocation: string
  pickupAddress: string
  pickupLat?: number
  pickupLng?: number
  dropoffLocation: string
  dropoffAddress: string
  dropoffLat?: number
  dropoffLng?: number
  passengerCount: number
  luggageCount: number
  scheduledTime: string
  price: number
  note?: string
}

export interface ParseOrderRequest {
  text: string
}

// SSE Event types
export interface DriverEvent {
  type: 'NEW_ORDER' | 'ORDER_ASSIGNED' | 'LOCATION_UPDATE'
  data: unknown
  timestamp: string
}

export interface DispatcherEvent {
  type: 'DRIVER_LOCATION' | 'ORDER_STATUS_CHANGE' | 'NEW_ORDER'
  data: unknown
  timestamp: string
}
