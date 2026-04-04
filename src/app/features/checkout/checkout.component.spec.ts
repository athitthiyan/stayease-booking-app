import { of, throwError } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { CheckoutComponent } from './checkout.component';
import { BookingService } from '../../core/services/booking.service';

const makeBooking = (overrides: Partial<any> = {}) => ({
  id: 12,
  booking_ref: 'BK123',
  room_id: 5,
  hold_expires_at: new Date(Date.now() + 600_000).toISOString(), // 10 min from now
  status: 'pending',
  payment_status: 'pending',
  ...overrides,
});

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
    findResumableBooking: jest.Mock;
    extendHold: jest.Mock;
  };

  beforeEach(async () => {
    bookingService = {
      getCheckoutState: jest.fn(),
      createBooking: jest.fn(),
      findResumableBooking: jest.fn().mockReturnValue(of(null)),
      extendHold: jest.fn(),
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

  // ── Existing tests ──────────────────────────────────────────────────────────

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
    bookingService.findResumableBooking.mockReturnValue(of(null));
    bookingService.createBooking.mockReturnValue(of(makeBooking()));

    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    component.form.user_name = 'Athit';
    component.form.email = 'athit@example.com';

    component.proceedToPayment();

    expect(bookingService.createBooking).toHaveBeenCalled();
    expect(sessionStorage.getItem('pending_booking')).toContain('BK123');
  });

  it('handles booking creation error', () => {
    bookingService.getCheckoutState.mockReturnValue(checkoutState);
    bookingService.findResumableBooking.mockReturnValue(of(null));
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

  // ── Resumable booking ────────────────────────────────────────────────────────

  it('reuses resumable booking when hold is valid', () => {
    bookingService.getCheckoutState.mockReturnValue(checkoutState);
    const existing = makeBooking({ id: 99, booking_ref: 'BKRESUME' });
    bookingService.findResumableBooking.mockReturnValue(of(existing));

    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    component.form.user_name = 'Athit';
    component.form.email = 'athit@example.com';

    component.proceedToPayment();

    // Should NOT create a new booking
    expect(bookingService.createBooking).not.toHaveBeenCalled();
    // resumableBooking signal should be set
    expect(component.resumableBooking()?.id).toBe(99);
    // sessionStorage should carry the resumable booking
    expect(sessionStorage.getItem('pending_booking')).toContain('BKRESUME');
  });

  it('extends hold when resumable booking hold has expired', () => {
    bookingService.getCheckoutState.mockReturnValue(checkoutState);
    const expired = makeBooking({
      id: 77,
      booking_ref: 'BKEXPIRED',
      hold_expires_at: new Date(Date.now() - 1000).toISOString(), // already expired
    });
    const extended = makeBooking({
      id: 77,
      booking_ref: 'BKEXPIRED',
      hold_expires_at: new Date(Date.now() + 600_000).toISOString(),
    });
    bookingService.findResumableBooking.mockReturnValue(of(expired));
    bookingService.extendHold.mockReturnValue(of(extended));

    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    component.form.user_name = 'Athit';
    component.form.email = 'athit@example.com';

    component.proceedToPayment();

    expect(bookingService.extendHold).toHaveBeenCalledWith(77, 'athit@example.com');
    expect(component.resumableBooking()?.id).toBe(77);
    expect(component.holdExpired()).toBe(false);
  });

  it('shows 409 error message when extend-hold fails (dates taken)', () => {
    bookingService.getCheckoutState.mockReturnValue(checkoutState);
    const expired = makeBooking({
      id: 77,
      hold_expires_at: new Date(Date.now() - 1000).toISOString(),
    });
    bookingService.findResumableBooking.mockReturnValue(of(expired));
    bookingService.extendHold.mockReturnValue(
      throwError(() => ({
        status: 409,
        error: { detail: 'These dates are no longer available — another booking was confirmed' },
      })),
    );

    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    component.form.user_name = 'Athit';
    component.form.email = 'athit@example.com';

    component.proceedToPayment();

    expect(component.submitError()).toContain('no longer available');
    expect(component.resumableBooking()).toBeNull();
  });

  it('prevents double-submit while submitting is true', () => {
    bookingService.getCheckoutState.mockReturnValue(checkoutState);
    // Never resolves — simulates in-flight request
    bookingService.findResumableBooking.mockReturnValue(new (require('rxjs').Subject)());

    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    component.form.user_name = 'Athit';
    component.form.email = 'athit@example.com';

    component.proceedToPayment(); // first click
    component.proceedToPayment(); // second click (should be ignored)

    // findResumableBooking should only have been called once
    expect(bookingService.findResumableBooking).toHaveBeenCalledTimes(1);
  });

  it('shows hold countdown after booking is created', () => {
    bookingService.getCheckoutState.mockReturnValue(checkoutState);
    bookingService.findResumableBooking.mockReturnValue(of(null));
    const booking = makeBooking({
      hold_expires_at: new Date(Date.now() + 600_000).toISOString(),
    });
    bookingService.createBooking.mockReturnValue(of(booking));

    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    component.form.user_name = 'Athit';
    component.form.email = 'athit@example.com';

    component.proceedToPayment();

    // Countdown should have started (seconds > 0 for a 10-minute hold)
    expect(component.holdSecondsLeft()).toBeGreaterThan(0);
    component.ngOnDestroy(); // clean up interval
  });

  it('handles 409 conflict on new booking creation', () => {
    bookingService.getCheckoutState.mockReturnValue(checkoutState);
    bookingService.findResumableBooking.mockReturnValue(of(null));
    bookingService.createBooking.mockReturnValue(
      throwError(() => ({
        status: 409,
        error: { detail: 'Room is already reserved for the selected dates' },
      })),
    );

    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    component.form.user_name = 'Athit';
    component.form.email = 'athit@example.com';

    component.proceedToPayment();

    expect(component.submitError()).toContain('already reserved');
    expect(component.submitting()).toBe(false);
  });
});
