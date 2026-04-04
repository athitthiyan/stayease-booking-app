import { of, throwError } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { RoomDetailComponent } from './room-detail.component';
import { RoomService } from '../../core/services/room.service';
import { BookingService } from '../../core/services/booking.service';
import { WishlistService } from '../../core/services/wishlist.service';
import { AuthService } from '../../core/services/auth.service';

const mockRoom = (overrides: Partial<any> = {}) => ({
  id: 5,
  hotel_name: 'The Grand Azure',
  room_type: 'suite',
  image_url: 'https://example.com/main.jpg',
  gallery_urls: JSON.stringify(['https://example.com/main.jpg', 'https://example.com/2.jpg']),
  amenities: JSON.stringify(['WiFi', 'Spa']),
  price: 200,
  max_guests: 3,
  ...overrides,
});

describe('RoomDetailComponent', () => {
  let roomService: { getRoom: jest.Mock };
  let bookingService: {
    setCheckoutState: jest.Mock;
    getUnavailableDates: jest.Mock;
  };
  let mockWishlist: Partial<WishlistService>;
  let mockAuth: Partial<AuthService>;

  beforeEach(async () => {
    roomService = { getRoom: jest.fn() };
    bookingService = {
      setCheckoutState: jest.fn(),
      getUnavailableDates: jest.fn().mockReturnValue(
        of({ unavailable_dates: [], held_dates: [] }),
      ),
    };
    mockWishlist = {
      loadStatus: jest.fn().mockReturnValue(of({})),
      toggle: jest.fn(),
      isSaved: jest.fn().mockReturnValue(false),
    };
    mockAuth = { isLoggedIn: false };

    await TestBed.configureTestingModule({
      imports: [RoomDetailComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RoomService, useValue: roomService },
        { provide: BookingService, useValue: bookingService },
        { provide: WishlistService, useValue: mockWishlist },
        { provide: AuthService, useValue: mockAuth },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: () => '5' } },
          },
        },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ── Existing tests ──────────────────────────────────────────────────────────

  it('loads room details and gallery', () => {
    roomService.getRoom.mockReturnValue(of(mockRoom()));

    const fixture = TestBed.createComponent(RoomDetailComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    expect(component.room()?.hotel_name).toBe('The Grand Azure');
    expect(component.galleryImages().length).toBe(2);
    expect(component.activeImage()).toContain('main.jpg');
    expect(component.amenities()).toEqual(['WiFi', 'Spa']);
    expect(component.loading()).toBe(false);
  });

  it('handles room load error', () => {
    roomService.getRoom.mockReturnValue(throwError(() => new Error('boom')));

    const fixture = TestBed.createComponent(RoomDetailComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    expect(component.room()).toBeNull();
    expect(component.loadError()).toBe(true);
    expect(component.loading()).toBe(false);
  });

  it('updates dates, calculates totals, and navigates to checkout', () => {
    roomService.getRoom.mockReturnValue(
      of(mockRoom({ gallery_urls: 'invalid-json', amenities: 'invalid-json' }))
    );
    const router = TestBed.inject(Router);
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});

    const fixture = TestBed.createComponent(RoomDetailComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    component.checkIn = '2026-04-10';
    component.checkOut = '2026-04-12';
    component.onDateChange();
    component.bookNow();

    expect(component.nights()).toBe(2);
    expect(component.totalAmount()).toBe(468);
    expect(bookingService.setCheckoutState).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalled();
    expect(component.getAmenityIcon('Unknown')).toBe('✓');

    component.checkIn = '';
    component.checkOut = '';
    component.bookNow();
    expect(alertSpy).toHaveBeenCalled();
  });

  // ── Unavailable dates ──────────────────────────────────────────────────────

  it('loads unavailable dates after room loads', () => {
    roomService.getRoom.mockReturnValue(of(mockRoom()));

    const fixture = TestBed.createComponent(RoomDetailComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    expect(bookingService.getUnavailableDates).toHaveBeenCalledWith(5, expect.any(String), expect.any(String));
    expect(component.unavailableDates()).toEqual([]);
    expect(component.heldDates()).toEqual([]);
  });

  it('shows error when a selected night falls in unavailable_dates', () => {
    // Room loads, then unavailable-dates returns "2026-04-10" as booked
    bookingService.getUnavailableDates.mockReturnValue(
      of({ unavailable_dates: ['2026-04-10', '2026-04-11'], held_dates: [] }),
    );
    roomService.getRoom.mockReturnValue(of(mockRoom()));

    const fixture = TestBed.createComponent(RoomDetailComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.checkIn = '2026-04-10';
    component.checkOut = '2026-04-12';
    component.onDateChange();

    expect(component.dateConflict()).toContain('already booked');
  });

  it('shows held-date warning when a night is temporarily held', () => {
    bookingService.getUnavailableDates.mockReturnValue(
      of({ unavailable_dates: [], held_dates: ['2026-04-11'] }),
    );
    roomService.getRoom.mockReturnValue(of(mockRoom()));

    const fixture = TestBed.createComponent(RoomDetailComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.checkIn = '2026-04-10';
    component.checkOut = '2026-04-12';
    component.onDateChange();

    expect(component.dateConflict()).toContain('temporarily held');
  });

  it('clears dateConflict when no overlap exists', () => {
    bookingService.getUnavailableDates.mockReturnValue(
      of({ unavailable_dates: ['2026-05-01'], held_dates: [] }),
    );
    roomService.getRoom.mockReturnValue(of(mockRoom()));

    const fixture = TestBed.createComponent(RoomDetailComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.checkIn = '2026-04-10';
    component.checkOut = '2026-04-12';
    component.onDateChange();

    expect(component.dateConflict()).toBe('');
  });

  it('blocks bookNow when dateConflict is set', () => {
    bookingService.getUnavailableDates.mockReturnValue(
      of({ unavailable_dates: ['2026-04-10'], held_dates: [] }),
    );
    roomService.getRoom.mockReturnValue(of(mockRoom()));
    const router = TestBed.inject(Router);
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);

    const fixture = TestBed.createComponent(RoomDetailComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.checkIn = '2026-04-10';
    component.checkOut = '2026-04-12';
    component.onDateChange();
    component.bookNow(); // should return early due to conflict

    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('does not set conflict for single-date or no selection', () => {
    roomService.getRoom.mockReturnValue(of(mockRoom()));
    bookingService.getUnavailableDates.mockReturnValue(
      of({ unavailable_dates: ['2026-04-10'], held_dates: [] }),
    );

    const fixture = TestBed.createComponent(RoomDetailComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    // No dates set
    component.onDateChange();
    expect(component.dateConflict()).toBe('');

    // Same-day check-in/check-out (0 nights)
    component.checkIn = '2026-04-10';
    component.checkOut = '2026-04-10';
    component.onDateChange();
    expect(component.dateConflict()).toBe('');
  });

  it('gracefully handles unavailable-dates API error (no conflict shown)', () => {
    bookingService.getUnavailableDates.mockReturnValue(throwError(() => new Error('network')));
    roomService.getRoom.mockReturnValue(of(mockRoom()));

    const fixture = TestBed.createComponent(RoomDetailComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.checkIn = '2026-04-10';
    component.checkOut = '2026-04-12';
    component.onDateChange();

    // No conflict should be shown when the API fails
    expect(component.dateConflict()).toBe('');
    expect(component.unavailableDates()).toEqual([]);
  });
});
