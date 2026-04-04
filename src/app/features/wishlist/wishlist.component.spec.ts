import { of, throwError } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { WishlistComponent } from './wishlist.component';
import { WishlistService } from '../../core/services/wishlist.service';
import { AuthService } from '../../core/services/auth.service';

describe('WishlistComponent', () => {
  const wishlistService = {
    getWishlist: jest.fn(),
    remove: jest.fn(),
  };
  const authService = {
    isLoggedIn: true,
    currentUser: { full_name: 'Alex Doe' },
    logout: jest.fn(),
  };

  const response = {
    items: [
      { id: 1, room_id: 10, room: { hotel_name: 'Azure', location: 'NYC', rating: 4.5, room_type: 'suite', price: 200 } },
      { id: 2, room_id: 11, room: { hotel_name: 'Bali Stay', location: 'Bali', rating: 4.8, room_type: 'villa', price: 300 } },
    ],
  } as any;

  beforeEach(async () => {
    wishlistService.getWishlist.mockReset();
    wishlistService.remove.mockReset();

    await TestBed.configureTestingModule({
      imports: [WishlistComponent],
      providers: [
        provideRouter([]),
        { provide: WishlistService, useValue: wishlistService },
        { provide: AuthService, useValue: authService },
      ],
    }).compileComponents();
  });

  it('loads the wishlist on init', () => {
    wishlistService.getWishlist.mockReturnValue(of(response));

    const fixture = TestBed.createComponent(WishlistComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    expect(component.items()).toEqual(response.items);
    expect(component.loading()).toBe(false);
    expect(component.errorMsg()).toBe('');
  });

  it('handles wishlist load failure', () => {
    wishlistService.getWishlist.mockReturnValue(throwError(() => new Error('boom')));

    const fixture = TestBed.createComponent(WishlistComponent);
    const component = fixture.componentInstance;
    component.load();

    expect(component.errorMsg()).toBe('Unable to load your wishlist. Please try again.');
    expect(component.loading()).toBe(false);
  });

  it('removes an item successfully', () => {
    wishlistService.remove.mockReturnValue(of({}));

    const fixture = TestBed.createComponent(WishlistComponent);
    const component = fixture.componentInstance;
    component.items.set(response.items);

    component.remove(response.items[0]);

    expect(component.items().map(item => item.id)).toEqual([2]);
    expect(component.removing().has(10)).toBe(false);
  });

  it('clears the removing state after a remove error', () => {
    wishlistService.remove.mockReturnValue(throwError(() => new Error('boom')));

    const fixture = TestBed.createComponent(WishlistComponent);
    const component = fixture.componentInstance;
    component.items.set(response.items);

    component.remove(response.items[0]);

    expect(component.items()).toHaveLength(2);
    expect(component.removing().has(10)).toBe(false);
  });
});
