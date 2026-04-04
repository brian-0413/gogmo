// TypeScript type definitions for Airport Dispatch Platform

export type UserRole = 'DRIVER' | 'DISPATCHER' | 'ADMIN'
export type DriverStatus = 'ONLINE' | 'OFFLINE' | 'BUSY'
export type OrderStatus = 'PENDING' | 'PUBLISHED' | 'ASSIGNED' | 'ACCEPTED' | 'IN_PROGRESS' | 'ARRIVED' | 'PICKED_UP' | 'COMPLETED' | 'CANCELLED'
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

export type OrderType = 'pickup' | 'dropoff' | 'pickup_boat' | 'dropoff_boat' | 'transfer' | 'charter' | 'pending'
export type VehicleType = 'small' | 'suv' | 'van9' | 'any' | 'any_r' | 'pending'
export type PlateType = 'R' | 'T' | 'any'

export interface Order {
  id: string
  orderDate: string
  orderSeq: number
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
  scheduledTime: Date | string
  price: number
  type: OrderType
  vehicle: VehicleType
  plateType: PlateType
  notes?: string
  note?: string
  rawText?: string
  createdAt: Date
  updatedAt: Date
  completedAt?: Date
  dispatcher?: Dispatcher
  driver?: Driver
  kenichiRequired?: boolean
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
  type?: OrderType
  vehicle?: VehicleType
  plateType?: PlateType
  notes?: string
  note?: string
  rawText?: string
  kenichiRequired?: boolean
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
