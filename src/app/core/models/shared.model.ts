export interface ApiErrorDetail {
  code?: string;
  loc?: Array<string | number>;
  message?: string;
  msg: string;
  type?: string;
}

export interface ApiErrorResponse {
  detail: string | ApiErrorDetail[];
}

export interface MessageResponse {
  message: string;
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

export type TransactionStatus =
  | 'pending'
  | 'processing'
  | 'success'
  | 'failed'
  | 'expired'
  | 'refunded';

export type RoomType = 'standard' | 'deluxe' | 'suite' | 'penthouse';

export type RoomSortOption =
  | 'recommended'
  | 'price_low_to_high'
  | 'price_high_to_low'
  | 'top_rated'
  | 'most_popular';

export interface RoomSummary {
  hotel_name: string;
  image_url?: string;
  location?: string;
}

export interface Room {
  id: number;
  hotel_name: string;
  room_type: RoomType;
  description?: string;
  price: number;
  original_price?: number;
  availability: boolean;
  rating: number;
  review_count: number;
  image_url?: string;
  gallery_urls?: string;
  amenities?: string;
  location?: string;
  city?: string;
  country?: string;
  max_guests: number;
  beds: number;
  bathrooms: number;
  size_sqft?: number;
  floor?: number;
  is_featured: boolean;
  created_at: string;
  latitude?: number;
  longitude?: number;
  map_embed_url?: string;
  availabilityState?: 'available' | 'unavailable' | 'loading';
  availabilityMessage?: string;
}

export interface RoomListResponse {
  rooms: Room[];
  total: number;
  page: number;
  per_page: number;
}

export interface RoomSearchParams {
  query?: string;
  city?: string;
  landmark?: string;
  room_type?: string;
  min_price?: number;
  max_price?: number;
  min_rating?: number;
  amenities?: string;
  guests?: number;
  adults?: number;
  children?: number;
  infants?: number;
  check_in?: string;
  check_out?: string;
  featured?: boolean;
  sort_by?: RoomSortOption;
  page?: number;
  per_page?: number;
}

export interface UserResponse {
  id: number;
  email: string;
  full_name: string;
  phone: string | null;
  is_email_verified?: boolean;
  phone_verified?: boolean;
  avatar_url: string | null;
  is_admin: boolean;
  is_partner?: boolean;
  is_active: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  user: UserResponse;
}

export interface UserSignup {
  email: string;
  phone: string;
  full_name: string;
  password: string;
  email_challenge_id: string;
  phone_challenge_id: string;
}

export interface UserLogin {
  email: string;
  password: string;
}

export interface ForgotPasswordRequest {
  channel: OtpChannel;
  recipient: string;
  device_fingerprint?: string;
}

export interface ResetPasswordRequest {
  reset_token: string;
  new_password: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface UserProfileUpdate {
  full_name?: string;
  email?: string;
  phone?: string;
  avatar_url?: string;
  email_challenge_id?: string;
  phone_challenge_id?: string;
}

export type OtpFlow = 'signup' | 'profile' | 'password_reset';
export type OtpChannel = 'email' | 'phone';

export interface OtpChallengeStartRequest {
  flow: OtpFlow;
  channel: OtpChannel;
  recipient: string;
  device_fingerprint?: string;
}

export interface OtpChallengeResponse {
  message: string;
  challenge_id: string;
  flow: OtpFlow;
  channel: OtpChannel;
  recipient: string;
  expires_in_seconds: number;
  resend_available_in_seconds: number;
  resends_remaining: number;
  attempts_remaining: number;
  max_resends: number;
  max_attempts: number;
  dev_code?: string;
  blocked_until?: string;
}

export interface OtpChallengeVerifyRequest {
  challenge_id: string;
  otp: string;
}

export interface OtpChallengeVerifyResponse {
  message: string;
  challenge_id: string;
  flow: OtpFlow;
  channel: OtpChannel;
  recipient: string;
  reset_token?: string;
}

export interface SocialLoginRequest {
  provider: 'google' | 'apple' | 'microsoft';
  id_token: string;
}
