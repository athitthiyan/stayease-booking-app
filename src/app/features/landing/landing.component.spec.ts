import { of, throwError } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { LandingComponent } from './landing.component';
import { RoomService } from '../../core/services/room.service';
import { BookingService } from '../../core/services/booking.service';
import { AuthService } from '../../core/services/auth.service';
import { Booking } from '../../core/models/booking.model';
import { Room } from '../../core/models/room.model';

const mockRoom = (overrides: Partial<Room> = {}): Room => ({
  id: 1,
  hotel_name: 'Azure',
  room_type: 'suite',
  price: 200,
  availability: true,
  rating: 4.8,
  review_count: 20,
  image_url: 'https://example.com/room.jpg',
  location: 'New York',
  max_guests: 2,
  beds: 1,
  bathrooms: 1,
  is_featured: true,
  created_at: '2026-04-01T00:00:00.000Z',
  ...overrides,
});

const mockBooking = (overrides: Partial<Booking> = {}): Booking => ({
  id: 14,
  booking_ref: 'BKHOME',
  user_name: 'Athit',
  email: 'athit@example.com',
  phone: '1234567890',
  room_id: 1,
  room: mockRoom(),
  check_in: '2026-05-01T00:00:00.000Z',
  check_out: '2026-05-03T00:00:00.000Z',
  hold_expires_at: new Date(Date.now() + 300_000).toISOString(),
  guests: 2,
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

describe('LandingComponent', () => {
  const roomService = {
    getFeaturedRooms: jest.fn(),
  };
  const bookingService = {
    getMyBookings: jest.fn(),
    setCheckoutState: jest.fn(),
  };
  const authService = {
    isLoggedIn: false,
  };

  beforeEach(async () => {
    roomService.getFeaturedRooms.mockReset();
    bookingService.getMyBookings.mockReset();
    bookingService.setCheckoutState.mockReset();
    authService.isLoggedIn = false;

    await TestBed.configureTestingModule({
      imports: [LandingComponent],
      providers: [
        provideRouter([]),
        { provide: RoomService, useValue: roomService },
        { provide: BookingService, useValue: bookingService },
        { provide: AuthService, useValue: authService },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    sessionStorage.clear();
    jest.restoreAllMocks();
  });

  it('loads featured rooms successfully', () => {
    roomService.getFeaturedRooms.mockReturnValue(of([{ id: 1, hotel_name: 'Azure' }]));
    bookingService.getMyBookings.mockReturnValue(
      of({ bookings: [], total: 0, upcoming: 0, past: 0, cancelled: 0 }),
    );

    const fixture = TestBed.createComponent(LandingComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    expect(roomService.getFeaturedRooms).toHaveBeenCalledWith(6);
    expect(component.featuredRooms()).toEqual([{ id: 1, hotel_name: 'Azure' }]);
    expect(component.roomsError()).toBe(false);
    expect(component.loadingRooms()).toBe(false);
    expect(component.destinations.length).toBe(5);
    expect(component.features.length).toBe(4);
    expect(component.testimonials.length).toBe(3);
    expect(component.particles.length).toBe(20);
  });

  it('handles featured room load failure', () => {
    roomService.getFeaturedRooms.mockReturnValue(throwError(() => new Error('boom')));
    bookingService.getMyBookings.mockReturnValue(
      of({ bookings: [], total: 0, upcoming: 0, past: 0, cancelled: 0 }),
    );

    const fixture = TestBed.createComponent(LandingComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    expect(component.featuredRooms()).toEqual([]);
    expect(component.roomsError()).toBe(true);
    expect(component.loadingRooms()).toBe(false);
  });

  it('builds search params and navigates', () => {
    roomService.getFeaturedRooms.mockReturnValue(of([]));
    bookingService.getMyBookings.mockReturnValue(
      of({ bookings: [], total: 0, upcoming: 0, past: 0, cancelled: 0 }),
    );

    const fixture = TestBed.createComponent(LandingComponent);
    const component = fixture.componentInstance;
    const router = TestBed.inject(Router);
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);

    component.searchCity = 'Bali';
    component.checkIn = '2026-05-01';
    component.checkOut = '2026-05-05';
    component.guests = 3;

    component.search();

    expect(navigateSpy).toHaveBeenCalledWith(['/search'], {
      queryParams: {
        city: 'Bali',
        check_in: '2026-05-01',
        check_out: '2026-05-05',
        guests: 3,
      },
    });
  });

  it('omits empty search params', () => {
    roomService.getFeaturedRooms.mockReturnValue(of([]));
    bookingService.getMyBookings.mockReturnValue(
      of({ bookings: [], total: 0, upcoming: 0, past: 0, cancelled: 0 }),
    );

    const fixture = TestBed.createComponent(LandingComponent);
    const component = fixture.componentInstance;
    const router = TestBed.inject(Router);
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);

    component.searchCity = '';
    component.checkIn = '';
    component.checkOut = '';
    component.guests = 0 as never;

    component.search();

    expect(navigateSpy).toHaveBeenCalledWith(['/search'], { queryParams: {} });
  });

  it('loads an active booking banner for logged-in users', () => {
    authService.isLoggedIn = true;
    roomService.getFeaturedRooms.mockReturnValue(of([]));
    bookingService.getMyBookings.mockReturnValue(
      of({ bookings: [mockBooking()], total: 1, upcoming: 0, past: 0, cancelled: 0 }),
    );

    const fixture = TestBed.createComponent(LandingComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    expect(bookingService.getMyBookings).toHaveBeenCalled();
    expect(component.activeBooking()?.booking_ref).toBe('BKHOME');
    expect(component.activeBookingSecondsLeft()).toBeGreaterThan(0);
    component.ngOnDestroy();
  });

  it('resumes the active booking from the landing CTA', () => {
    roomService.getFeaturedRooms.mockReturnValue(of([]));
    bookingService.getMyBookings.mockReturnValue(
      of({ bookings: [], total: 0, upcoming: 0, past: 0, cancelled: 0 }),
    );
    const router = TestBed.inject(Router);
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);

    const fixture = TestBed.createComponent(LandingComponent);
    const component = fixture.componentInstance;
    component.activeBooking.set(mockBooking());

    component.resumeActiveBooking();

    expect(bookingService.setCheckoutState).toHaveBeenCalledWith({
      room: expect.objectContaining({ id: 1 }),
      checkIn: '2026-05-01',
      checkOut: '2026-05-03',
      guests: 2,
    });
    expect(sessionStorage.getItem('pending_booking')).toContain('"booking_ref":"BKHOME"');
    expect(navigateSpy).toHaveBeenCalledWith(['/checkout', 1]);
  });

  it('falls back to booking history when the active booking room is missing', () => {
    roomService.getFeaturedRooms.mockReturnValue(of([]));
    bookingService.getMyBookings.mockReturnValue(
      of({ bookings: [], total: 0, upcoming: 0, past: 0, cancelled: 0 }),
    );
    const router = TestBed.inject(Router);
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);

    const fixture = TestBed.createComponent(LandingComponent);
    const component = fixture.componentInstance;
    component.activeBooking.set(mockBooking({ room: undefined }));

    component.resumeActiveBooking();

    expect(navigateSpy).toHaveBeenCalledWith(['/booking-history']);
  });
});
