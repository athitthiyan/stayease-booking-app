import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, Subject, of, throwError } from 'rxjs';
import { NavigationEnd, Router } from '@angular/router';
import { ActiveBookingService } from './active-booking.service';
import { AuthService } from './auth.service';
import { BookingService } from './booking.service';
import { ActiveHold, Booking } from '../models/booking.model';
import { Room } from '../models/room.model';
import { UserResponse } from '../models/auth.model';

const mockUser: UserResponse = {
  id: 1,
  email: 'athit@example.com',
  full_name: 'Athit Thiyan',
  phone: null,
  avatar_url: null,
  is_admin: false,
  is_active: true,
  created_at: '2026-04-01T00:00:00.000Z',
};

const mockRoom = (overrides: Partial<Room> = {}): Room => ({
  id: 9,
  hotel_name: 'Grand Azure',
  room_type: 'suite',
  location: 'Chennai',
  price: 420,
  original_price: 580,
  image_url: 'https://example.com/room.jpg',
  gallery_urls: '[]',
  amenities: '[]',
  availability: true,
  rating: 4.9,
  review_count: 120,
  max_guests: 2,
  beds: 1,
  bathrooms: 1,
  is_featured: true,
  created_at: '2026-04-01T00:00:00.000Z',
  ...overrides,
});

const mockBooking = (overrides: Partial<Booking> = {}): Booking => ({
  id: 17,
  booking_ref: 'BKACTIVE',
  user_name: 'Athit',
  email: 'athit@example.com',
  room_id: 9,
  room: mockRoom(),
  check_in: '2026-05-01T00:00:00.000Z',
  check_out: '2026-05-03T00:00:00.000Z',
  hold_expires_at: '2026-05-01T10:10:00.000Z',
  guests: 2,
  adults: 2,
  children: 0,
  infants: 0,
  nights: 2,
  room_rate: 840,
  taxes: 101,
  service_fee: 42,
  total_amount: 983,
  status: 'pending',
  payment_status: 'pending',
  created_at: '2026-04-01T00:00:00.000Z',
  ...overrides,
});

const mockHold = (overrides: Partial<ActiveHold> = {}): ActiveHold => ({
  booking_id: 17,
  room_id: 9,
  hotel_name: 'Grand Azure',
  room_name: 'suite',
  check_in: '2026-05-01',
  check_out: '2026-05-03',
  guests: 2,
  adults: 2,
  children: 0,
  infants: 0,
  expires_at: '2026-05-01T10:10:00.000Z',
  remaining_seconds: 600,
  ...overrides,
});

const staleCacheKeys = [
  'activeBookingId',
  'holdExpiry',
  'activeHoldTimer',
  'paymentRetryState',
  'se_active_booking_visibility',
  'se_active_booking_cache',
  'pending_booking',
];

const seedStaleActiveBookingCache = (): void => {
  for (const key of staleCacheKeys) {
    localStorage.setItem(key, 'stale');
    sessionStorage.setItem(key, 'stale');
  }
};

