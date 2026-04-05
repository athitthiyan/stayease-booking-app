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
import { Room } from '../../core/models/room.model';
import { ROOM_IMAGE_PLACEHOLDER } from '../../shared/utils/image-fallback';

const mockRoom = (overrides: Partial<Room> = {}): Room => ({
  id: 5,
  hotel_name: 'The Grand Azure',
  room_type: 'suite',
  availability: true,
  rating: 4.8,
  review_count: 24,
  image_url: 'https://example.com/main.jpg',
  gallery_urls: JSON.stringify(['https://example.com/main.jpg', 'https://example.com/2.jpg']),
  amenities: JSON.stringify(['WiFi', 'Spa']),
  price: 200,
  max_guests: 3,
  beds: 1,
  bathrooms: 1,
  is_featured: false,
  created_at: '2026-04-01T00:00:00.000Z',
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

  it('renders the cancellation policy block for trust messaging', () => {
    roomService.getRoom.mockReturnValue(of(mockRoom()));

    const fixture = TestBed.createComponent(RoomDetailComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Free Cancellation');
    expect(element.textContent).toContain('Check-in:');
    expect(element.textContent).toContain('Check-out:');
  });

  it('uses default guest options before a room is loaded', () => {
    const fixture = TestBed.createComponent(RoomDetailComponent);
    const component = fixture.componentInstance;

    expect(component.guestOptions).toEqual([1, 2, 3, 4]);
  });

  it('loads wishlist status for logged-in users', () => {
    Object.defineProperty(mockAuth, 'isLoggedIn', { value: true, configurable: true });
    roomService.getRoom.mockReturnValue(of(mockRoom()));

    const fixture = TestBed.createComponent(RoomDetailComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    expect(mockWishlist.loadStatus).toHaveBeenCalled();
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
    expect(component.formError()).toBe('Please select valid check-in and check-out dates.');
  });

  it('clears the inline form error after the user updates dates', () => {
    roomService.getRoom.mockReturnValue(of(mockRoom()));

    const fixture = TestBed.createComponent(RoomDetailComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.bookNow();
    expect(component.formError()).toBeTruthy();

    component.checkIn = '2026-04-10';
    component.checkOut = '2026-04-12';
    component.onDateChange();

    expect(component.formError()).toBe('');
  });

  it('returns an empty amenities list when room amenities JSON is invalid', () => {
    roomService.getRoom.mockReturnValue(
      of(mockRoom({ amenities: 'invalid-json', gallery_urls: '[]' })),
    );

    const fixture = TestBed.createComponent(RoomDetailComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    expect(component.amenities()).toEqual([]);
  });

  it('returns empty amenities and gallery lists when optional JSON fields are missing', () => {
    roomService.getRoom.mockReturnValue(
      of(mockRoom({ amenities: undefined, gallery_urls: undefined, image_url: '' })),
    );

    const fixture = TestBed.createComponent(RoomDetailComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    expect(component.amenities()).toEqual([]);
    expect(component.galleryImages()).toEqual([ROOM_IMAGE_PLACEHOLDER]);
    expect(component.activeImage()).toBe(ROOM_IMAGE_PLACEHOLDER);
  });

  it('falls back to an empty gallery image when both main image and gallery are missing', () => {
    roomService.getRoom.mockReturnValue(
      of(mockRoom({ image_url: '', gallery_urls: 'invalid-json' })),
    );

    const fixture = TestBed.createComponent(RoomDetailComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    expect(component.galleryImages()).toEqual([ROOM_IMAGE_PLACEHOLDER]);
    expect(component.activeImage()).toBe(ROOM_IMAGE_PLACEHOLDER);
  });

  it('keeps gallery images when the main image is absent but gallery JSON is valid', () => {
    roomService.getRoom.mockReturnValue(
      of(
        mockRoom({
          image_url: '',
          gallery_urls: JSON.stringify(['https://example.com/gallery-only.jpg']),
        }),
      ),
    );

    const fixture = TestBed.createComponent(RoomDetailComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    expect(component.galleryImages()).toEqual(['https://example.com/gallery-only.jpg']);
    expect(component.activeImage()).toBe('https://example.com/gallery-only.jpg');
  });

  it('falls back to the placeholder when room image URLs are malformed', () => {
    roomService.getRoom.mockReturnValue(
      of(
        mockRoom({
          image_url: 'bad-image-value',
          gallery_urls: JSON.stringify(['still-bad']),
        }),
      ),
    );

    const fixture = TestBed.createComponent(RoomDetailComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    expect(component.galleryImages()).toEqual([ROOM_IMAGE_PLACEHOLDER]);
    expect(component.activeImage()).toBe(ROOM_IMAGE_PLACEHOLDER);
  });

  it('sets the active image when a thumbnail is selected', () => {
    roomService.getRoom.mockReturnValue(of(mockRoom()));

    const fixture = TestBed.createComponent(RoomDetailComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    component.setActiveImage(1);

    expect(component.activeImageIdx()).toBe(1);
    expect(component.activeImage()).toBe('https://example.com/2.jpg');
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
    expect(component.availabilityStatus()).toBe('ready');
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

  it('calculates a zero total when the room price is missing', () => {
    roomService.getRoom.mockReturnValue(of(mockRoom({ price: undefined })));

    const fixture = TestBed.createComponent(RoomDetailComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.checkIn = '2026-04-10';
    component.checkOut = '2026-04-12';
    component.onDateChange();

    expect(component.nights()).toBe(2);
    expect(component.totalAmount()).toBe(0);
  });

  it('blocks booking when unavailable-dates API fails', () => {
    bookingService.getUnavailableDates.mockReturnValue(throwError(() => new Error('network')));
    roomService.getRoom.mockReturnValue(of(mockRoom()));
    const router = TestBed.inject(Router);
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);

    const fixture = TestBed.createComponent(RoomDetailComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.checkIn = '2026-04-10';
    component.checkOut = '2026-04-12';
    component.onDateChange();
    component.bookNow();

    expect(component.dateConflict()).toBe('');
    expect(component.unavailableDates()).toEqual([]);
    expect(component.availabilityStatus()).toBe('error');
    expect(component.formError()).toContain('live availability');
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('toggles the wishlist only when a room is loaded', () => {
    (mockWishlist.toggle as jest.Mock).mockReturnValue(of({}));
    roomService.getRoom.mockReturnValue(of(mockRoom()));

    const fixture = TestBed.createComponent(RoomDetailComponent);
    const component = fixture.componentInstance;

    component.toggleWishlist();
    expect(mockWishlist.toggle).not.toHaveBeenCalled();

    component.ngOnInit();
    component.toggleWishlist();
    expect(mockWishlist.toggle).toHaveBeenCalledWith(5);
  });

  it('replaces broken room images with the placeholder', () => {
    roomService.getRoom.mockReturnValue(of(mockRoom()));

    const fixture = TestBed.createComponent(RoomDetailComponent);
    const component = fixture.componentInstance;
    const image = document.createElement('img');
    image.src = 'https://example.com/broken.jpg';

    component.onImageError({ target: image } as unknown as Event);

    expect(image.src).toBe(ROOM_IMAGE_PLACEHOLDER);
  });
});
