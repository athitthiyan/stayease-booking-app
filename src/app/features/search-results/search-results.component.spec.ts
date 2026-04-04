import { of, throwError } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
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
  let navigateSpy: jest.SpyInstance;

  const roomsResponse = {
    rooms: [
      { id: 1, rating: 4.8, is_featured: true, amenities: JSON.stringify(['WiFi', 'Breakfast']), hotel_name: 'Hotel One' },
      { id: 2, rating: 4.2, is_featured: false, amenities: JSON.stringify(['Pool']), hotel_name: 'Hotel Two' },
    ],
    total: 2,
    page: 1,
    per_page: 9,
  };

  beforeEach(async () => {
    roomService = { getRooms: jest.fn().mockReturnValue(of(roomsResponse)) };
    wishlistService = {
      loadStatus: jest.fn().mockReturnValue(of({})),
      isSaved: jest.fn().mockReturnValue(false),
      toggle: jest.fn(),
    };
    authService = { isLoggedIn: false };
    queryParams = {
      city: 'Paris',
      guests: '2',
      room_type: 'suite',
      sort_by: 'price_low_to_high',
      amenities: 'WiFi,Breakfast',
      min_rating: '4',
      landmark: 'Marina Beach',
      view: 'map',
    };

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
            snapshot: {},
          },
        },
      ],
    }).compileComponents();

    navigateSpy = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads rooms from query params on init and restores the typed filter model', () => {
    const fixture = TestBed.createComponent(SearchResultsComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    expect(roomService.getRooms).toHaveBeenCalledWith(
      expect.objectContaining({
        city: 'Paris',
        room_type: 'suite',
        guests: 2,
        landmark: 'Marina Beach',
        min_rating: 4,
        amenities: 'WiFi,Breakfast',
        sort_by: 'price_low_to_high',
      }),
    );
    expect(component.rooms().length).toBe(2);
    expect(component.showMap()).toBe(true);
    expect(component.loading()).toBe(false);
  });

  it('loads wishlist status for logged-in users', () => {
    authService.isLoggedIn = true;

    const fixture = TestBed.createComponent(SearchResultsComponent);
    fixture.componentInstance.ngOnInit();

    expect(wishlistService.loadStatus).toHaveBeenCalled();
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

  it('applies suggestions and syncs query params', () => {
    const fixture = TestBed.createComponent(SearchResultsComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.applySuggestion(component.searchSuggestions[0]);

    expect(component.draftFilters.city).toBe('Chennai');
    expect(component.page()).toBe(1);
    expect(navigateSpy).toHaveBeenCalled();
  });

  it('applies price filters, swaps invalid ranges, and exposes a price tag', () => {
    const fixture = TestBed.createComponent(SearchResultsComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.draftFilters.min_price = 5000;
    component.draftFilters.max_price = 3000;
    component.applyFilters();

    expect(component.draftFilters.min_price).toBe(3000);
    expect(component.draftFilters.max_price).toBe(5000);
    expect(component.activeFilterTags()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'price', label: 'Price: ₹3000 - ₹5000' }),
      ]),
    );
    expect(navigateSpy).toHaveBeenCalled();
  });

  it('removes the price filter tag and resets both price boundaries', () => {
    const fixture = TestBed.createComponent(SearchResultsComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.draftFilters.min_price = 0;
    component.draftFilters.max_price = 30000;
    component.removeFilter('price');

    expect(component.draftFilters.min_price).toBeUndefined();
    expect(component.draftFilters.max_price).toBeUndefined();
    expect(component.activeFilterTags().some(tag => tag.key === 'price')).toBe(false);
  });

  it('supports rating filters, clearing the rating, and sort label coverage', () => {
    const fixture = TestBed.createComponent(SearchResultsComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.draftFilters.min_rating = 4.5;
    component.draftFilters.sort_by = 'top_rated';

    expect(component.activeFilterTags()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'rating', label: '4.5+ stars' }),
        expect.objectContaining({ key: 'sort', label: 'Top rated' }),
      ]),
    );

    component.removeFilter('rating');
    expect(component.draftFilters.min_rating).toBeUndefined();

    component.draftFilters.sort_by = 'price_high_to_low';
    expect(component.currentSortLabel()).toBe('Price high to low');
    component.draftFilters.sort_by = 'price_low_to_high';
    expect(component.currentSortLabel()).toBe('Price low to high');
    component.draftFilters.sort_by = 'most_popular';
    expect(component.currentSortLabel()).toBe('Most popular');
  });

  it('supports multiple amenities and prevents duplicate amenity chips', () => {
    const fixture = TestBed.createComponent(SearchResultsComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.draftFilters.amenities = '';
    component.toggleAmenity('WiFi');
    component.toggleAmenity('Breakfast');
    component.toggleAmenity('WiFi');
    component.toggleAmenity('WiFi');

    expect(component.selectedAmenities()).toEqual(['Breakfast', 'WiFi']);
    expect(component.activeFilterTags()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'amenities', label: 'Amenities: Breakfast, WiFi' }),
      ]),
    );
  });

  it('filters search phrase suggestions, includes room-focused chips, and supports removing query filters', () => {
    const fixture = TestBed.createComponent(SearchResultsComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.draftFilters.city = '';
    component.draftFilters.query = 'family';
    expect(component.visibleSuggestions().map(item => item.label)).toEqual(['Family room']);

    component.draftFilters.query = 'Breakfast included';
    component.applyFilters();
    expect(component.activeFilterTags()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'query', label: 'Search: Breakfast included' }),
      ]),
    );

    component.removeFilter('query');
    expect(component.draftFilters.query).toBe('');
  });

  it('keeps empty-state scenarios stable when the backend returns no matches', () => {
    roomService.getRooms.mockReturnValue(of({ rooms: [], total: 0, page: 1, per_page: 9 }));

    const fixture = TestBed.createComponent(SearchResultsComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    expect(component.rooms()).toEqual([]);
    expect(component.total()).toBe(0);
    expect(component.error()).toBe(false);
  });

  it('toggles amenities, computes tags, removes filters, and clears all filters', () => {
    const fixture = TestBed.createComponent(SearchResultsComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.toggleAmenity('Pool');
    expect(component.selectedAmenities()).toContain('Pool');
    expect(component.activeFilterTags().length).toBeGreaterThan(0);

    component.removeFilter('amenities');
    expect(component.selectedAmenities()).toEqual([]);

    component.clearFilters();
    expect(component.draftFilters).toEqual({
      query: '',
      city: '',
      landmark: '',
      room_type: '',
      min_price: undefined,
      max_price: undefined,
      min_rating: undefined,
      amenities: '',
      guests: undefined,
      sort_by: 'recommended',
      check_in: '',
      check_out: '',
      page: 1,
      per_page: 9,
    });
    expect(component.showMap()).toBe(false);
  });

  it('toggles map and advanced state, paginates, and reloads publicly', () => {
    const scrollSpy = jest.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const fixture = TestBed.createComponent(SearchResultsComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.toggleAdvanced();
    component.toggleMap();
    component.goToPage(3);
    component.loadRoomsPublic();

    expect(component.advancedOpen()).toBe(true);
    expect(component.showMap()).toBe(false);
    expect(component.page()).toBe(3);
    expect(scrollSpy).toHaveBeenCalled();
    expect(roomService.getRooms).toHaveBeenCalledTimes(2);
  });
});
