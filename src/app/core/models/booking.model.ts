import { Room } from './room.model';

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

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
