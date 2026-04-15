// TypeScript type definitions for Airport Dispatch Platform

export type UserRole = 'DRIVER' | 'DISPATCHER' | 'ADMIN'
export type AccountStatus = 'PENDING_VERIFICATION' | 'PENDING_REVIEW' | 'ACTIVE' | 'REJECTED'
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
  emailVerified?: boolean
  accountStatus?: AccountStatus
  rejectReason?: string | null
}

export interface UserDocument {
  id: string
  userId: string
  type: 'DRIVER_LICENSE' | 'VEHICLE_REGISTRATION' | 'INSURANCE' | 'ID_CARD' | 'BUSINESS_REGISTRATION'
  fileUrl: string
  fileName: string
  mimeType: string
  sizeBytes: number
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  createdAt: Date | string
}

export interface Driver {
  id: string
  userId: string
  licensePlate: string
  carType: string
  carColor: string
  carBrand?: string
  carModel?: string
  balance: number
  status: DriverStatus
  currentLat?: number
  currentLng?: number
  lastLocationAt?: Date
  user?: User
  isPremium?: boolean
}

export type VehicleSizeType = 'small_sedan' | 'small_suv' | 'van7' | 'van9'

export interface Dispatcher {
  id: string
  userId: string
  companyName: string
  commissionRate: number
  taxId?: string
  contactPhone?: string
  user?: User
}

export type OrderType = 'pickup' | 'dropoff' | 'pickup_boat' | 'dropoff_boat' | 'transfer' | 'charter' | 'pending'
export type VehicleType = 'small' | 'suv' | 'van9' | 'any' | 'any_r' | 'pending'
export type PlateType = 'R' | 'T' | 'any'

export interface Order {
  id: string
  orderDate?: string
  orderSeq?: number
  dispatcherId?: string
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
  notes?: string | null
  note?: string | null
  rawText?: string | null
  createdAt: string
  updatedAt?: string
  startedAt?: string | null
  arrivedAt?: string | null
  pickedUpAt?: string | null
  completedAt?: string | null
  transferStatus?: string
  dispatcher?: Dispatcher
  driver?: Driver
  kenichiRequired?: boolean
  isSelfPublish?: boolean
  isQROrder?: boolean
  originalDriverId?: string | null
  qrPrice?: number | null
  parsedData?: unknown
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

export type TransferStatus = 'PENDING_SQUAD' | 'PENDING_DISPATCHER' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED'

export interface SquadMember {
  id: string
  squadId: string
  driverId: string
  joinedAt: Date | string
  driver?: {
    id: string
    licensePlate: string
    carType: string
    carColor: string
    isPremium: boolean
    user?: {
      id: string
      name: string
      phone: string
    }
  }
}

export interface Squad {
  id: string
  name: string
  maxMembers: number
  memberCount: number
  createdAt: Date | string
  members: SquadMember[]
  founderId: string
  founder?: {
    id: string
    user?: { id: string; name: string }
  }
}

export interface OrderTransfer {
  id: string
  orderId: string
  fromDriverId: string
  toDriverId: string | null
  squadId: string
  reason: string | null
  transferFee: number
  bonusPoints?: number
  status: TransferStatus
  dispatcherNote: string | null
  createdAt: Date | string
  order?: {
    id: string
    scheduledTime: Date | string
    price: number
    pickupLocation: string
    dropoffLocation: string
    type: string
    vehicle: string
  }
  fromDriver?: {
    id: string
    licensePlate: string
    carType: string
    user?: { name: string }
  }
  toDriver?: {
    id: string
    licensePlate: string
    carType: string
    user?: { name: string }
  }
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
  carBrand?: string
  carModel?: string
  taxId?: string
  contactPhone?: string
}

export interface LoginRequest {
  // 支援兩種登入方式（由 role 區分）
  account: string   // 司機填車牌，派單方填 Email
  password: string
  role: 'DRIVER' | 'DISPATCHER'
}

export interface ForgotPasswordRequest {
  account: string   // 車牌（司機）或 Email（派單方）
  role: 'DRIVER' | 'DISPATCHER'
  email?: string    // 司機需要同時提供 Email 驗證
}

export interface ResetPasswordRequest {
  token: string
  newPassword: string
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

export interface SelfPublishRequest {
  orderType: OrderType
  scheduledTime: string
  flightNumber: string
  vehicleType: VehicleType
  passengerCount: number
  luggage: Array<{ size: string; quantity: number }>
  pickupLocation: string
  dropoffLocation: string
  contactName: string
  contactPhone: string
  feeMode: 'transfer' | 'cash_collection'
  driverAmount: number
  cashCollected?: number
  commissionReturn?: number
  specialNeeds: string[]
  notes?: string
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
