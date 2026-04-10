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
      adults: 2,
      children: 0,
      infants: 0,
    };
    service.setCheckoutState(state);
    expect(service.getCheckoutState()).toEqual(state);
  });

  it('restores checkout state from session storage on cold start', () => {
    const state: CheckoutState = { room: null, checkIn: '2026-05-01', checkOut: '2026-05-03', guests: 1, adults: 1, children: 0, infants: 0 };
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

  it('downloads invoice with optional booking reference', () => {
    let blobResult: Blob | undefined;
    service.downloadInvoice(42, 'BK42').subscribe(blob => (blobResult = blob));
    const req = httpMock.expectOne(
      r => r.url === `${environment.apiUrl}/bookings/42/invoice` && r.params.get('booking_ref') === 'BK42',
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['invoice']));
    expect(blobResult).toBeInstanceOf(Blob);
  });

  it('downloads voucher with booking reference when provided', () => {
    let blobResult: Blob | undefined;
    service.downloadVoucher(42, 'BK42').subscribe(blob => (blobResult = blob));
    const req = httpMock.expectOne(
      r => r.url === `${environment.apiUrl}/bookings/42/voucher` && r.params.get('booking_ref') === 'BK42',
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['voucher']));
    expect(blobResult).toBeInstanceOf(Blob);
  });

  it('downloads voucher without booking reference when auth is available', () => {
    let blobResult: Blob | undefined;
    service.downloadVoucher(42).subscribe(blob => (blobResult = blob));
    const req = httpMock.expectOne(`${environment.apiUrl}/bookings/42/voucher`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.has('booking_ref')).toBe(false);
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['voucher']));
    expect(blobResult).toBeInstanceOf(Blob);
  });

  it('creates booking with correct payload', () => {
    const payload = {
      user_name: 'Test User', email: 'test@example.com', phone: '+1234567890',
      room_id: 42, check_in: '2026-05-10T12:00:00Z', check_out: '2026-05-12T12:00:00Z',
      guests: 2, adults: 2, children: 0, infants: 0, special_requests: 'Late checkout',
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

  it('creates a booking support request with the expected payload', () => {
    let result: unknown;
    service
      .requestBookingSupport(55, 'cancellation_help', 'Need help cancelling this stay.')
      .subscribe(response => (result = response));
    const req = httpMock.expectOne(`${environment.apiUrl}/bookings/55/support-request`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      category: 'cancellation_help',
      message: 'Need help cancelling this stay.',
    });
    req.flush({ message: 'Support request submitted. Our team will contact you shortly.' });
    expect(result).toEqual({
      message: 'Support request submitted. Our team will contact you shortly.',
    });
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
      adults: 2,
      children: 0,
      infants: 0,
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

  it('deduplicates concurrent active-hold fetches into a single request', () => {
    const results: Array<unknown> = [];

    service.getActiveHold().subscribe(value => results.push(value));
    service.getActiveHold().subscribe(value => results.push(value));

    const reqs = httpMock.match(`${environment.apiUrl}/bookings/active-hold`);
    expect(reqs).toHaveLength(1);
    reqs[0].flush({
      booking_id: 12,
      room_id: 5,
      hotel_name: 'Azure',
      room_name: 'suite',
      check_in: '2026-05-01',
      check_out: '2026-05-03',
      guests: 2,
      adults: 2,
      children: 0,
      infants: 0,
      expires_at: '2026-05-01T10:00:00.000Z',
      remaining_seconds: 600,
    });

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual(results[1]);
  });

  it('allows a new active-hold fetch after the previous one completes', () => {
    service.getActiveHold().subscribe();
    httpMock.expectOne(`${environment.apiUrl}/bookings/active-hold`).flush(null, {
      status: 204,
      statusText: 'No Content',
    });

    service.getActiveHold().subscribe();
    httpMock.expectOne(`${environment.apiUrl}/bookings/active-hold`).flush(null, {
      status: 204,
      statusText: 'No Content',
    });
  });

  it('re-throws non-204 errors from getActiveHold', () => {
    let error: unknown;
    service.getActiveHold().subscribe({ error: err => (error = err) });
    const req = httpMock.expectOne(`${environment.apiUrl}/bookings/active-hold`);
    req.flush({ detail: 'Server error' }, { status: 500, statusText: 'Internal Server Error' });
    expect(error).toBeDefined();
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

  it('clearCheckoutState removes from sessionStorage and resets BehaviorSubject', () => {
    const state: CheckoutState = {
      room: null,
      checkIn: '2026-05-01',
      checkOut: '2026-05-03',
      guests: 2,
      adults: 2,
      children: 0,
      infants: 0,
    };
    service.setCheckoutState(state);
    expect(service.getCheckoutState()).toEqual(state);
    expect(sessionStorage.getItem('checkout_state')).toBeTruthy();

    service.clearCheckoutState();
    expect(sessionStorage.getItem('checkout_state')).toBeNull();
    expect(service.getCheckoutState()).toBeNull();
  });

  it('getCheckoutState hydrates from sessionStorage when BehaviorSubject is empty', () => {
    const state: CheckoutState = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      room: { id: 5, hotel_name: 'Test Hotel', availability: true } as any,
      checkIn: '2026-06-01',
      checkOut: '2026-06-05',
      guests: 4,
      adults: 2,
      children: 2,
      infants: 0,
    };
    sessionStorage.setItem('checkout_state', JSON.stringify(state));

    const retrieved = service.getCheckoutState();
    expect(retrieved).toEqual(state);
  });

  it('getCheckoutState emits restored state to observable', (done) => {
    const state: CheckoutState = {
      room: null,
      checkIn: '2026-07-10',
      checkOut: '2026-07-12',
      guests: 3,
      adults: 2,
      children: 1,
      infants: 0,
    };
    sessionStorage.setItem('checkout_state', JSON.stringify(state));

    let emitted: CheckoutState | null = null;
    service.checkoutState$.subscribe(value => {
      emitted = value;
    });

    service.getCheckoutState();

    setTimeout(() => {
      expect(emitted).toEqual(state);
      done();
    }, 10);
  });

  it('getCheckoutState returns BehaviorSubject value when sessionStorage is empty', () => {
    const state: CheckoutState = {
      room: null,
      checkIn: '2026-08-01',
      checkOut: '2026-08-03',
      guests: 1,
      adults: 1,
      children: 0,
      infants: 0,
    };
    service.setCheckoutState(state);
    sessionStorage.removeItem('checkout_state');

    const retrieved = service.getCheckoutState();
    expect(retrieved).toEqual(state);
  });

  it('getCheckoutState handles complex nested room objects in stored state', () => {
    const state: CheckoutState = {
      room: {
        id: 42,
        hotel_name: 'Premium Hotel',
        availability: true,
        price: 5000,
        currency: 'INR',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      checkIn: '2026-09-15',
      checkOut: '2026-09-20',
      guests: 5,
      adults: 3,
      children: 2,
      infants: 0,
    };
    sessionStorage.setItem('checkout_state', JSON.stringify(state));

    const retrieved = service.getCheckoutState();
    expect(retrieved).toEqual(state);
    expect(retrieved?.room?.id).toBe(42);
    expect(retrieved?.room?.hotel_name).toBe('Premium Hotel');
  });

  it('getCheckoutState prioritizes sessionStorage over empty BehaviorSubject', () => {
    const storedState: CheckoutState = {
      room: null,
      checkIn: '2026-10-01',
      checkOut: '2026-10-03',
      guests: 2,
      adults: 2,
      children: 0,
      infants: 0,
    };
    sessionStorage.setItem('checkout_state', JSON.stringify(storedState));

    // Do not call setCheckoutState, so BehaviorSubject is null
    const retrieved = service.getCheckoutState();
    expect(retrieved).toEqual(storedState);
  });
});
