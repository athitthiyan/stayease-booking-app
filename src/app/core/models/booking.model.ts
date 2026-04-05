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
  nights: number;
  room_rate: number;
  taxes: number;
  service_fee: number;
  total_amount: number;
  status: BookingStatus;
  payment_status: PaymentStatus;
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
  expires_at: string;
  remaining_seconds: number;
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
