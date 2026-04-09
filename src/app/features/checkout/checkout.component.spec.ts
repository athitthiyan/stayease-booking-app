import { signal } from '@angular/core';
import { of, Subject, throwError } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';

import { CheckoutComponent } from './checkout.component';
import { BookingService, CheckoutState } from '../../core/services/booking.service';
import { Booking } from '../../core/models/booking.model';
import { ROOM_IMAGE_PLACEHOLDER } from '../../shared/utils/image-fallback';

const makeBooking = (overrides: Partial<Booking> = {}): Booking => ({
  id: 12,
  booking_ref: 'BK123',
  room_id: 5,
  hold_expires_at: new Date(Date.now() + 600_000).toISOString(), // 10 min from now
  user_name: 'Athit',
  email: 'athit@example.com',
  phone: '1234567890',
  check_in: '2026-04-10T00:00:00.000Z',
  check_out: '2026-04-12T00:00:00.000Z',
  guests: 2,
  adults: 2,
  children: 0,
  infants: 0,
  nights: 2,
  room_rate: 400,
  taxes: 48,
  service_fee: 20,
  total_amount: 468,
  status: 'pending',
  payment_status: 'pending',
  created_at: '2026-04-01T00:00:00.000Z',
  ...overrides,
});

const redirectSpyFor = (component: CheckoutComponent) =>
  jest
    .spyOn(
      component as CheckoutComponent & { redirectToPayment: (booking: Booking) => void },
      'redirectToPayment',
    )
    .mockImplementation((() => undefined) as never);

