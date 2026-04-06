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
});