import { of } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { RoomCardComponent } from './room-card.component';
import { WishlistService } from '../../../core/services/wishlist.service';
import { AuthService } from '../../../core/services/auth.service';
import { Room } from '../../../core/models/room.model';

describe('RoomCardComponent', () => {
  const wishlistService = {
    isSaved: jest.fn(),
    toggle: jest.fn(),
  };

  const authService = {
    isLoggedIn: true,
  };

  const room: Room = {
    id: 7,
    room_type: 'suite',
    description: 'Premium suite',
    rating: 4.4,
    original_price: 400,
    price: 300,
    hotel_name: 'Azure Stay',
    city: 'Kyoto',
    country: 'Japan',
    availability: true,
    review_count: 10,
    beds: 2,
    bathrooms: 1,
    max_guests: 3,
    size_sqft: 500,
    image_url: '',
    is_featured: true,
    created_at: '2026-04-01T00:00:00.000Z',
  };

  beforeEach(async () => {
    wishlistService.isSaved.mockReset().mockReturnValue(false);
    wishlistService.toggle.mockReset().mockReturnValue(of({}));
    authService.isLoggedIn = true;

    await TestBed.configureTestingModule({
      imports: [RoomCardComponent],
      providers: [
        provideRouter([]),
        { provide: WishlistService, useValue: wishlistService },
        { provide: AuthService, useValue: authService },
      ],
    }).compileComponents();
  });

  it('derives labels, stars, and discount on init', () => {
    const fixture = TestBed.createComponent(RoomCardComponent);
    const component = fixture.componentInstance;
    component.room = room;

    component.ngOnInit();

    expect(component.roomTypeLabel).toBe('Suite');
    expect(component.starStr).toBe('★★★★☆');
    expect(component.discountPct).toBe(25);
  });

  it('falls back to the raw room type and no discount when needed', () => {
    const fixture = TestBed.createComponent(RoomCardComponent);
    const component = fixture.componentInstance;
    component.room = {
      ...room,
      room_type: 'villa' as unknown as Room['room_type'],
      original_price: 200,
      price: 300,
      rating: 5,
    };

    component.ngOnInit();

    expect(component.roomTypeLabel).toBe('villa');
    expect(component.starStr).toBe('★★★★★');
    expect(component.discountPct).toBe(0);
  });

  it('replaces the image source on error', () => {
    const fixture = TestBed.createComponent(RoomCardComponent);
    const component = fixture.componentInstance;
    component.room = room;

    const image = document.createElement('img');
    component.onImgError({ target: image } as unknown as Event);

    expect(image.src).toBe(component.placeholderImg);
  });

  it('toggles wishlist and prevents navigation click-through', () => {
    const fixture = TestBed.createComponent(RoomCardComponent);
    const component = fixture.componentInstance;
    component.room = room;
    const event = {
      stopPropagation: jest.fn(),
      preventDefault: jest.fn(),
    } as unknown as Event;

    component.toggleWishlist(event);

    expect(wishlistService.toggle).toHaveBeenCalledWith(7);
    expect((event.stopPropagation as jest.Mock)).toHaveBeenCalled();
    expect((event.preventDefault as jest.Mock)).toHaveBeenCalled();
  });

  it('resolves a valid image URL and falls back to the placeholder for invalid ones', () => {
    const fixture = TestBed.createComponent(RoomCardComponent);
    const component = fixture.componentInstance;
    component.room = room;
    component.ngOnInit();

    expect(component.resolveImage('https://example.com/room.jpg')).toBe('https://example.com/room.jpg');
    expect(component.resolveImage('not-a-url')).toBe(component.placeholderImg);
  });
});
