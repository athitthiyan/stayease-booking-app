import { ActiveHold, BookingLifecycleState, BookingStatus, PaymentStatus } from '../models/booking.model';

export const activeHoldCacheKeys = [
  'activeBookingId',
  'holdExpiry',
  'activeHoldTimer',
  'paymentRetryState',
  'se_active_booking_visibility',
  'se_active_booking_cache',
  'pending_booking',
];

const visibleLifecycleStates = new Set<BookingLifecycleState>([
  'HOLD_CREATED',
  'PAYMENT_FAILED',
  'PAYMENT_PENDING',
  'PAYMENT_COOLDOWN',
]);

const hiddenLifecycleStates = new Set<BookingLifecycleState>([
  'EXPIRED',
  'CANCELLED',
  'CONFIRMED',
  'REFUNDED',
  'PAYMENT_SUCCESS',
]);

const hiddenBookingStatuses = new Set<BookingStatus>([
  'cancelled',
  'confirmed',
  'completed',
  'expired',
]);

const visiblePaymentStatuses = new Set<PaymentStatus>([
  'pending',
  'processing',
  'failed',
]);

const hiddenPaymentStatuses = new Set<PaymentStatus>([
  'paid',
  'refunded',
  'expired',
]);

export type ActiveHoldSyncReason = 'refresh' | 'cancelled' | 'expired' | 'confirmed' | 'login' | 'logout';

export function isActiveReservationVisible(hold: ActiveHold | null): boolean {
  if (!hold || hold.remaining_seconds <= 0) {
    return false;
  }

  if (hold.lifecycle_state && hiddenLifecycleStates.has(hold.lifecycle_state)) {
    return false;
  }

  if (hold.lifecycle_state && !visibleLifecycleStates.has(hold.lifecycle_state)) {
    return false;
  }

  if (hold.booking_status && hiddenBookingStatuses.has(hold.booking_status)) {
    return false;
  }

  if (hold.payment_status && hiddenPaymentStatuses.has(hold.payment_status)) {
    return false;
  }

  if (hold.payment_status && !visiblePaymentStatuses.has(hold.payment_status)) {
    return false;
  }

  return true;
}

export function resolveActiveHoldSyncReason(hold: ActiveHold): ActiveHoldSyncReason {
  if (
    hold.lifecycle_state === 'CONFIRMED' ||
    hold.lifecycle_state === 'REFUNDED' ||
    hold.booking_status === 'confirmed' ||
    hold.payment_status === 'paid' ||
    hold.payment_status === 'refunded'
  ) {
    return 'confirmed';
  }

  if (hold.lifecycle_state === 'CANCELLED' || hold.booking_status === 'cancelled') {
    return 'cancelled';
  }

  return 'expired';
}
