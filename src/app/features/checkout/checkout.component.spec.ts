import { of, Subject, throwError } from 'rxjs';
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
    bookingService.findResumableBooking.mockReturnValue(new Subject());

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

  // ── SessionStorage recovery tests ────────────────────────────────────────────

  it('recovers resumable booking and starts countdown from pending_booking sessionStorage', () => {
    bookingService.getCheckoutState.mockReturnValue(checkoutState);

    const futureExpiry = new Date(Date.now() + 300_000).toISOString(); // 5 min
    const pendingBooking = makeBooking({
      id: 42,
      booking_ref: 'BKPENDING',
      payment_status: 'failed',
      status: 'pending',
      hold_expires_at: futureExpiry,
    });
    sessionStorage.setItem('pending_booking', JSON.stringify(pendingBooking));

    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    // Should have restored resumable booking
    expect(component.resumableBooking()?.id).toBe(42);
    expect(component.resumableBooking()?.booking_ref).toBe('BKPENDING');

    // Hold countdown should be running
    expect(component.holdSecondsLeft()).toBeGreaterThan(0);

    // Error message should prompt user to complete checkout
    expect(component.submitError()).toContain('previous payment failed');

    component.ngOnDestroy();
  });

  it('ignores expired pending_booking in sessionStorage and removes it', () => {
    bookingService.getCheckoutState.mockReturnValue(checkoutState);

    const expiredBooking = makeBooking({
      id: 55,
      booking_ref: 'BKEXPIRED',
      payment_status: 'failed',
      status: 'pending',
      hold_expires_at: new Date(Date.now() - 1000).toISOString(), // already expired
    });
    sessionStorage.setItem('pending_booking', JSON.stringify(expiredBooking));

    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    // Should NOT restore the expired booking
    expect(component.resumableBooking()).toBeNull();
    expect(component.holdSecondsLeft()).toBe(0);

    // SessionStorage should have been cleared
    expect(sessionStorage.getItem('pending_booking')).toBeNull();
  });

  it('removes a paid pending booking from session storage during recovery', () => {
    bookingService.getCheckoutState.mockReturnValue(checkoutState);
    sessionStorage.setItem(
      'pending_booking',
      JSON.stringify(
        makeBooking({
          payment_status: 'paid',
          status: 'pending',
        }),
      ),
    );

    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    expect(component.resumableBooking()).toBeNull();
    expect(sessionStorage.getItem('pending_booking')).toBeNull();
  });

  it('removes invalid pending booking JSON from session storage', () => {
    bookingService.getCheckoutState.mockReturnValue(checkoutState);
    sessionStorage.setItem('pending_booking', '{invalid-json');

    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    expect(sessionStorage.getItem('pending_booking')).toBeNull();
    expect(component.resumableBooking()).toBeNull();
  });

  it('formats the hold countdown helpers with leading zeroes', () => {
    bookingService.getCheckoutState.mockReturnValue(checkoutState);

    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    component.holdSecondsLeft.set(65);

    expect(component.holdMinutes()).toBe('01');
    expect(component.holdSecondsPad()).toBe('05');
  });

  it('does not auto-extend an expired hold when email is missing', () => {
    bookingService.getCheckoutState.mockReturnValue(checkoutState);
    bookingService.extendHold.mockReturnValue(of(makeBooking()));

    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    component.resumableBooking.set(
      makeBooking({ hold_expires_at: new Date(Date.now() - 1000).toISOString() }) as any,
    );

    component.startCountdown(new Date(Date.now() - 1000).toISOString());

    expect(component.holdExpired()).toBe(true);
    expect(bookingService.extendHold).not.toHaveBeenCalled();
  });

  it('shows a generic error when extend-hold fails for a non-conflict reason', () => {
    bookingService.getCheckoutState.mockReturnValue(checkoutState);
    const expired = makeBooking({
      id: 88,
      hold_expires_at: new Date(Date.now() - 1000).toISOString(),
    });
    bookingService.findResumableBooking.mockReturnValue(of(expired));
    bookingService.extendHold.mockReturnValue(
      throwError(() => ({
        status: 500,
        error: { detail: 'temporary outage' },
      })),
    );

    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    component.form.user_name = 'Athit';
    component.form.email = 'athit@example.com';

    component.proceedToPayment();

    expect(component.submitError()).toContain('Could not extend your reservation hold');
    expect(component.extendingHold()).toBe(false);
  });

  it('shows an error when the resumable-booking lookup itself fails', () => {
    bookingService.getCheckoutState.mockReturnValue(checkoutState);
    bookingService.findResumableBooking.mockReturnValue(
      throwError(() => new Error('network down')),
    );

    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    component.form.user_name = 'Athit';
    component.form.email = 'athit@example.com';

    component.proceedToPayment();

    expect(component.submitError()).toContain('Unable to check existing reservations');
    expect(component.submitting()).toBe(false);
  });
});
