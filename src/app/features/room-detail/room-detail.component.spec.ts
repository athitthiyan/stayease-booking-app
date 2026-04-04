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

describe('RoomDetailComponent', () => {
  let roomService: { getRoom: jest.Mock };
  let bookingService: { setCheckoutState: jest.Mock };
  let mockWishlist: Partial<WishlistService>;
  let mockAuth: Partial<AuthService>;

  beforeEach(async () => {
    roomService = { getRoom: jest.fn() };
    bookingService = { setCheckoutState: jest.fn() };
    mockWishlist = { loadStatus: jest.fn().mockReturnValue(of({})), toggle: jest.fn(), isSaved: jest.fn().mockReturnValue(false) };
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
            snapshot: {
              paramMap: {
                get: () => '5',
              },
            },
          },
        },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads room details and gallery', () => {
    roomService.getRoom.mockReturnValue(
      of({
        id: 5,
        hotel_name: 'The Grand Azure',
        room_type: 'suite',
        image_url: 'https://example.com/main.jpg',
        gallery_urls: JSON.stringify(['https://example.com/main.jpg', 'https://example.com/2.jpg']),
        amenities: JSON.stringify(['WiFi', 'Spa']),
        price: 200,
        max_guests: 3,
      })
    );

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

  it('updates dates and navigates to checkout', () => {
    roomService.getRoom.mockReturnValue(
      of({
        id: 5,
        hotel_name: 'The Grand Azure',
        room_type: 'suite',
        image_url: 'https://example.com/main.jpg',
        gallery_urls: 'invalid-json',
        amenities: 'invalid-json',
        price: 200,
        max_guests: 3,
      })
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
});
