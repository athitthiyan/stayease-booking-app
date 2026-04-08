import { Room } from './room.model';

export interface ApiErrorDetail {
  code: string;
  message: string;
  field?: string;
}

export interface ApiErrorResponse {
  detail: ApiErrorDetail | string;
}

export type BookingStatus =
  | 'pending'
  | 'processing'
  | 'confirmed'
  | 'cancelled'
  | 'completed'
  | 'expired';

export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'paid'
  | 'failed'
  | 'refunded'
  | 'expired';

export type RefundStatus =
  | 'refund_requested'
  | 'refund_initiated'
  | 'refund_processing'
  | 'refund_success'
  | 'refund_failed'
  | 'refund_reversed';

export type BookingLifecycleState =
  | 'HOLD_CREATED'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_RETRY'
  | 'PAYMENT_COOLDOWN'
  | 'PAYMENT_SUCCESS'
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'REFUNDED';

export type BookingSupportCategory =
  | 'payment_help'
  | 'cancellation_help'
  | 'refund_help'
  | 'booking_issue';

export interface CreateBookingRequest {
  user_name: string;
  email: string;
  phone?: string;
  room_id: number;
  check_in: string;
  check_out: string;
  guests: number;
  adults: number;
  children: number;
  infants: number;
  special_requests?: string;
}

export interface Booking {
  id: number;
  booking_ref: string;
  user_name: string;
  email: string;
  phone?: string;
  room_id: number;
  room?: Room;
  check_in: string;
  check_out: string;
  /** ISO timestamp — present only while the booking is in the PENDING hold window */
  hold_expires_at?: string;
  guests: number;
  adults: number;
  children: number;
  infants: number;
  nights: number;
  room_rate: number;
  taxes: number;
  service_fee: number;
  total_amount: number;
  status: BookingStatus;
  payment_status: PaymentStatus;
  refund_status?: RefundStatus;
  refund_amount?: number;
  refund_requested_at?: string;
  refund_initiated_at?: string;
  refund_expected_settlement_at?: string;
  refund_completed_at?: string;
  refund_failed_reason?: string;
  refund_gateway_reference?: string;
  special_requests?: string;
  created_at: string;
}

export interface ActiveHold {
  booking_id: number;
  room_id: number;
  hotel_name: string;
  room_name: string;
  check_in: string;
  check_out: string;
  guests: number;
  adults: number;
  children: number;
  infants: number;
  expires_at: string;
  remaining_seconds: number;
  lifecycle_state?: BookingLifecycleState;
  booking_status?: BookingStatus;
  payment_status?: PaymentStatus;
}

export interface UnavailableDatesResponse {
  /** Confirmed/permanently blocked dates — will not free up. */
  unavailable_dates: string[];
  /** Temporarily locked by an active hold — may free up. */
  held_dates: string[];
}

export interface BookingListResponse {
  bookings: Booking[];
  total: number;
}

export interface MyBookingsResponse {
  bookings: Booking[];
  total: number;
  upcoming: number;
  past: number;
  cancelled: number;
}