describe('CheckoutComponent', () => {
  const checkoutState: CheckoutState = {
    room: {
      id: 5,
      price: 200,
      image_url: 'https://example.com/room.jpg',
      hotel_name: 'The Grand Azure',
      availability: true,
      rating: 4.8,
      review_count: 20,
      room_type: 'suite',
      location: 'New York',
      max_guests: 2,
      beds: 1,
      bathrooms: 1,
      is_featured: true,
      created_at: '2026-04-01T00:00:00.000Z',
    },
    checkIn: '2026-04-10',
    checkOut: '2026-04-12',
    guests: 2,
    adults: 2,
    children: 0,
    infants: 0,
  };

  let bookingService: {
    getCheckoutState: jest.Mock;
    getBooking: jest.Mock;
    setCheckoutState: jest.Mock;
    createBooking: jest.Mock;
    getUnavailableDates: jest.Mock;
    findResumableBooking: jest.Mock;
    extendHold: jest.Mock;
    cancelBooking: jest.Mock;
  };

  beforeEach(async () => {
    bookingService = {
      getCheckoutState: jest.fn(),
      getBooking: jest.fn(),
      setCheckoutState: jest.fn(),
      createBooking: jest.fn(),
      getUnavailableDates: jest.fn().mockReturnValue(
        of({
          unavailable_dates: [],
          held_dates: [],
        }),
      ),
      findResumableBooking: jest.fn().mockReturnValue(of(null)),
      extendHold: jest.fn(),
      cancelBooking: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [CheckoutComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({}),
            },
          },
        },
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

  it('hydrates checkout details from an existing booking', () => {
    bookingService.getCheckoutState.mockReturnValue(checkoutState);
    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    (
      component as unknown as { hydrateCheckoutFromBooking: (booking: Booking) => void }
    ).hydrateCheckoutFromBooking(makeBooking({ room: checkoutState.room! }));

    expect(component.checkoutState()?.room?.id).toBe(5);
    expect(component.resumableBooking()?.booking_ref).toBe('BK123');
  });

  it('navigates to bookings when an existing booking no longer has room details', () => {
    bookingService.getCheckoutState.mockReturnValue(checkoutState);
    const router = TestBed.inject(Router);
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);

    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    (
      component as unknown as { hydrateCheckoutFromBooking: (booking: Booking) => void }
    ).hydrateCheckoutFromBooking(makeBooking({ room: undefined }));

    expect(component.submitError()).toBe('This booking is no longer available.');
    expect(navigateSpy).toHaveBeenCalledWith(['/bookings']);
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

  it('falls back to zero subtotal when room price is missing', () => {
    bookingService.getCheckoutState.mockReturnValue({
      ...checkoutState,
      room: {
        ...checkoutState.room,
        price: undefined,
      },
    });

    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    expect(component.subtotal()).toBe(0);
    expect(component.taxes()).toBe(0);
    expect(component.serviceFee()).toBe(0);
    expect(component.total()).toBe(0);
  });

  it('uses the placeholder image when checkout room artwork is missing or invalid', () => {
    bookingService.getCheckoutState.mockReturnValue({
      ...checkoutState,
      room: {
        ...checkoutState.room,
        image_url: 'invalid-image-url',
      },
    });

    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    expect(component.resolveRoomImage('invalid-image-url')).toBe(ROOM_IMAGE_PLACEHOLDER);

    const image = document.createElement('img');
    image.src = 'https://example.com/broken.jpg';
    component.onImageError({ target: image } as unknown as Event);
    expect(image.src).toBe(ROOM_IMAGE_PLACEHOLDER);
  });

  it('renders trust badges in the checkout summary', () => {
    bookingService.getCheckoutState.mockReturnValue(checkoutState);

    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Free Cancellation');
    expect(element.textContent).toContain('Secure checkout');
    expect(element.textContent).toContain('Best Price Guarantee');
    expect(element.textContent).toContain('Cancellation policy');
    expect(element.textContent).toContain('Refund policy');
    expect(element.textContent).toContain('support@stayvora.co.in');
  });

  it('shows inline validation when required fields are missing', () => {
    bookingService.getCheckoutState.mockReturnValue(checkoutState);

    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    component.proceedToPayment();

    expect(component.nameError()).toBe('Please enter the guest name.');
    expect(component.emailError()).toBe('Please enter the guest email.');
  });

  it('shows inline validation when email format is invalid', () => {
    bookingService.getCheckoutState.mockReturnValue(checkoutState);

    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    component.form.user_name = 'Athit';
    component.form.email = 'invalid-email';

    component.proceedToPayment();

    expect(component.nameError()).toBe('');
    expect(component.emailError()).toBe('Please enter a valid email address.');
  });

  it('trims guest details and validates phone format', () => {
    bookingService.getCheckoutState.mockReturnValue(checkoutState);

    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    component.form.user_name = '  Athit  ';
    component.form.email = '  athit@example.com  ';
    component.form.phone = 'bad-phone';

    component.proceedToPayment();

    expect(component.form.user_name).toBe('Athit');
    expect(component.form.email).toBe('athit@example.com');
    expect(component.phoneError()).toBe('Please enter a valid phone number.');
  });

  it('creates booking and redirects to payment app', () => {
    bookingService.getCheckoutState.mockReturnValue(checkoutState);
    bookingService.findResumableBooking.mockReturnValue(of(null));
    bookingService.createBooking.mockReturnValue(of(makeBooking()));

    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    const redirectSpy = redirectSpyFor(component);
    component.ngOnInit();
    component.form.user_name = 'Athit';
    component.form.email = 'athit@example.com';

    component.proceedToPayment();

    expect(bookingService.createBooking).toHaveBeenCalled();
    expect(redirectSpy).toHaveBeenCalled();
    expect(component.nameError()).toBe('');
    expect(component.emailError()).toBe('');
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

  it('uses the fallback conflict message when booking creation returns 409 without a detail', () => {
    bookingService.getCheckoutState.mockReturnValue(checkoutState);
    bookingService.findResumableBooking.mockReturnValue(of(null));
    bookingService.createBooking.mockReturnValue(
      throwError(() => ({
        status: 409,
        error: {},
      })),
    );

    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    component.form.user_name = 'Athit';
    component.form.email = 'athit@example.com';

    component.proceedToPayment();

    expect(component.submitError()).toContain('no longer available');
    expect(component.submitting()).toBe(false);
    expect(component.bookingConflict()).toBe(true);
    expect(component.toastMessage()).toBe('Selected dates are no longer available.');
    expect(bookingService.getUnavailableDates).toHaveBeenCalledWith(5, '2026-04-10', '2026-04-12');
  });

  // ── Resumable booking ────────────────────────────────────────────────────────

  it('reuses resumable booking when hold is valid', () => {
    bookingService.getCheckoutState.mockReturnValue(checkoutState);
    const existing = makeBooking({ id: 99, booking_ref: 'BKRESUME' });
    bookingService.findResumableBooking.mockReturnValue(of(existing));

    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    const redirectSpy = redirectSpyFor(component);
    component.ngOnInit();
    component.form.user_name = 'Athit';
    component.form.email = 'athit@example.com';

    component.proceedToPayment();

    // Should NOT create a new booking
    expect(bookingService.createBooking).not.toHaveBeenCalled();
    // resumableBooking signal should be set
    expect(component.resumableBooking()?.id).toBe(99);
    expect(redirectSpy).toHaveBeenCalledWith(existing);
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
    const redirectSpy = redirectSpyFor(component);
    component.ngOnInit();
    component.form.user_name = 'Athit';
    component.form.email = 'athit@example.com';

    component.proceedToPayment();

    expect(bookingService.extendHold).toHaveBeenCalledWith(77, 'athit@example.com');
    expect(component.resumableBooking()?.id).toBe(77);
    expect(component.holdExpired()).toBe(false);
    expect(redirectSpy).not.toHaveBeenCalled();
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

  it('uses the generic unavailable message when extend-hold returns 409 without detail', () => {
    bookingService.getCheckoutState.mockReturnValue(checkoutState);
    const expired = makeBooking({
      id: 77,
      hold_expires_at: new Date(Date.now() - 1000).toISOString(),
    });
    bookingService.findResumableBooking.mockReturnValue(of(expired));
    bookingService.extendHold.mockReturnValue(
      throwError(() => ({
        status: 409,
        error: {},
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
    redirectSpyFor(component);
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
    sessionStorage.setItem('pending_booking', JSON.stringify(makeBooking({ id: 401 })));
    sessionStorage.setItem('booking_auth_redirect', '1');

    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    component.holdSecondsLeft.set(45);
    component.form.user_name = 'Athit';
    component.form.email = 'athit@example.com';

    component.proceedToPayment();

    expect(component.submitError()).toContain('already reserved');
    expect(component.submitting()).toBe(false);
    expect(component.bookingConflict()).toBe(true);
    expect(bookingService.getUnavailableDates).toHaveBeenCalledWith(5, '2026-04-10', '2026-04-12');
    expect(component.resumableBooking()).toBeNull();
    expect(component.holdSecondsLeft()).toBe(0);
    expect(sessionStorage.getItem('pending_booking')).toBeNull();
    expect(sessionStorage.getItem('booking_auth_redirect')).toBeNull();
  });

  // ── UPDATED: conflict state now shows recovery actions, button is NOT permanently disabled ──

  it('renders the conflict state with recovery actions after availability is lost', async () => {
    bookingService.getCheckoutState.mockReturnValue(checkoutState);

    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    component.bookingConflict = signal(true);
    component.unavailableDates = signal(['2026-04-10']);
    component.heldDates = signal(['2026-04-11']);
    component.toastMessage = signal('Selected dates are no longer available.');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const primaryButton = element.querySelector('.checkout-actions .btn--primary') as HTMLButtonElement;

    expect(component.bookingConflict()).toBe(true);
    // Button is NOT disabled — data-driven check on click instead
    expect(primaryButton.disabled).toBe(false);
    expect(component.unavailableDates()).toEqual(['2026-04-10']);
    expect(component.heldDates()).toEqual(['2026-04-11']);
    expect(component.conflictDateSummary()).toContain('blocked date');
    expect(element.textContent).toContain('Room no longer available for selected dates.');
    expect(element.textContent).toContain('Selected dates are no longer available.');
    // Recovery actions present
    expect(element.textContent).toContain('Check availability again');
    expect(element.textContent).toContain('Edit dates');
  });

  it('uses a safe fallback when conflict availability refresh fails', () => {
    bookingService.getCheckoutState.mockReturnValue(checkoutState);
    bookingService.findResumableBooking.mockReturnValue(of(null));
    bookingService.createBooking.mockReturnValue(
      throwError(() => ({
        status: 409,
        error: {},
      })),
    );
    bookingService.getUnavailableDates.mockReturnValue(
      throwError(() => new Error('timeout')),
    );

    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    component.form.user_name = 'Athit';
    component.form.email = 'athit@example.com';

    component.proceedToPayment();

    expect(component.bookingConflict()).toBe(true);
    expect(component.unavailableDates()).toEqual([]);
    expect(component.heldDates()).toEqual([]);
    expect(component.conflictDateSummary()).toContain('Live availability has been refreshed');
  });

  // ── UPDATED: proceedToPayment in conflict mode does data-driven re-check ──

  it('re-checks availability when proceedToPayment is called in conflict mode', () => {
    bookingService.getCheckoutState.mockReturnValue(checkoutState);
    // Return conflicting dates so it stays blocked
    bookingService.getUnavailableDates.mockReturnValue(
      of({ unavailable_dates: ['2026-04-10'], held_dates: [] }),
    );

    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    component.bookingConflict.set(true);
    component.form.user_name = 'Athit';
    component.form.email = 'athit@example.com';

    component.proceedToPayment();

    // Should have called getUnavailableDates for data-driven check
    expect(bookingService.getUnavailableDates).toHaveBeenCalledWith(5, '2026-04-10', '2026-04-12');
    // Still conflicting because the dates overlap
    expect(component.bookingConflict()).toBe(true);
    expect(component.toastMessage()).toContain('still unavailable');
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
    expect(component.form.user_name).toBe('Athit');
    expect(component.form.email).toBe('athit@example.com');
    expect(component.form.phone).toBe('1234567890');

    // Hold countdown should be running
    expect(component.holdSecondsLeft()).toBeGreaterThan(0);

    // Error message should prompt user to complete checkout
    expect(component.submitError()).toContain('previous payment failed');

    component.ngOnDestroy();
  });

  it('does not restore an unrelated pending booking into a new checkout flow', () => {
    bookingService.getCheckoutState.mockReturnValue(checkoutState);

    sessionStorage.setItem(
      'pending_booking',
      JSON.stringify(
        makeBooking({
          id: 43,
          room_id: 99,
          booking_ref: 'BKOTHER',
          user_name: 'Previous Guest',
          email: 'previous@example.com',
          phone: '9999999999',
          hold_expires_at: new Date(Date.now() + 300_000).toISOString(),
        }),
      ),
    );

    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    expect(component.resumableBooking()).toBeNull();
    expect(component.form.user_name).toBe('');
    expect(component.form.email).toBe('');
    expect(component.form.phone).toBe('');
    expect(component.submitError()).toBe('');
    expect(sessionStorage.getItem('pending_booking')).toContain('"booking_ref":"BKOTHER"');
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

  it('marks hydrated paid bookings as confirmed and clears any pending recovery state', () => {
    bookingService.getCheckoutState.mockReturnValue(checkoutState);
    sessionStorage.setItem('pending_booking', JSON.stringify(makeBooking()));

    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    (
      component as unknown as { hydrateCheckoutFromBooking: (booking: Booking) => void }
    ).hydrateCheckoutFromBooking(
      makeBooking({
        room: checkoutState.room!,
        payment_status: 'paid',
        status: 'confirmed',
      }),
    );

    expect(component.isPaymentConfirmed(component.resumableBooking())).toBe(true);
    expect(component.submitError()).toBe('This booking has already been confirmed.');
    expect(component.holdSecondsLeft()).toBe(0);
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

  it('does not auto-restore a pending booking without a hold expiry', () => {
    bookingService.getCheckoutState.mockReturnValue(checkoutState);
    sessionStorage.setItem(
      'pending_booking',
      JSON.stringify(
        makeBooking({
          hold_expires_at: undefined,
          payment_status: 'pending',
        }),
      ),
    );

    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    expect(component.resumableBooking()).toBeNull();
    expect(component.holdSecondsLeft()).toBe(0);
  });

  it('does not try to continue payment once the booking is already confirmed', () => {
    bookingService.getCheckoutState.mockReturnValue(checkoutState);
    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    component.resumableBooking.set(
      makeBooking({
        payment_status: 'paid',
        status: 'confirmed',
      }),
    );

    component.proceedToPayment();

    expect(component.submitError()).toBe('This booking has already been confirmed.');
    expect(bookingService.findResumableBooking).not.toHaveBeenCalled();
    expect(bookingService.createBooking).not.toHaveBeenCalled();
  });

  it('clears booking auth redirect flags during init', () => {
    bookingService.getCheckoutState.mockReturnValue(checkoutState);
    sessionStorage.setItem('booking_auth_redirect', '1');

    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    expect(sessionStorage.getItem('booking_auth_redirect')).toBeNull();
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
      makeBooking({ hold_expires_at: new Date(Date.now() - 1000).toISOString() }),
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

    expect(component.submitError()).toContain('Unable to check existing bookings');
    expect(component.submitting()).toBe(false);
  });

  it('maps structured booking API errors and falls back to backend messages for unknown codes', () => {
    bookingService.getCheckoutState.mockReturnValue(checkoutState);
    bookingService.findResumableBooking.mockReturnValue(of(null));

    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    component.form.user_name = 'Athit';
    component.form.email = 'athit@example.com';

    bookingService.createBooking.mockReturnValueOnce(
      throwError(() => ({
        error: { detail: { code: 'AUTH_REQUIRED', message: 'ignored' } },
      })),
    );
    component.proceedToPayment();
    expect(component.submitError()).toBe('Please log in to continue with your booking.');

    bookingService.createBooking.mockReturnValueOnce(
      throwError(() => ({
        error: { detail: { code: 'UNEXPECTED', message: 'Backend exploded' } },
      })),
    );
    component.proceedToPayment();
    expect(component.submitError()).toBe('Backend exploded');

    bookingService.createBooking.mockReturnValueOnce(
      throwError(() => ({
        error: { detail: { code: 'GUEST_CAPACITY_EXCEEDED', message: '' } },
      })),
    );
    component.proceedToPayment();
    expect(component.submitError()).toBe('Guest count exceeds room capacity.');

    bookingService.createBooking.mockReturnValueOnce(
      throwError(() => ({
        error: { detail: { code: 'UNEXPECTED', message: '' } },
      })),
    );
    component.proceedToPayment();
    expect(component.submitError()).toBe('Booking failed. Please try again.');
  });

  it('writes the pending booking and payment url when redirecting to payment', () => {
    bookingService.getCheckoutState.mockReturnValue(checkoutState);
    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    const originalLocation = window.location;

    delete (window as Partial<Window>).location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { href: '' },
    });

    try {
      (
        component as unknown as { redirectToPayment: (booking: Booking) => void }
      ).redirectToPayment(makeBooking({ id: 91, booking_ref: 'BKPAY' }));

      expect(sessionStorage.getItem('pending_booking')).toContain('"id":91');
      expect(window.location.href).toContain('booking_id=91');
      expect(window.location.href).toContain('ref=BKPAY');
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: originalLocation,
      });
    }
  });

  it('cancels a held booking and returns to the room page', () => {
    bookingService.getCheckoutState.mockReturnValue(checkoutState);
    bookingService.cancelBooking.mockReturnValue(of({}));
    const router = TestBed.inject(Router);
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);

    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    component.resumableBooking.set(makeBooking({ id: 17 }));
    component.holdSecondsLeft.set(50);
    component.holdExpired.set(true);

    component.cancelHold();

    expect(bookingService.cancelBooking).toHaveBeenCalledWith(17);
    expect(component.resumableBooking()).toBeNull();
    expect(component.holdSecondsLeft()).toBe(0);
    expect(component.holdExpired()).toBe(false);
    expect(navigateSpy).toHaveBeenCalledWith(['/rooms', 5]);
  });

  it('falls back to search after cancel when checkout state has no room', () => {
    bookingService.getCheckoutState.mockReturnValue(checkoutState);
    bookingService.cancelBooking.mockReturnValue(of({}));
    const router = TestBed.inject(Router);
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);

    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    component.checkoutState.set(null);
    component.resumableBooking.set(makeBooking({ id: 18 }));

    component.cancelHold();

    expect(navigateSpy).toHaveBeenCalledWith(['/search']);
  });

  it('surfaces cancel-booking failures and ignores duplicate cancel attempts', () => {
    bookingService.getCheckoutState.mockReturnValue(checkoutState);
    bookingService.cancelBooking.mockReturnValue(throwError(() => new Error('boom')));

    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.cancelHold();
    expect(bookingService.cancelBooking).not.toHaveBeenCalled();

    component.resumableBooking.set(makeBooking({ id: 19 }));
    component.cancellingHold.set(true);
    component.cancelHold();
    expect(bookingService.cancelBooking).not.toHaveBeenCalled();

    component.cancellingHold.set(false);
    component.cancelHold();
    expect(component.submitError()).toBe('Could not cancel the booking. Please try again.');
    expect(component.cancellingHold()).toBe(false);
  });

  it('tries to extend resumable bookings that have no hold expiry timestamp', () => {
    bookingService.getCheckoutState.mockReturnValue(checkoutState);
    const existing = makeBooking({ id: 23, hold_expires_at: undefined });
    bookingService.findResumableBooking.mockReturnValue(of(existing));
    bookingService.extendHold.mockReturnValue(of(makeBooking({ id: 23 })));

    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    component.form.user_name = 'Athit';
    component.form.email = 'athit@example.com';

    component.proceedToPayment();

    expect(bookingService.extendHold).toHaveBeenCalledWith(23, 'athit@example.com');
  });

  it('navigates to bookings when getBooking fails for a direct booking URL', async () => {
    TestBed.resetTestingModule();

    const bs = {
      getCheckoutState: jest.fn().mockReturnValue(null),
      getBooking: jest.fn().mockReturnValue(throwError(() => new Error('not found'))),
      setCheckoutState: jest.fn(),
      createBooking: jest.fn(),
      findResumableBooking: jest.fn().mockReturnValue(of(null)),
      extendHold: jest.fn(),
      cancelBooking: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [CheckoutComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: '42' }) } },
        },
        { provide: BookingService, useValue: bs },
      ],
    }).compileComponents();

    const router = TestBed.inject(Router);
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);

    const fixture = TestBed.createComponent(CheckoutComponent);
    fixture.componentInstance.ngOnInit();

    expect(bs.getBooking).toHaveBeenCalledWith(42);
    expect(fixture.componentInstance.submitError()).toBe('This booking is no longer available.');
    expect(navigateSpy).toHaveBeenCalledWith(['/bookings']);
  });

  it('preserves existing form values when pending booking fields are empty', () => {
    bookingService.getCheckoutState.mockReturnValue(checkoutState);

    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    component.form.user_name = 'Existing';
    component.form.email = 'existing@example.com';

    // Apply a booking with empty user details — should keep existing form values
    (component as unknown as { applyBookingToForm: (b: Booking) => void }).applyBookingToForm(
      makeBooking({ user_name: '', email: '', phone: '', special_requests: '' }),
    );

    expect(component.form.user_name).toBe('Existing');
    expect(component.form.email).toBe('existing@example.com');
    expect(component.form.phone).toBe('');
  });

  it('hydrates checkout from getBooking when state is missing but route has id', async () => {
    TestBed.resetTestingModule();

    const bs = {
      getCheckoutState: jest.fn().mockReturnValue(null),
      getBooking: jest.fn().mockReturnValue(of(makeBooking({ room: checkoutState.room! }))),
      setCheckoutState: jest.fn(),
      createBooking: jest.fn(),
      findResumableBooking: jest.fn().mockReturnValue(of(null)),
      extendHold: jest.fn(),
      cancelBooking: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [CheckoutComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: '12' }) } },
        },
        { provide: BookingService, useValue: bs },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CheckoutComponent);
    fixture.componentInstance.ngOnInit();

    expect(bs.getBooking).toHaveBeenCalledWith(12);
    expect(fixture.componentInstance.resumableBooking()?.id).toBe(12);
  });

  it('prevents payment when findResumableBooking returns a confirmed booking', () => {
    bookingService.getCheckoutState.mockReturnValue(checkoutState);
    const confirmedBooking = makeBooking({
      id: 55,
      payment_status: 'paid',
      status: 'confirmed',
    });
    bookingService.findResumableBooking.mockReturnValue(of(confirmedBooking));

    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    component.form.user_name = 'Athit';
    component.form.email = 'athit@example.com';

    component.proceedToPayment();

    expect(component.submitError()).toBe('This booking has already been confirmed.');
    expect(component.submitting()).toBe(false);
    expect(sessionStorage.getItem('pending_booking')).toBeNull();
  });

  // ════════════════════════════════════════════════════════════════════════════
  // ── NEW: 10 Critical Test Cases for Checkout State Refactoring ─────────────
  // ════════════════════════════════════════════════════════════════════════════

  // 1. 409 sets conflict state via dedicated setConflictState()
  it('sets conflict state with dedicated method after 409', () => {
    bookingService.getCheckoutState.mockReturnValue(checkoutState);
    bookingService.findResumableBooking.mockReturnValue(of(null));
    bookingService.createBooking.mockReturnValue(
      throwError(() => ({ status: 409, error: { detail: 'Dates taken' } })),
    );

    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    component.form.user_name = 'Athit';
    component.form.email = 'athit@example.com';

    component.proceedToPayment();

    // All conflict signals set correctly via setConflictState
    expect(component.bookingConflict()).toBe(true);
    expect(component.submitError()).toBe('Dates taken');
    expect(component.toastMessage()).toBe('Selected dates are no longer available.');
  });

  // 2. clearConflictState resets all conflict-related signals
  it('clearConflictState resets all conflict signals', () => {
    bookingService.getCheckoutState.mockReturnValue(checkoutState);

    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    // Simulate active conflict
    component.setConflictState('Error msg', 'Toast msg');
    component.unavailableDates.set(['2026-04-10']);
    component.heldDates.set(['2026-04-11']);

    expect(component.bookingConflict()).toBe(true);

    // Clear it
    component.clearConflictState();

    expect(component.bookingConflict()).toBe(false);
    expect(component.submitError()).toBe('');
    expect(component.toastMessage()).toBe('');
    expect(component.unavailableDates()).toEqual([]);
    expect(component.heldDates()).toEqual([]);
  });

  // 3. Inline date change clears conflict state
  it('clears conflict state when dates are changed via inline editor', () => {
    bookingService.getCheckoutState.mockReturnValue(checkoutState);

    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    // Set conflict state
    component.setConflictState('Dates conflict', 'Dates unavailable');
    component.unavailableDates.set(['2026-04-10']);
    expect(component.bookingConflict()).toBe(true);

    // Open inline editor and apply new dates
    component.startEditingDates();
    expect(component.editingDates()).toBe(true);

    component.onInlineDateChange({ checkIn: '2026-04-15', checkOut: '2026-04-17' });
    component.applyDateChange();

    // Conflict should be completely cleared
    expect(component.bookingConflict()).toBe(false);
    expect(component.submitError()).toBe('');
    expect(component.toastMessage()).toBe('');
    expect(component.unavailableDates()).toEqual([]);
    expect(component.editingDates()).toBe(false);

    // Pricing should be recalculated for new dates
    expect(component.nights()).toBe(2);
    expect(component.checkoutState()?.checkIn).toBe('2026-04-15');
    expect(component.checkoutState()?.checkOut).toBe('2026-04-17');
  });

  // 4. Retry button clears conflict when dates become available
  it('clears conflict when retry finds dates are now available', () => {
    bookingService.getCheckoutState.mockReturnValue(checkoutState);
    bookingService.getUnavailableDates.mockReturnValue(
      of({ unavailable_dates: [], held_dates: [] }),
    );

    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    // Simulate conflict state
    component.setConflictState('Dates unavailable', 'Try again');
    component.unavailableDates.set(['2026-04-10']);
    expect(component.bookingConflict()).toBe(true);

    // Retry
    component.retryAfterConflict();

    expect(component.checkingAvailability()).toBe(false);
    expect(component.bookingConflict()).toBe(false);
    expect(component.toastMessage()).toBe('Dates are now available! You can proceed.');
  });

  // 5. Hold expiry triggers auto-extend
  it('auto-extends hold when countdown reaches zero', () => {
    bookingService.getCheckoutState.mockReturnValue(checkoutState);
    const extended = makeBooking({ hold_expires_at: new Date(Date.now() + 600_000).toISOString() });
    bookingService.extendHold.mockReturnValue(of(extended));

    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    component.form.email = 'athit@example.com';
    component.resumableBooking.set(makeBooking({ id: 50 }));

    // Start countdown with already-expired time
    component.startCountdown(new Date(Date.now() - 1000).toISOString());

    expect(bookingService.extendHold).toHaveBeenCalledWith(50, 'athit@example.com');
    expect(component.holdExpired()).toBe(false);
    expect(component.holdSecondsLeft()).toBeGreaterThan(0);

    component.ngOnDestroy();
  });

  // 6. Extend hold success resets holdExpired and restarts countdown
  it('resets holdExpired and restarts countdown after successful extend', () => {
    bookingService.getCheckoutState.mockReturnValue(checkoutState);
    const newExpiry = new Date(Date.now() + 300_000).toISOString();
    bookingService.extendHold.mockReturnValue(of(makeBooking({ hold_expires_at: newExpiry })));

    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    component.holdExpired.set(true);
    component.extendingHold.set(false);
    component.form.email = 'test@example.com';
    component.resumableBooking.set(makeBooking({ id: 60 }));

    // Trigger extend
    (component as unknown as { tryExtendHold: (id: number, email: string) => void })
      .tryExtendHold(60, 'test@example.com');

    expect(component.holdExpired()).toBe(false);
    expect(component.extendingHold()).toBe(false);
    expect(component.holdSecondsLeft()).toBeGreaterThan(0);

    component.ngOnDestroy();
  });

  // 7. Extend hold failure sets appropriate error
  it('sets error and clears resumable booking when extend fails with 409', () => {
    bookingService.getCheckoutState.mockReturnValue(checkoutState);
    bookingService.extendHold.mockReturnValue(
      throwError(() => ({
        status: 409,
        error: { detail: 'no longer available' },
      })),
    );

    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    component.resumableBooking.set(makeBooking({ id: 70 }));

    (component as unknown as { tryExtendHold: (id: number, email: string) => void })
      .tryExtendHold(70, 'test@example.com');

    expect(component.submitError()).toContain('no longer available');
    expect(component.resumableBooking()).toBeNull();
    expect(component.extendingHold()).toBe(false);
  });

  // 8. clearTransientBookingState cleans up everything
  it('clearTransientBookingState removes session data and resets hold signals', () => {
    bookingService.getCheckoutState.mockReturnValue(checkoutState);

    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    // Set up state to clear
    sessionStorage.setItem('pending_booking', '{}');
    sessionStorage.setItem('booking_auth_redirect', '1');
    component.resumableBooking.set(makeBooking());
    component.holdSecondsLeft.set(100);
    component.holdExpired.set(true);

    (component as unknown as { clearTransientBookingState: () => void }).clearTransientBookingState();

    expect(sessionStorage.getItem('pending_booking')).toBeNull();
    expect(sessionStorage.getItem('booking_auth_redirect')).toBeNull();
    expect(component.resumableBooking()).toBeNull();
    expect(component.holdSecondsLeft()).toBe(0);
    expect(component.holdExpired()).toBe(false);
  });

  // 9. proceedToPayment clears conflict and retries when dates become free
  it('proceedToPayment in conflict mode clears and retries when availability returns clean', () => {
    bookingService.getCheckoutState.mockReturnValue(checkoutState);
    // Return no conflicts
    bookingService.getUnavailableDates.mockReturnValue(
      of({ unavailable_dates: [], held_dates: [] }),
    );
    bookingService.findResumableBooking.mockReturnValue(of(null));
    bookingService.createBooking.mockReturnValue(of(makeBooking()));

    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    const redirectSpy = redirectSpyFor(component);
    component.ngOnInit();
    component.bookingConflict.set(true);
    component.form.user_name = 'Athit';
    component.form.email = 'athit@example.com';

    component.proceedToPayment();

    // Should have cleared conflict and recursed into the normal flow
    expect(component.bookingConflict()).toBe(false);
    expect(bookingService.createBooking).toHaveBeenCalled();
    expect(redirectSpy).toHaveBeenCalled();
  });

  // 10. Button is enabled after date change recovery
  it('submit button is enabled after inline date change clears conflict', async () => {
    bookingService.getCheckoutState.mockReturnValue(checkoutState);

    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    fixture.detectChanges();

    // Enter conflict state
    component.setConflictState('Dates taken', 'Unavailable');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    let primaryButton = element.querySelector('.checkout-actions .btn--primary') as HTMLButtonElement;

    // Button should NOT be disabled (data-driven approach)
    expect(primaryButton.disabled).toBe(false);

    // Apply new dates via inline editor
    component.startEditingDates();
    component.onInlineDateChange({ checkIn: '2026-05-01', checkOut: '2026-05-03' });
    component.applyDateChange();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    primaryButton = element.querySelector('.checkout-actions .btn--primary') as HTMLButtonElement;

    // After date change, conflict is cleared, button is enabled
    expect(component.bookingConflict()).toBe(false);
    expect(primaryButton.disabled).toBe(false);
    expect(primaryButton.textContent).toContain('Proceed to Payment');
  });

  // ── datesOverlap utility tests ──────────────────────────────────────────────

  it('datesOverlap returns true when stay window overlaps blocked dates', () => {
    bookingService.getCheckoutState.mockReturnValue(checkoutState);

    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;

    expect(component.datesOverlap('2026-04-10', '2026-04-12', ['2026-04-10'], [])).toBe(true);
    expect(component.datesOverlap('2026-04-10', '2026-04-12', [], ['2026-04-11'])).toBe(true);
    expect(component.datesOverlap('2026-04-10', '2026-04-12', [], [])).toBe(false);
    expect(component.datesOverlap('2026-04-10', '2026-04-12', ['2026-04-12'], [])).toBe(false); // checkout day excluded
  });

  // ── resetCheckoutErrors utility ──────────────────────────────────────────────

  it('resetCheckoutErrors clears all error and toast signals', () => {
    bookingService.getCheckoutState.mockReturnValue(checkoutState);

    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.submitError.set('Some error');
    component.toastMessage.set('Some toast');
    component.nameError.set('Name err');
    component.emailError.set('Email err');
    component.phoneError.set('Phone err');

    component.resetCheckoutErrors();

    expect(component.submitError()).toBe('');
    expect(component.toastMessage()).toBe('');
    expect(component.nameError()).toBe('');
    expect(component.emailError()).toBe('');
    expect(component.phoneError()).toBe('');
  });
});
