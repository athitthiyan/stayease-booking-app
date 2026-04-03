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

  it('fetches booking by ref', () => {
    service.getBookingByRef('BK123').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/bookings/ref/BK123`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });
});
