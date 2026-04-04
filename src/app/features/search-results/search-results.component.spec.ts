import { of, throwError } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { SearchResultsComponent } from './search-results.component';
import { RoomService } from '../../core/services/room.service';
import { WishlistService } from '../../core/services/wishlist.service';
import { AuthService } from '../../core/services/auth.service';

describe('SearchResultsComponent', () => {
  let roomService: { getRooms: jest.Mock };
  let wishlistService: {
    loadStatus: jest.Mock;
    isSaved: jest.Mock;
    toggle: jest.Mock;
  };
  let authService: { isLoggedIn: boolean };
  let queryParams: Record<string, unknown>;

  beforeEach(async () => {
    roomService = { getRooms: jest.fn() };
    wishlistService = {
      loadStatus: jest.fn().mockReturnValue(of({})),
      isSaved: jest.fn().mockReturnValue(false),
      toggle: jest.fn(),
    };
    authService = { isLoggedIn: false };
    queryParams = { city: 'Paris', guests: '2', room_type: 'suite' };

    await TestBed.configureTestingModule({
      imports: [SearchResultsComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RoomService, useValue: roomService },
        { provide: WishlistService, useValue: wishlistService },
        { provide: AuthService, useValue: authService },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams: of(queryParams),
          },
        },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads rooms from query params on init', () => {
    roomService.getRooms.mockReturnValue(
      of({ rooms: [{ id: 1 }], total: 1, page: 1, per_page: 9 })
    );

    const fixture = TestBed.createComponent(SearchResultsComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    expect(roomService.getRooms).toHaveBeenCalled();
    expect(component.rooms().length).toBe(1);
    expect(component.total()).toBe(1);
    expect(component.loading()).toBe(false);
  });

  it('loads wishlist status for logged-in users', () => {
    authService.isLoggedIn = true;
    roomService.getRooms.mockReturnValue(
      of({ rooms: [{ id: 1, rating: 5 }], total: 1, page: 1, per_page: 9 }),
    );

    const fixture = TestBed.createComponent(SearchResultsComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    expect(wishlistService.loadStatus).toHaveBeenCalled();
    expect(component.filters.city).toBe('Paris');
    expect(component.filters.room_type).toBe('suite');
    expect(component.filters.guests).toBe(2);
  });

  it('handles load error', () => {
    roomService.getRooms.mockReturnValue(throwError(() => new Error('boom')));

    const fixture = TestBed.createComponent(SearchResultsComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    expect(component.error()).toBe(true);
    expect(component.rooms()).toEqual([]);
    expect(component.loading()).toBe(false);
  });

  it('clears filters and paginates', () => {
    roomService.getRooms.mockReturnValue(
      of({ rooms: [], total: 0, page: 1, per_page: 9 })
    );
    const scrollSpy = jest.spyOn(window, 'scrollTo').mockImplementation(() => {});

    const fixture = TestBed.createComponent(SearchResultsComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    component.clearFilters();
    component.goToPage(2);

    expect(component.page()).toBe(2);
    expect(scrollSpy).toHaveBeenCalled();
  });

  it('toggles advanced filters, computes counts, and applies advanced filters', () => {
    roomService.getRooms.mockReturnValue(
      of({
        rooms: [
          {
            id: 1,
            rating: 5,
            is_featured: true,
            amenities: JSON.stringify(['WiFi', 'Pool']),
          },
          {
            id: 2,
            rating: 3,
            is_featured: false,
            amenities: 'invalid-json',
          },
        ],
        total: 2,
        page: 1,
        per_page: 9,
      }),
    );

    const fixture = TestBed.createComponent(SearchResultsComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    component.toggleAdvanced();
    component.advFilters.minRating = 4;
    component.advFilters.minPrice = 300;
    component.advFilters.featuredOnly = true;
    component.toggleAmenity('WiFi');
    component.toggleAmenity('Pool');
    component.applyAdvanced();

    expect(component.advancedOpen()).toBe(false);
    expect(component.filters.min_price).toBe(300);
    expect(component.activeFilterCount()).toBe(5);
    expect(component.rooms().map(room => room.id)).toEqual([1]);

    component.toggleAmenity('Pool');
    expect(component.advFilters.amenities.has('Pool')).toBe(false);
  });

  it('removes empty params before searching and limits page numbers to seven', () => {
    roomService.getRooms.mockReturnValue(
      of({ rooms: [{ id: 1, rating: 5 }], total: 90, page: 1, per_page: 9 }),
    );

    const fixture = TestBed.createComponent(SearchResultsComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    component.clearFilters();

    const lastCallParams = roomService.getRooms.mock.calls.at(-1)?.[0];

    expect(lastCallParams).toEqual({ page: 1, per_page: 9 });
    component.total.set(90);
    expect(component.totalPages()).toBe(10);
    expect(component.pageNumbers()).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('resets the page when applyFilters is called and exposes the public reload helper', () => {
    roomService.getRooms.mockReturnValue(
      of({ rooms: [{ id: 1, rating: 5 }], total: 1, page: 1, per_page: 9 }),
    );

    const fixture = TestBed.createComponent(SearchResultsComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    component.page.set(3);

    component.applyFilters();
    component.loadRoomsPublic();

    expect(component.page()).toBe(1);
    expect(roomService.getRooms).toHaveBeenCalledTimes(3);
  });

  it('drops rooms with invalid amenities when amenity filtering is active', () => {
    roomService.getRooms.mockReturnValue(
      of({
        rooms: [
          { id: 1, rating: 5, is_featured: true, amenities: 'invalid-json' },
          { id: 2, rating: 5, is_featured: true, amenities: JSON.stringify(['WiFi']) },
        ],
        total: 2,
        page: 1,
        per_page: 9,
      }),
    );

    const fixture = TestBed.createComponent(SearchResultsComponent);
    const component = fixture.componentInstance;
    component.toggleAmenity('WiFi');

    component.ngOnInit();

    expect(component.rooms().map(room => room.id)).toEqual([2]);
  });
});
