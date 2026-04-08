import {
  activeHoldCacheKeys,
  isActiveReservationVisible,
  resolveActiveHoldSyncReason,
} from './active-booking-visibility';
import { ActiveHold } from '../models/booking.model';

const hold = (overrides: Partial<ActiveHold> = {}): ActiveHold => ({
  booking_id: 17,
  room_id: 9,
  hotel_name: 'Grand Azure',
  room_name: 'suite',
  check_in: '2026-05-01',
  check_out: '2026-05-03',
  guests: 2,
  adults: 2,
  children: 0,
  infants: 0,
  expires_at: '2026-05-01T10:10:00.000Z',
  remaining_seconds: 600,
  ...overrides,
});

describe('active booking visibility rules', () => {
  it.each([
    null,
    hold({ remaining_seconds: 0 }),
    hold({ lifecycle_state: 'CONFIRMED' }),
    hold({ lifecycle_state: 'CANCELLED' }),
    hold({ lifecycle_state: 'EXPIRED' }),
    hold({ lifecycle_state: 'REFUNDED' }),
    hold({ lifecycle_state: 'PAYMENT_SUCCESS' }),
    hold({ lifecycle_state: 'PAYMENT_RETRY' }),
    hold({ booking_status: 'cancelled' }),
    hold({ booking_status: 'confirmed' }),
    hold({ booking_status: 'completed' }),
    hold({ booking_status: 'expired' }),
    hold({ payment_status: 'paid' }),
    hold({ payment_status: 'refunded' }),
    hold({ payment_status: 'expired' }),
    hold({ payment_status: 'unknown' as ActiveHold['payment_status'] }),
  ])('hides non-actionable reservation state %#', candidate => {
    expect(isActiveReservationVisible(candidate)).toBe(false);
  });

  it.each([
    hold(),
    hold({ lifecycle_state: 'HOLD_CREATED', payment_status: 'pending' }),
    hold({ lifecycle_state: 'PAYMENT_PENDING', payment_status: 'processing' }),
    hold({ lifecycle_state: 'PAYMENT_FAILED', payment_status: 'failed' }),
    hold({ lifecycle_state: 'PAYMENT_COOLDOWN', payment_status: 'failed' }),
  ])('shows actionable reservation state %#', candidate => {
    expect(isActiveReservationVisible(candidate)).toBe(true);
  });

  it.each([
    [hold({ lifecycle_state: 'CONFIRMED' }), 'confirmed'],
    [hold({ lifecycle_state: 'REFUNDED' }), 'confirmed'],
    [hold({ booking_status: 'confirmed' }), 'confirmed'],
    [hold({ payment_status: 'paid' }), 'confirmed'],
    [hold({ payment_status: 'refunded' }), 'confirmed'],
    [hold({ lifecycle_state: 'CANCELLED' }), 'cancelled'],
    [hold({ booking_status: 'cancelled' }), 'cancelled'],
    [hold({ lifecycle_state: 'EXPIRED' }), 'expired'],
  ] as const)('maps closed reservation state %# to sync reason', (candidate, reason) => {
    expect(resolveActiveHoldSyncReason(candidate)).toBe(reason);
  });

  it('lists every stale cache key removed when active hold state closes', () => {
    expect(activeHoldCacheKeys).toEqual([
      'activeBookingId',
      'holdExpiry',
      'activeHoldTimer',
      'paymentRetryState',
      'se_active_booking_visibility',
      'se_active_booking_cache',
      'pending_booking',
    ]);
  });
});