describe('ActiveBookingService', () => {
  let service: ActiveBookingService;
  let authState$: BehaviorSubject<UserResponse | null>;
  let routerEvents$: Subject<NavigationEnd>;
  let bookingService: {
    getActiveHold: jest.Mock;
    getBooking: jest.Mock;
    setCheckoutState: jest.Mock;
    cancelBooking: jest.Mock;
  };
  let router: { events: Subject<NavigationEnd>; url: string; navigate: jest.Mock };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-01T10:00:00.000Z'));

    authState$ = new BehaviorSubject<UserResponse | null>(null);
    routerEvents$ = new Subject<NavigationEnd>();
    bookingService = {
      getActiveHold: jest.fn().mockReturnValue(of(null)),
      getBooking: jest.fn(),
      setCheckoutState: jest.fn(),
      cancelBooking: jest.fn(),
    };
    router = {
      events: routerEvents$,
      url: '/',
      navigate: jest.fn().mockResolvedValue(true),
    };

    TestBed.configureTestingModule({
      providers: [
        ActiveBookingService,
        {
          provide: AuthService,
          useValue: {
            currentUser$: authState$.asObservable(),
            get isLoggedIn() {
              return !!authState$.value;
            },
          },
        },
        { provide: BookingService, useValue: bookingService },
        { provide: Router, useValue: router },
      ],
    });

    service = TestBed.inject(ActiveBookingService);
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('loads active hold on login and updates countdown from backend expiry time', () => {
    bookingService.getActiveHold.mockReturnValue(of(mockHold({ lifecycle_state: 'HOLD_CREATED' })));

    authState$.next(mockUser);

    expect(service.activeHold()?.booking_id).toBe(17);
    expect(service.remainingSeconds()).toBe(600);
    expect(service.shouldShowActiveReservation()).toBe(true);

    jest.advanceTimersByTime(2_000);
    expect(service.remainingSeconds()).toBe(598);
  });

  it.each([
    mockHold({ lifecycle_state: 'CONFIRMED', payment_status: 'paid' }),
    mockHold({ lifecycle_state: 'CANCELLED', booking_status: 'cancelled' }),
    mockHold({ lifecycle_state: 'EXPIRED', booking_status: 'expired' }),
    mockHold({ lifecycle_state: 'REFUNDED', payment_status: 'refunded' }),
    mockHold({ lifecycle_state: 'PAYMENT_SUCCESS' }),
    mockHold({ lifecycle_state: 'PAYMENT_RETRY' }),
    mockHold({ booking_status: 'confirmed' }),
    mockHold({ payment_status: 'expired' }),
    mockHold({ lifecycle_state: 'HOLD_CREATED', payment_status: 'paid' }),
    mockHold({ remaining_seconds: 0 }),
  ])('hides closed or non-renderable active hold states from backend', hold => {
    seedStaleActiveBookingCache();
    bookingService.getActiveHold.mockReturnValue(of(hold));

    authState$.next(mockUser);

    expect(service.activeHold()).toBeNull();
    expect(service.shouldShowActiveReservation()).toBe(false);
    for (const key of staleCacheKeys) {
      expect(localStorage.getItem(key)).toBeNull();
      expect(sessionStorage.getItem(key)).toBeNull();
    }
  });

  it.each([
    mockHold({ lifecycle_state: 'HOLD_CREATED', payment_status: 'pending' }),
    mockHold({ lifecycle_state: 'PAYMENT_PENDING', payment_status: 'processing' }),
    mockHold({ lifecycle_state: 'PAYMENT_FAILED', payment_status: 'failed' }),
    mockHold({ lifecycle_state: 'PAYMENT_COOLDOWN', payment_status: 'failed' }),
    mockHold({ payment_status: 'processing' }),
    mockHold(),
  ])('shows active reservation states that still need user action', hold => {
    bookingService.getActiveHold.mockReturnValue(of(hold));

    authState$.next(mockUser);

    expect(service.activeHold()?.booking_id).toBe(17);
    expect(service.shouldShowActiveReservation()).toBe(true);
  });

  it('refreshes active hold on route navigation when logged in', () => {
    bookingService.getActiveHold.mockReturnValue(of(mockHold()));

    authState$.next(mockUser);
    routerEvents$.next(new NavigationEnd(1, '/search', '/search'));
    jest.advanceTimersByTime(250);

    expect(bookingService.getActiveHold).toHaveBeenCalledTimes(2);
  });

  it('continues an active booking by restoring checkout state and navigating to checkout by booking id', () => {
    service.activeHold.set(mockHold());
    bookingService.getBooking.mockReturnValue(of(mockBooking()));

    service.continueBooking();

    expect(bookingService.setCheckoutState).toHaveBeenCalledWith({
      room: expect.objectContaining({ id: 9 }),
      checkIn: '2026-05-01',
      checkOut: '2026-05-03',
      guests: 2,
      adults: 2,
      children: 0,
      infants: 0,
    });
    expect(sessionStorage.getItem('pending_booking')).toContain('"booking_ref":"BKACTIVE"');
    expect(router.navigate).toHaveBeenCalledWith(['/checkout', 17]);
  });

  it('gracefully clears stale booking ids when continue booking fails', () => {
    service.activeHold.set(mockHold());
    bookingService.getBooking.mockReturnValue(throwError(() => new Error('missing')));

    service.continueBooking();

    expect(service.activeHold()).toBeNull();
    expect(service.toastMessage()).toBe('This booking is no longer available.');
  });

  it('cancels an active booking and broadcasts sync state', () => {
    service.activeHold.set(mockHold());
    seedStaleActiveBookingCache();
    bookingService.cancelBooking.mockReturnValue(of(mockBooking({ status: 'cancelled' })));

    service.cancelActiveBooking();

    expect(bookingService.cancelBooking).toHaveBeenCalledWith(17);
    expect(service.activeHold()).toBeNull();
    expect(service.toastMessage()).toBe('Booking cancelled successfully.');
    expect(localStorage.getItem('se_active_booking_sync')).toContain('"cancelled"');
    for (const key of staleCacheKeys) {
      expect(localStorage.getItem(key)).toBeNull();
      expect(sessionStorage.getItem(key)).toBeNull();
    }
  });

  it('clears toast message and handle after duration elapses', () => {
    bookingService.cancelBooking.mockReturnValue(of(mockBooking({ status: 'cancelled' })));
    service.activeHold.set(mockHold());
    service.cancelActiveBooking();

    expect(service.toastMessage()).toBe('Booking cancelled successfully.');
    jest.advanceTimersByTime(4_000);
    expect(service.toastMessage()).toBe('');
  });

  it('refreshes on storage sync for se_user login', () => {
    bookingService.getActiveHold.mockReturnValue(of(mockHold()));
    authState$.next(mockUser);
    bookingService.getActiveHold.mockClear();

    window.dispatchEvent(new StorageEvent('storage', { key: 'se_user', newValue: JSON.stringify(mockUser) }));
    jest.advanceTimersByTime(250);
    expect(bookingService.getActiveHold).toHaveBeenCalled();
  });

  it('clears state on storage sync for se_user logout', () => {
    bookingService.getActiveHold.mockReturnValue(of(mockHold()));
    authState$.next(mockUser);

    window.dispatchEvent(new StorageEvent('storage', { key: 'se_user', newValue: null }));
    expect(service.activeHold()).toBeNull();
  });

  it('refreshes on window focus when logged in', () => {
    bookingService.getActiveHold.mockReturnValue(of(mockHold()));
    authState$.next(mockUser);
    bookingService.getActiveHold.mockClear();

    window.dispatchEvent(new Event('focus'));
    jest.advanceTimersByTime(250);
    expect(bookingService.getActiveHold).toHaveBeenCalled();
  });

  it('refreshes on document visibility change when visible and logged in', () => {
    bookingService.getActiveHold.mockReturnValue(of(mockHold()));
    authState$.next(mockUser);
    bookingService.getActiveHold.mockClear();

    Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    jest.advanceTimersByTime(250);
    expect(bookingService.getActiveHold).toHaveBeenCalled();
  });

  it('canContinue mirrors shouldShowActiveReservation', () => {
    expect(service.canContinue()).toBe(false);
    bookingService.getActiveHold.mockReturnValue(of(mockHold()));
    authState$.next(mockUser);
    expect(service.canContinue()).toBe(true);
  });

  it('retryLoad triggers a non-silent refresh', () => {
    bookingService.getActiveHold.mockReturnValue(of(null));
    authState$.next(mockUser);
    bookingService.getActiveHold.mockClear();

    service.retryLoad();
    expect(bookingService.getActiveHold).toHaveBeenCalled();
  });

  it('markBookingConfirmed suppresses confirmed booking and clears cache', () => {
    bookingService.getActiveHold.mockReturnValue(of(mockHold()));
    authState$.next(mockUser);

    service.markBookingConfirmed(mockBooking({ payment_status: 'paid', status: 'confirmed' }));
    expect(service.activeHold()).toBeNull();
  });

  it('markBookingConfirmed ignores non-paid non-confirmed bookings', () => {
    service.markBookingConfirmed(mockBooking({ payment_status: 'pending', status: 'pending' }));
    // No crash, no state change
  });

  it('continueBooking does nothing when no active hold', () => {
    service.continueBooking();
    expect(bookingService.getBooking).not.toHaveBeenCalled();
  });

  it('cancelActiveBooking does nothing when no active hold', () => {
    service.cancelActiveBooking();
    expect(bookingService.cancelBooking).not.toHaveBeenCalled();
  });

  it('cancelActiveBooking shows toast on error and retries', () => {
    service.activeHold.set(mockHold());
    bookingService.cancelBooking.mockReturnValue(throwError(() => new Error('boom')));
    bookingService.getActiveHold.mockReturnValue(of(null));

    service.cancelActiveBooking();

    expect(service.toastMessage()).toBe('Unable to cancel your active booking right now.');
  });

  it('shows loading error when refreshActiveHold fails', () => {
    bookingService.getActiveHold.mockReturnValue(throwError(() => new Error('network')));
    authState$.next(mockUser);

    expect(service.loadError()).toBe('Unable to retrieve active booking.');
  });

  it('resolves a closed hold by checking booking status - confirmed in another tab', () => {
    // Start with an active hold
    bookingService.getActiveHold.mockReturnValue(of(mockHold()));
    authState$.next(mockUser);
    expect(service.activeHold()?.booking_id).toBe(17);

    // Now the hold disappears (null) — triggers resolveClosedHold
    bookingService.getActiveHold.mockReturnValue(of(null));
    bookingService.getBooking.mockReturnValue(of(mockBooking({ payment_status: 'paid', status: 'confirmed' })));
    router.url = '/checkout/17';

    routerEvents$.next(new NavigationEnd(2, '/checkout/17', '/checkout/17'));
    jest.advanceTimersByTime(250);

    expect(service.toastMessage()).toBe('Booking confirmed in another tab.');
    expect(router.navigate).toHaveBeenCalledWith(['/booking-confirmation'], {
      queryParams: { ref: 'BKACTIVE' },
    });
  });

  it('resolves a closed hold as cancelled', () => {
    bookingService.getActiveHold.mockReturnValue(of(mockHold()));
    authState$.next(mockUser);

    bookingService.getActiveHold.mockReturnValue(of(null));
    bookingService.getBooking.mockReturnValue(of(mockBooking({ status: 'cancelled' })));

    routerEvents$.next(new NavigationEnd(2, '/', '/'));
    jest.advanceTimersByTime(250);

    expect(service.toastMessage()).toBe('Booking was cancelled.');
  });

  it('resolves a closed hold as expired when booking has an unknown status', () => {
    bookingService.getActiveHold.mockReturnValue(of(mockHold()));
    authState$.next(mockUser);

    bookingService.getActiveHold.mockReturnValue(of(null));
    bookingService.getBooking.mockReturnValue(of(mockBooking({ status: 'expired', payment_status: 'pending' })));

    routerEvents$.next(new NavigationEnd(2, '/', '/'));
    jest.advanceTimersByTime(250);

    expect(service.toastMessage()).toBe('Booking hold expired.');
  });

  it('shows expired toast when resolveClosedHold getBooking fails', () => {
    bookingService.getActiveHold.mockReturnValue(of(mockHold()));
    authState$.next(mockUser);

    bookingService.getActiveHold.mockReturnValue(of(null));
    bookingService.getBooking.mockReturnValue(throwError(() => new Error('not found')));

    routerEvents$.next(new NavigationEnd(2, '/', '/'));
    jest.advanceTimersByTime(250);

    expect(service.toastMessage()).toBe('Booking hold expired.');
  });

  it('continueBooking clears state when booking is cancelled or has no room', () => {
    service.activeHold.set(mockHold());
    bookingService.getBooking.mockReturnValue(of(mockBooking({ room: undefined })));

    service.continueBooking();

    expect(service.activeHold()).toBeNull();
    expect(service.toastMessage()).toBe('This booking is no longer available.');
  });

  it('suppresses a confirmed booking that reappears', () => {
    bookingService.getActiveHold.mockReturnValue(of(mockHold()));
    authState$.next(mockUser);

    // Mark booking as confirmed (suppresses ID 17)
    service.markBookingConfirmed(mockBooking({ payment_status: 'paid' }));
    expect(service.activeHold()).toBeNull();

    // Same hold reappears - should stay suppressed
    bookingService.getActiveHold.mockReturnValue(of(mockHold()));
    routerEvents$.next(new NavigationEnd(3, '/', '/'));
    expect(service.activeHold()).toBeNull();
  });

  it('clears suppression when a different booking id appears', () => {
    bookingService.getActiveHold.mockReturnValue(of(mockHold()));
    authState$.next(mockUser);

    service.markBookingConfirmed(mockBooking({ payment_status: 'paid' }));

    // A DIFFERENT booking appears
    bookingService.getActiveHold.mockReturnValue(of(mockHold({ booking_id: 99 })));
    routerEvents$.next(new NavigationEnd(3, '/', '/'));
    jest.advanceTimersByTime(250);
    expect(service.activeHold()?.booking_id).toBe(99);
  });

  it('clears state and shows toast when hold countdown expires', () => {
    // Set system time to 2 seconds before expiry
    jest.setSystemTime(new Date('2026-05-01T10:09:58.000Z'));
    bookingService.getActiveHold.mockReturnValue(of(mockHold({ expires_at: '2026-05-01T10:10:00.000Z', remaining_seconds: 2 })));
    authState$.next(mockUser);

    expect(service.remainingSeconds()).toBe(2);

    // After expiry, the service calls refreshActiveHold which returns null
    bookingService.getActiveHold.mockReturnValue(of(null));

    // Advance past expiry
    jest.setSystemTime(new Date('2026-05-01T10:10:01.000Z'));
    jest.advanceTimersByTime(2_000);

    expect(service.remainingSeconds()).toBe(0);
    expect(service.activeHold()).toBeNull();
  });

  it('polls for active hold at regular intervals', () => {
    bookingService.getActiveHold.mockReturnValue(of(mockHold()));
    authState$.next(mockUser);
    bookingService.getActiveHold.mockClear();

    jest.advanceTimersByTime(30_000);
    expect(bookingService.getActiveHold).toHaveBeenCalled();
  });

  it('ignores stale error responses when state version changes', () => {
    const errorSubject = new Subject<ActiveHold | null>();
    bookingService.getActiveHold.mockReturnValue(errorSubject.asObservable());
    authState$.next(mockUser);

    // State version changes (e.g., user logs out)
    authState$.next(null);

    // The original request errors, but stateVersion has changed
    errorSubject.error(new Error('network'));

    expect(service.loadError()).toBe('');
  });

  it('ignores stale active hold responses when state version changes', () => {
    const holdSubject = new Subject<ActiveHold | null>();
    bookingService.getActiveHold.mockReturnValue(holdSubject.asObservable());
    authState$.next(mockUser);

    // State version increments when we clear state by logging out
    authState$.next(null);

    // Now the original request resolves, but stateVersion has changed
    holdSubject.next(mockHold());
    holdSubject.complete();

    expect(service.activeHold()).toBeNull();
  });

  it('refreshes on storage sync for the active booking sync key', () => {
    bookingService.getActiveHold.mockReturnValue(of(mockHold()));
    authState$.next(mockUser);
    bookingService.getActiveHold.mockClear();

    window.dispatchEvent(new StorageEvent('storage', { key: 'se_active_booking_sync', newValue: 'updated' }));
    jest.advanceTimersByTime(250);
    expect(bookingService.getActiveHold).toHaveBeenCalled();
  });
});
