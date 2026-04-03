import { of, throwError } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { CheckoutComponent } from './checkout.component';
import { BookingService } from '../../core/services/booking.service';

describe('CheckoutComponent', () => {
  const checkoutState = {
    room: {
      id: 5,
      price: 200,
      image_url: 'https://example.com/room.jpg',
      hotel_name: 'The Grand Azure',
      room_type: 'suite',
      location: 'New York',
    },
    checkIn: '2026-04-10',
    checkOut: '2026-04-12',
    guests: 2,
  } as any;

  let bookingService: {
    getCheckoutState: jest.Mock;
    createBooking: jest.Mock;
  };

  beforeEach(async () => {
    bookingService = {
      getCheckoutState: jest.fn(),
      createBooking: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [CheckoutComponent],
      providers: [
        provideRouter([]),
        { provide: BookingService, useValue: bookingService },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    sessionStorage.clear();
    jest.restoreAllMocks();
  });

  it('redirects to search when checkout state is missing', () => {
    bookingService.getCheckoutState.mockReturnValue(null);
    const router = TestBed.inject(Router);
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);

    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    expect(navigateSpy).toHaveBeenCalledWith(['/search']);
  });

  it('calculates totals from checkout state', () => {
    bookingService.getCheckoutState.mockReturnValue(checkoutState);

    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    expect(component.nights()).toBe(2);
    expect(component.subtotal()).toBe(400);
    expect(component.taxes()).toBe(48);
    expect(component.serviceFee()).toBe(20);
    expect(component.total()).toBe(468);
  });

  it('shows alert when required fields are missing', () => {
    bookingService.getCheckoutState.mockReturnValue(checkoutState);
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});

    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    component.proceedToPayment();

    expect(alertSpy).toHaveBeenCalled();
  });

  it('creates booking and redirects to payment app', () => {
    bookingService.getCheckoutState.mockReturnValue(checkoutState);
    bookingService.createBooking.mockReturnValue(
      of({ id: 12, booking_ref: 'BK123', room_id: 5 })
    );

    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    component.form.user_name = 'Athit';
    component.form.email = 'athit@example.com';

    component.proceedToPayment();

    expect(bookingService.createBooking).toHaveBeenCalled();
    expect(sessionStorage.getItem('pending_booking')).toContain('BK123');
    expect(component.submitting()).toBe(true);
  });

  it('handles booking creation error', () => {
    bookingService.getCheckoutState.mockReturnValue(checkoutState);
    bookingService.createBooking.mockReturnValue(throwError(() => new Error('boom')));

    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    component.form.user_name = 'Athit';
    component.form.email = 'athit@example.com';

    component.proceedToPayment();

    expect(component.submitError()).toContain('Unable to create');
    expect(component.submitting()).toBe(false);
  });
});
