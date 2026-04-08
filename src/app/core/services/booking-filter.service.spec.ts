import { BookingFilterService } from './booking-filter.service';
import { Booking } from '../models/booking.model';

const baseBooking: Booking = {
  id: 1,
  booking_ref: 'BK-1',
  user_name: 'Test User',
  email: 'test@example.com',
  room_id: 10,
  check_in: '2026-04-10T00:00:00.000Z',
  check_out: '2026-04-12T00:00:00.000Z',
  guests: 2,
  adults: 2,
  children: 0,
  infants: 0,
  nights: 2,
  room_rate: 100,
  taxes: 10,
  service_fee: 5,
  total_amount: 115,
  status: 'confirmed',
  payment_status: 'paid',
  created_at: '2026-04-01T00:00:00.000Z',
};

function makeBooking(overrides: Partial<Booking>): Booking {
  return { ...baseBooking, ...overrides };
}

describe('BookingFilterService', () => {
  const realDate = Date;
  let service: BookingFilterService;

  beforeEach(() => {
    service = new BookingFilterService();
    const fixedNow = new realDate('2026-04-11T12:00:00.000Z');
    global.Date = class extends realDate {
      constructor(value?: string | number | Date) {
        super(value ?? fixedNow.toISOString());
      }

      static override now(): number {
        return fixedNow.getTime();
      }

      static override parse(dateString: string): number {
        return realDate.parse(dateString);
      }

      static override UTC(
        year: number,
        monthIndex: number,
        date?: number,
        hours?: number,
        minutes?: number,
        seconds?: number,
        ms?: number,
      ): number {
        return realDate.UTC(year, monthIndex, date ?? 1, hours ?? 0, minutes ?? 0, seconds ?? 0, ms ?? 0);
      }
    } as DateConstructor;
  });

  afterEach(() => {
    global.Date = realDate;
  });

  it('filters upcoming bookings for confirmed, pending, and processing stays', () => {
    const bookings = [
      makeBooking({ id: 1, status: 'confirmed' }),
      makeBooking({ id: 2, status: 'pending' }),
      makeBooking({ id: 3, status: 'processing' }),
      makeBooking({ id: 4, status: 'completed' }),
      makeBooking({ id: 5, status: 'cancelled' }),
      makeBooking({ id: 6, status: 'confirmed', check_out: '2026-04-10T00:00:00.000Z' }),
    ];

    expect(service.filterUpcoming(bookings).map(booking => booking.id)).toEqual([1, 2, 3]);
  });

  it('filters past, cancelled, expired, refunded, and active bookings', () => {
    const bookings = [
      makeBooking({ id: 1, status: 'completed' }),
      makeBooking({ id: 2, status: 'confirmed', check_out: '2026-04-10T00:00:00.000Z' }),
      makeBooking({ id: 3, status: 'cancelled' }),
      makeBooking({ id: 4, status: 'expired' }),
      makeBooking({ id: 5, payment_status: 'refunded' }),
      makeBooking({ id: 6, status: 'confirmed', check_out: '2026-04-15T00:00:00.000Z' }),
    ];

    expect(service.filterPast(bookings).map(booking => booking.id)).toEqual([1, 2]);
    expect(service.filterCancelled(bookings).map(booking => booking.id)).toEqual([3]);
    expect(service.filterExpired(bookings).map(booking => booking.id)).toEqual([4]);
    expect(service.filterRefunded(bookings).map(booking => booking.id)).toEqual([5]);
    expect(service.filterActive(bookings).map(booking => booking.id)).toEqual([5, 6]);
  });

  it('dispatches tab filters and falls back to the full list for unknown tabs', () => {
    const bookings = [
      makeBooking({ id: 1, status: 'cancelled' }),
      makeBooking({ id: 2, status: 'expired' }),
      makeBooking({ id: 3, payment_status: 'refunded' }),
      makeBooking({ id: 4, status: 'confirmed' }),
    ];

    expect(service.filterByTab(bookings, 'cancelled').map(booking => booking.id)).toEqual([1]);
    expect(service.filterByTab(bookings, 'expired').map(booking => booking.id)).toEqual([2]);
    expect(service.filterByTab(bookings, 'refunded').map(booking => booking.id)).toEqual([3]);
    expect(service.filterByTab(bookings, 'active').map(booking => booking.id)).toEqual([3, 4]);
    expect(service.filterByTab(bookings, 'unknown')).toEqual(bookings);
  });

  it('returns counts and fallback badge styles', () => {
    const bookings = [
      makeBooking({ id: 1, status: 'confirmed' }),
      makeBooking({ id: 2, status: 'cancelled' }),
      makeBooking({ id: 3, status: 'expired' }),
      makeBooking({ id: 4, payment_status: 'refunded' }),
    ];

    expect(service.getCounts(bookings)).toEqual({
      upcoming: 2,
      past: 0,
      cancelled: 1,
      expired: 1,
      refunded: 1,
      active: 2,
    });
    expect(service.getStatusStyle('pending')).toEqual({
      label: 'Pending',
      color: '#fbbf24',
      bgColor: 'rgba(251,191,36,0.15)',
    });
    expect(service.getStatusStyle('mystery')).toEqual({
      label: 'mystery',
      color: '#9ca3af',
      bgColor: 'rgba(107,114,128,0.1)',
    });
    expect(service.getPaymentStyle('failed')).toEqual({
      label: 'Failed',
      color: '#f87171',
      bgColor: 'rgba(239,68,68,0.15)',
    });
    expect(service.getPaymentStyle('unknown')).toEqual({
      label: 'unknown',
      color: '#9ca3af',
      bgColor: 'rgba(107,114,128,0.1)',
    });
  });

  it('builds booking timelines for cancelled, expired, confirmed, and completed stays', () => {
    expect(service.getBookingTimeline(makeBooking({ status: 'cancelled' }))).toEqual([
      { label: 'Booked', done: true, current: false },
      { label: 'Cancelled', done: true, current: true },
    ]);
    expect(service.getBookingTimeline(makeBooking({ status: 'expired' }))).toEqual([
      { label: 'Booked', done: true, current: false },
      { label: 'Expired', done: true, current: true },
    ]);

    const upcomingConfirmed = service.getBookingTimeline(makeBooking({
      status: 'confirmed',
      check_in: '2026-04-12T00:00:00.000Z',
      check_out: '2026-04-14T00:00:00.000Z',
    }));
    expect(upcomingConfirmed[1]).toEqual({ label: 'Confirmed', done: true, current: true });

    const inStay = service.getBookingTimeline(makeBooking({
      status: 'confirmed',
      check_in: '2026-04-10T00:00:00.000Z',
      check_out: '2026-04-12T23:59:59.000Z',
    }));
    expect(inStay[2]).toEqual({ label: 'Checked In', done: true, current: true });

    const completed = service.getBookingTimeline(makeBooking({ status: 'completed' }));
    expect(completed[3]).toEqual({ label: 'Completed', done: true, current: true });

    const autoPast = service.getBookingTimeline(makeBooking({
      status: 'confirmed',
      check_in: '2026-04-01T00:00:00.000Z',
      check_out: '2026-04-02T00:00:00.000Z',
    }));
    expect(autoPast[3]).toEqual({ label: 'Completed', done: true, current: false });
  });
});
