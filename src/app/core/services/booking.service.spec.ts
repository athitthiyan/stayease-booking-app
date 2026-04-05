import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import { BookingService, CheckoutState } from './booking.service';
import { environment } from '../../../environments/environment';

describe('BookingService', () => {
  let service: BookingService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(BookingService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    sessionStorage.clear();
  });

  // ── Checkout state ──────────────────────────────────────────────────────────

  it('persists checkout state to session storage', () => {
    const state: CheckoutState = {
      room: null,
      checkIn: '2026-04-10',
      checkOut: '2026-04-12',
      guests: 2,
    };
    service.setCheckoutState(state);
    expect(service.getCheckoutState()).toEqual(state);
  });

  it('restores checkout state from session storage on cold start', () => {
    const state: CheckoutState = { room: null, checkIn: '2026-05-01', checkOut: '2026-05-03', guests: 1 };
    sessionStorage.setItem('checkout_state', JSON.stringify(state));
    expect(service.getCheckoutState()).toEqual(state);
  });

  it('returns null when no checkout state exists', () => {
    sessionStorage.removeItem('checkout_state');
    expect(service.getCheckoutState()).toBeNull();
  });

  // ── Booking API calls ───────────────────────────────────────────────────────

  it('fetches booking by ref', () => {
    service.getBookingByRef('BK123').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/bookings/ref/BK123`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('fetches booking by id', () => {
    service.getBooking(42).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/bookings/42`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('creates booking with correct payload', () => {
    const payload = {
      user_name: 'Test User', email: 'test@example.com', phone: '+1234567890',
      room_id: 42, check_in: '2026-05-10T12:00:00Z', check_out: '2026-05-12T12:00:00Z',
      guests: 2, special_requests: 'Late checkout',
    };
    service.createBooking(payload).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/bookings`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ id: 1, booking_ref: 'BKTEST01', status: 'pending' });
  });

  it('cancels booking by id with PATCH', () => {
    service.cancelBooking(99).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/bookings/99/cancel`);
    expect(req.request.method).toBe('PATCH');
    req.flush({ id: 99, status: 'cancelled' });
  });

  it('returns active hold payload when one exists', () => {
    let result: unknown;
    service.getActiveHold().subscribe(value => (result = value));
    const req = httpMock.expectOne(`${environment.apiUrl}/bookings/active-hold`);
    expect(req.request.method).toBe('GET');
    req.flush({
      booking_id: 12,
      room_id: 5,
      hotel_name: 'Azure',
      room_name: 'suite',
      check_in: '2026-05-01',
      check_out: '2026-05-03',
      guests: 2,
      expires_at: '2026-05-01T10:00:00.000Z',
      remaining_seconds: 600,
    });
    expect(result).toEqual(
      expect.objectContaining({
        booking_id: 12,
        hotel_name: 'Azure',
      }),
    );
  });

  it('returns null when active hold endpoint responds with 204', () => {
    let result: unknown = 'unset';
    service.getActiveHold().subscribe(value => (result = value));
    const req = httpMock.expectOne(`${environment.apiUrl}/bookings/active-hold`);
    req.flush(null, { status: 204, statusText: 'No Content' });
    expect(result).toBeNull();
  });

  it('fetches booking history by email using query param', () => {
    service.getBookingHistory('user@example.com').subscribe();
    const req = httpMock.expectOne(r =>
      r.url === `${environment.apiUrl}/bookings/history` &&
      r.params.get('email') === 'user@example.com'
    );
    expect(req.request.method).toBe('GET');
    req.flush({ bookings: [], total: 0 });
  });

  // ── Availability ────────────────────────────────────────────────────────────

  it('fetches unavailable dates for a room with correct params', () => {
    service.getUnavailableDates(5, '2026-05-01', '2026-05-31').subscribe();
    const req = httpMock.expectOne(r =>
      r.url === `${environment.apiUrl}/rooms/5/unavailable-dates`
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('from_date')).toBe('2026-05-01');
    expect(req.request.params.get('to_date')).toBe('2026-05-31');
    req.flush({ unavailable_dates: ['2026-05-10'], held_dates: ['2026-05-15'] });
  });

  it('getMonthAvailability sends correct from/to dates for May 2026', () => {
    service.getMonthAvailability(7, '2026-05').subscribe();
    const req = httpMock.expectOne(r =>
      r.url === `${environment.apiUrl}/rooms/7/unavailable-dates`
    );
    expect(req.request.params.get('from_date')).toBe('2026-05-01');
    expect(req.request.params.get('to_date')).toBe('2026-05-31');
    req.flush({ unavailable_dates: [], held_dates: [] });
  });

  it('getMonthAvailability sends correct to_date for February 2028 (leap year)', () => {
    service.getMonthAvailability(7, '2028-02').subscribe();
    const req = httpMock.expectOne(r =>
      r.url === `${environment.apiUrl}/rooms/7/unavailable-dates`
    );
    expect(req.request.params.get('from_date')).toBe('2028-02-01');
    expect(req.request.params.get('to_date')).toBe('2028-02-29');
    req.flush({ unavailable_dates: [], held_dates: [] });
  });

  it('getMonthAvailability sends correct to_date for February 2026 (non-leap year)', () => {
    service.getMonthAvailability(7, '2026-02').subscribe();
    const req = httpMock.expectOne(r =>
      r.url === `${environment.apiUrl}/rooms/7/unavailable-dates`
    );
    expect(req.request.params.get('from_date')).toBe('2026-02-01');
    expect(req.request.params.get('to_date')).toBe('2026-02-28');
    req.flush({ unavailable_dates: [], held_dates: [] });
  });

  // ── Resumable booking ───────────────────────────────────────────────────────

  it('returns null when no resumable booking exists (404 becomes null)', () => {
    let result: unknown = 'untested';
    service
      .findResumableBooking(1, '2026-05-10T00:00:00Z', '2026-05-12T00:00:00Z', 'a@b.com')
      .subscribe(val => (result = val));
    const req = httpMock.expectOne(r => r.url === `${environment.apiUrl}/bookings/resumable`);
    req.flush({ detail: 'Not found' }, { status: 404, statusText: 'Not Found' });
    expect(result).toBeNull();
  });

  it('returns booking when resumable booking exists', () => {
    const mockBooking = {
      id: 5, booking_ref: 'BK5', status: 'pending',
      hold_expires_at: new Date(Date.now() + 600000).toISOString(),
    };
    let result: unknown;
    service
      .findResumableBooking(1, '2026-05-10T00:00:00Z', '2026-05-12T00:00:00Z', 'a@b.com')
      .subscribe(val => (result = val));
    const req = httpMock.expectOne(r => r.url === `${environment.apiUrl}/bookings/resumable`);
    req.flush(mockBooking);
    expect(result).toEqual(mockBooking);
  });

  it('returns null when resumable booking returns 500 (defensive fallback)', () => {
    let result: unknown = 'untested';
    service
      .findResumableBooking(1, '2026-05-10T00:00:00Z', '2026-05-12T00:00:00Z', 'a@b.com')
      .subscribe(val => (result = val));
    const req = httpMock.expectOne(r => r.url === `${environment.apiUrl}/bookings/resumable`);
    req.flush({ detail: 'Server error' }, { status: 500, statusText: 'Internal Server Error' });
    expect(result).toBeNull();
  });

  // ── Extend hold ─────────────────────────────────────────────────────────────

  it('extends hold for a booking with correct email payload', () => {
    service.extendHold(10, 'user@example.com').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/bookings/10/extend-hold`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'user@example.com' });
    req.flush({
      id: 10, status: 'pending',
      hold_expires_at: new Date(Date.now() + 600000).toISOString(),
    });
  });
});
