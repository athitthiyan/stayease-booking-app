/**
 * Extended branch-coverage tests for BookingService
 * Covers branches not in the original booking.service.spec.ts:
 *   – getCheckoutState: stored=null → falls back to BehaviorSubject value
 *   – createBooking, getBookingHistory, cancelBooking HTTP calls
 */

import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import { BookingService, CheckoutState } from './booking.service';
import { environment } from '../../../environments/environment';

describe('BookingService (extended branches)', () => {
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

  describe('getCheckoutState', () => {
    it('returns BehaviorSubject value when sessionStorage is empty', () => {
      // Nothing in sessionStorage → branch: `stored` is falsy → return _checkoutState$.value
      const result = service.getCheckoutState();
      expect(result).toBeNull();
    });

    it('restores state from sessionStorage and updates BehaviorSubject', () => {
      const state: CheckoutState = {
        room: null,
        checkIn: '2027-01-01',
        checkOut: '2027-01-03',
        guests: 1,
      };
      sessionStorage.setItem('checkout_state', JSON.stringify(state));
      const result = service.getCheckoutState();
      expect(result).toEqual(state);
    });
  });

  describe('createBooking', () => {
    it('POSTs to /bookings and returns the created booking', () => {
      const payload: any = {
        room_id: 5,
        check_in: '2027-01-10',
        check_out: '2027-01-12',
        guests: 2,
        user_name: 'Athit',
        email: 'athit@example.com',
        total_amount: 468,
      };
      service.createBooking(payload).subscribe(booking => {
        expect(booking).toEqual({ id: 99, booking_ref: 'BK999' });
      });
      const req = httpMock.expectOne(`${environment.apiUrl}/bookings`);
      expect(req.request.method).toBe('POST');
      req.flush({ id: 99, booking_ref: 'BK999' });
    });
  });

  describe('getBookingHistory', () => {
    it('GETs /bookings/history with email param', () => {
      service.getBookingHistory('athit@example.com').subscribe();
      const req = httpMock.expectOne(
        r =>
          r.url === `${environment.apiUrl}/bookings/history` &&
          r.params.get('email') === 'athit@example.com',
      );
      expect(req.request.method).toBe('GET');
      req.flush({ bookings: [], total: 0 });
    });
  });

  describe('cancelBooking', () => {
    it('PATCHes /bookings/{id}/cancel', () => {
      service.cancelBooking(42).subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/bookings/42/cancel`);
      expect(req.request.method).toBe('PATCH');
      req.flush({ id: 42, status: 'cancelled' });
    });
  });

  describe('getMyBookings', () => {
    it('GETs the authenticated user booking history endpoint', () => {
      service.getMyBookings().subscribe(response => {
        expect(response.total).toBe(1);
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/auth/me/bookings`);
      expect(req.request.method).toBe('GET');
      req.flush({ bookings: [{ id: 1 }], total: 1, upcoming: 1, past: 0, cancelled: 0 });
    });
  });

  describe('getUnavailableDates', () => {
    it('GETs unavailable dates with the expected query params', () => {
      service.getUnavailableDates(8, '2026-05-01', '2026-05-10').subscribe(response => {
        expect(response.unavailable_dates).toEqual(['2026-05-05']);
      });

      const req = httpMock.expectOne(
        request =>
          request.url === `${environment.apiUrl}/rooms/8/unavailable-dates` &&
          request.params.get('from_date') === '2026-05-01' &&
          request.params.get('to_date') === '2026-05-10',
      );
      expect(req.request.method).toBe('GET');
      req.flush({ unavailable_dates: ['2026-05-05'], held_dates: ['2026-05-06'] });
    });
  });

  describe('findResumableBooking', () => {
    it('returns a matching resumable booking when the API succeeds', () => {
      service
        .findResumableBooking(8, '2026-05-01', '2026-05-03', 'guest@example.com')
        .subscribe(booking => {
          expect(booking).toEqual({ id: 3, booking_ref: 'BK3' });
        });

      const req = httpMock.expectOne(
        request =>
          request.url === `${environment.apiUrl}/bookings/resumable` &&
          request.params.get('room_id') === '8' &&
          request.params.get('check_in') === '2026-05-01' &&
          request.params.get('check_out') === '2026-05-03' &&
          request.params.get('email') === 'guest@example.com',
      );
      expect(req.request.method).toBe('GET');
      req.flush({ id: 3, booking_ref: 'BK3' });
    });

    it('returns null when the resumable-booking lookup fails', () => {
      service
        .findResumableBooking(8, '2026-05-01', '2026-05-03', 'guest@example.com')
        .subscribe(booking => {
          expect(booking).toBeNull();
        });

      const req = httpMock.expectOne(
        request => request.url === `${environment.apiUrl}/bookings/resumable`,
      );
      req.flush({ detail: 'not found' }, { status: 404, statusText: 'Not Found' });
    });
  });

  describe('extendHold', () => {
    it('POSTs the booking email to the extend-hold endpoint', () => {
      service.extendHold(9, 'guest@example.com').subscribe(booking => {
        expect(booking).toEqual({ id: 9, booking_ref: 'BKEXT' });
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/bookings/9/extend-hold`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ email: 'guest@example.com' });
      req.flush({ id: 9, booking_ref: 'BKEXT' });
    });
  });

  describe('checkoutState$ observable', () => {
    it('emits updated state after setCheckoutState', done => {
      const state: CheckoutState = { room: null, checkIn: '2027-02-01', checkOut: '2027-02-03', guests: 3 };
      service.checkoutState$.subscribe(emitted => {
        if (emitted !== null) {
          expect(emitted).toEqual(state);
          done();
        }
      });
      service.setCheckoutState(state);
    });
  });
});
