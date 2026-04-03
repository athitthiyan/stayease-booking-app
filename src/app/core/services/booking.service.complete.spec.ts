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
