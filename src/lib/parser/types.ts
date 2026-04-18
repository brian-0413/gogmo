// Types matching SKILL.md output schema

export type ParseStatus = 'accepted' | 'needs_review' | 'rejected'
export type ParseMode = 'strict' | 'lenient'

export interface Field<T = string | number | string[] | null> {
  value: T
  confidence: number
  raw?: string | null
}

export interface OrderFields {
  date: Field<string | null>
  time: Field<string | null>
  type: Field<string | null>        // "pickup" | "dropoff" | "transfer" | "charter"
  origin: Field<string | null>
  destination: Field<string | null>
  price: Field<number | null>
  vehicle_type: Field<string | null> // "small" | "suv" | "large" | "van9" | "any" | "imported" | "mercedes_v" | "g_independent"
  flight_number: Field<string | null>
  passenger_count: Field<number | null>
  luggage_count: Field<number | null>
  special_requirements: Field<string[] | null>
}

export interface DuplicateWarning {
  detected: boolean
  count: number
  first_seen_at: string
  last_seen_at: string
  similarity_score: number
  dispatcher_id?: string
  suggested_action?: string
}

export interface ParseMetadata {
  input_message_id?: string
  parsed_at: string
  total_orders_detected: number
  noise_filtered_count: number
  duplicate_warning: DuplicateWarning | null
  message_sent_at?: string
  dispatcher_id?: string
  mode_used: ParseMode
}

export interface ParsedOrder {
  id?: string
  parse_status: ParseStatus
  overall_confidence: number
  fields: OrderFields
  rejection_reasons?: string[]
  rewrite_suggestion?: string | null
  raw_segment?: string
  dispatcher_ref?: string
  bundle_intent?: boolean
  bundle_ref?: string
  bundle_split_warning?: boolean  // true = 此訂單來自套裝單自動拆分
  original_bundle_ref?: string    // 原始套裝單的識別編號
  multi_stop?: boolean
}

export interface RejectedMessage {
  raw: string
  reasons: string[]
  rewrite_suggestion?: string
}

export interface ParseResult {
  parse_metadata: ParseMetadata
  orders: ParsedOrder[]
  rejected_messages: RejectedMessage[]
}
