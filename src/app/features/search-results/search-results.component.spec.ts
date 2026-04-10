import { of, throwError } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { SearchResultsComponent } from './search-results.component';
import { RoomService } from '../../core/services/room.service';
import { WishlistService } from '../../core/services/wishlist.service';
import { AuthService } from '../../core/services/auth.service';
import { BookingSearchStore } from '../../core/services/booking-search.store';
import { AvailabilityService } from '../../core/services/availability.service';

describe('SearchResultsComponent', () => {
  let roomService: { getRooms: jest.Mock };
  let wishlistService: {
    loadStatus: jest.Mock;
    isSaved: jest.Mock;
    toggle: jest.Mock;
  };
  let authService: { isLoggedIn: boolean };
  let searchStore: BookingSearchStore;
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
    searchStore = TestBed.inject(BookingSearchStore);
  });

  afterEach(() => {
    localStorage.removeItem('stayvora_explore_map_collapsed');
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

    expect(component.error()).toBe(false);
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

  it('updates dates from the shared picker and syncs them into the search state', () => {
    const fixture = TestBed.createComponent(SearchResultsComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.onDateChange({ checkIn: '2026-04-11', checkOut: '2026-04-13' });

    expect(component.draftFilters.check_in).toBe('2026-04-11');
    expect(component.draftFilters.check_out).toBe('2026-04-13');
    expect(searchStore.state().checkIn).toBe('2026-04-11');
    expect(searchStore.state().checkOut).toBe('2026-04-13');
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

  it('uses default price bounds in active tags when only one side of the range is set', () => {
    const fixture = TestBed.createComponent(SearchResultsComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.draftFilters.min_price = 1500;
    component.draftFilters.max_price = undefined;

    expect(component.activeFilterTags()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'price', label: 'Price: ₹1500 - ₹30000' }),
      ]),
    );

    component.draftFilters.min_price = undefined;
    component.draftFilters.max_price = 4500;

    expect(component.activeFilterTags()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'price', label: 'Price: ₹0 - ₹4500' }),
      ]),
    );
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

  it('returns the default suggestion list when no city or query text is present', () => {
    const fixture = TestBed.createComponent(SearchResultsComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.draftFilters.city = '';
    component.draftFilters.query = '';

    expect(component.visibleSuggestions()).toEqual(component.searchSuggestions);
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

  it('filters unavailable rooms out of the split-view results list', () => {
    roomService.getRooms.mockReturnValue(of({
      rooms: [
        { id: 1, hotel_name: 'Available One', availability: true },
        { id: 2, hotel_name: 'Hidden Hotel', availability: false },
        { id: 3, hotel_name: 'Availability Unknown' },
      ],
      total: 3,
      page: 1,
      per_page: 9,
    }));

    const fixture = TestBed.createComponent(SearchResultsComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    expect(component.rooms().map(room => room.id)).toEqual([1, 3]);
    expect(component.total()).toBe(2);
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
      per_page: 12,
    });
    expect(component.showMap()).toBe(true);
  });

  it('toggles map and advanced state, paginates, and reloads publicly', () => {
    const scrollSpy = jest.spyOn(window, 'scrollTo').mockImplementation(() => {});
    // Mock scrollTo on elements for jsdom
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Element.prototype.scrollTo = jest.fn() as any;
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
    // scrollTo is called either on the panel element or on window
    const panelScrolled = (Element.prototype.scrollTo as jest.Mock).mock.calls.length > 0;
    const windowScrolled = scrollSpy.mock.calls.length > 0;
    expect(panelScrolled || windowScrolled).toBe(true);
    expect(roomService.getRooms).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem('stayvora_explore_map_collapsed')).toBe('true');
  });

  it('restores the stored collapsed map preference when no query param overrides it', async () => {
    localStorage.setItem('stayvora_explore_map_collapsed', 'true');

    TestBed.resetTestingModule();
    roomService = { getRooms: jest.fn().mockReturnValue(of(roomsResponse)) };
    wishlistService = {
      loadStatus: jest.fn().mockReturnValue(of({})),
      isSaved: jest.fn().mockReturnValue(false),
      toggle: jest.fn(),
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
            queryParams: of({ city: 'Paris' }),
            snapshot: {},
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(SearchResultsComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    expect(component.showMap()).toBe(false);
    expect(component.isMapCollapsed()).toBe(true);
  });

  it('lets explicit view query params override the stored map preference and persist the new choice', async () => {
    localStorage.setItem('stayvora_explore_map_collapsed', 'true');

    TestBed.resetTestingModule();
    roomService = { getRooms: jest.fn().mockReturnValue(of(roomsResponse)) };
    wishlistService = {
      loadStatus: jest.fn().mockReturnValue(of({})),
      isSaved: jest.fn().mockReturnValue(false),
      toggle: jest.fn(),
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
            queryParams: of({ view: 'map' }),
            snapshot: {},
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(SearchResultsComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    expect(component.showMap()).toBe(true);
    expect(component.isMapCollapsed()).toBe(false);
    expect(localStorage.getItem('stayvora_explore_map_collapsed')).toBe('false');
  });

  it('derives headings, accents, and page numbers across helper states', () => {
    roomService.getRooms.mockReturnValue(of({ ...roomsResponse, total: 99 }));

    const fixture = TestBed.createComponent(SearchResultsComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    expect(component.totalPages()).toBe(1);
    expect(component.pageNumbers()).toEqual([1]);
    expect(component.resultsHeading()).toBe('Stays in');
    expect(component.resultsAccent()).toBe('Paris');

    component.draftFilters.city = '';
    component.draftFilters.landmark = 'Marina Beach';
    expect(component.resultsHeading()).toBe('Nearby stays for');
    expect(component.resultsAccent()).toBe('Marina Beach');

    component.draftFilters.landmark = '';
    component.draftFilters.query = '';
    expect(component.resultsHeading()).toBe('Explore');
    expect(component.resultsAccent()).toBe('curated results');
  });

  it('normalizes legacy sort aliases from query params and syncs date and page filters', async () => {
    for (const [rawSort, expected] of [
      ['price_asc', 'price_low_to_high'],
      ['price_desc', 'price_high_to_low'],
      ['rating_desc', 'top_rated'],
      ['featured', 'most_popular'],
      ['unknown', 'recommended'],
    ] as const) {
      TestBed.resetTestingModule();
      roomService = { getRooms: jest.fn().mockReturnValue(of(roomsResponse)) };
      wishlistService = {
        loadStatus: jest.fn().mockReturnValue(of({})),
        isSaved: jest.fn().mockReturnValue(false),
        toggle: jest.fn(),
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
              queryParams: of({ sort_by: rawSort, check_in: '2026-04-10', check_out: '2026-04-12', page: '2' }),
              snapshot: {},
            },
          },
        ],
      }).compileComponents();

      const router = TestBed.inject(Router);
      const localNavigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);
      const fixture = TestBed.createComponent(SearchResultsComponent);
      const component = fixture.componentInstance;
      component.ngOnInit();

      expect(component.draftFilters.sort_by).toBe(expected);
      expect(component.draftFilters.check_in).toBe('2026-04-10');
      expect(component.draftFilters.check_out).toBe('2026-04-12');
      expect(component.page()).toBe(2);

      component.showMap.set(true);
      component.applyFilters();
      expect(localNavigateSpy).toHaveBeenCalledWith(
        [],
        expect.objectContaining({
          queryParams: expect.objectContaining({
            check_in: '2026-04-10',
            check_out: '2026-04-12',
          }),
        }),
      );

      jest.restoreAllMocks();
    }
  });

  it('parses numeric min and max price filters from query params', async () => {
    TestBed.resetTestingModule();
    roomService = { getRooms: jest.fn().mockReturnValue(of(roomsResponse)) };
    wishlistService = {
      loadStatus: jest.fn().mockReturnValue(of({})),
      isSaved: jest.fn().mockReturnValue(false),
      toggle: jest.fn(),
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
            queryParams: of({ min_price: '1200', max_price: '3400' }),
            snapshot: {},
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(SearchResultsComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    expect(component.draftFilters.min_price).toBe(1200);
    expect(component.draftFilters.max_price).toBe(3400);
  });

  it('removes remaining filter types and falls back to recommended sort labels', () => {
    const fixture = TestBed.createComponent(SearchResultsComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.draftFilters.city = 'Paris';
    component.draftFilters.landmark = 'Harbor';
    component.draftFilters.room_type = 'suite';
    component.draftFilters.guests = 4;
    component.draftFilters.sort_by = 'recommended';

    component.removeFilter('city');
    component.removeFilter('landmark');
    component.removeFilter('room_type');
    component.removeFilter('guests');
    component.removeFilter('sort');

    expect(component.draftFilters.city).toBe('');
    expect(component.draftFilters.landmark).toBe('');
    expect(component.draftFilters.room_type).toBe('');
    expect(component.draftFilters.guests).toBeUndefined();
    expect(component.draftFilters.sort_by).toBe('recommended');
    expect(component.currentSortLabel()).toBe('Recommended');
  });

  it('falls back to recommended sort text and request params when sort_by is empty', () => {
    const fixture = TestBed.createComponent(SearchResultsComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.draftFilters.sort_by = undefined as unknown as typeof component.draftFilters.sort_by;
    expect(component.currentSortLabel()).toBe('Recommended');

    component.loadRoomsPublic();

    expect(roomService.getRooms).toHaveBeenLastCalledWith(
      expect.objectContaining({ sort_by: 'recommended' }),
    );
  });

  it('covers image helpers, list-view query params, and the escape fullscreen listener', () => {
    TestBed.resetTestingModule();
    roomService = { getRooms: jest.fn().mockReturnValue(of(roomsResponse)) };
    wishlistService = {
      loadStatus: jest.fn().mockReturnValue(of({})),
      isSaved: jest.fn().mockReturnValue(false),
      toggle: jest.fn(),
    };

    return TestBed.configureTestingModule({
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
            queryParams: of({ view: 'list' }),
            snapshot: {},
          },
        },
      ],
    }).compileComponents().then(() => {
      const fixture = TestBed.createComponent(SearchResultsComponent);
      const component = fixture.componentInstance;
      component.ngOnInit();

      expect(component.showMap()).toBe(false);
      expect(component.resolveImage(undefined)).toContain('svg+xml');

      const image = document.createElement('img');
      component.onImgError({ target: image } as unknown as Event);
      expect(image.src).toContain('svg+xml');

      component.fullscreenMap.set(true);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(component.fullscreenMap()).toBe(false);
    });
  });

  it('toggles fullscreen state and coordinates with the map component lifecycle hooks', () => {
    jest.useFakeTimers();
    const fixture = TestBed.createComponent(SearchResultsComponent);
    const component = fixture.componentInstance;
    const saveBounds = jest.fn();
    const invalidate = jest.fn();
    const restoreBounds = jest.fn();

    component.ngOnInit();
    Object.defineProperty(component, 'mapComponent', {
      value: { saveBounds, invalidate, restoreBounds },
      configurable: true,
    });

    component.toggleFullscreen();
    jest.advanceTimersByTime(350);
    expect(saveBounds).toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalledTimes(2);
    expect(component.fullscreenMap()).toBe(true);

    component.toggleFullscreen();
    jest.advanceTimersByTime(450);
    expect(restoreBounds).toHaveBeenCalled();
    expect(component.fullscreenMap()).toBe(false);
    jest.useRealTimers();
  });

  it('covers card and map selection helpers with and without a matching DOM card', () => {
    jest.useFakeTimers();
    const fixture = TestBed.createComponent(SearchResultsComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.selectRoom(roomsResponse.rooms[0] as never);
    expect(component.hoveredRoomId()).toBe(1);
    component.onCardHover(roomsResponse.rooms[1] as never);
    expect(component.hoveredRoomId()).toBe(2);
    component.onCardLeave();
    expect(component.hoveredRoomId()).toBeNull();

    const scrollIntoView = jest.fn();
    const classList = { add: jest.fn(), remove: jest.fn() };
    const querySelectorSpy = jest.spyOn(document, 'querySelector');
    querySelectorSpy.mockReturnValueOnce({
      scrollIntoView,
      classList,
    } as unknown as Element);

    component.onMapRoomSelected(roomsResponse.rooms[0] as never);
    jest.advanceTimersByTime(1300);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    expect(classList.add).toHaveBeenCalledWith('room-list-card--flash');
    expect(classList.remove).toHaveBeenCalledWith('room-list-card--flash');

    querySelectorSpy.mockReturnValueOnce(null);
    component.onMapRoomSelected(roomsResponse.rooms[1] as never);
    jest.advanceTimersByTime(100);

    jest.useRealTimers();
  });

  it('syncs guest filters including a zero-guest reset and falls back to window scrolling when no panel exists', () => {
    const fixture = TestBed.createComponent(SearchResultsComponent);
    const component = fixture.componentInstance;
    const applyFiltersSpy = jest.spyOn(component, 'applyFilters');
    const scrollSpy = jest.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    jest.spyOn(document, 'querySelector').mockReturnValue(null);

    component.ngOnInit();
    component.onGuestChange({ adults: 0, children: 0, infants: 1 });

    expect(component.draftFilters.guests).toBeUndefined();
    expect(component.draftFilters.infants).toBe(1);
    expect(applyFiltersSpy).toHaveBeenCalled();

    component.goToPage(2);
    expect(scrollSpy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('handles search API error by setting rooms to empty array and error flag to true', () => {
    // Mock AvailabilityService.getRoomsForSearch to throw so the loadRooms error handler fires
    const availabilityService = TestBed.inject(AvailabilityService);
    jest.spyOn(availabilityService, 'getRoomsForSearch').mockReturnValue(throwError(() => new Error('API Error')));

    const fixture = TestBed.createComponent(SearchResultsComponent);
    const component = fixture.componentInstance;

    // Call loadRooms directly which has an error handler that sets error(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (component as any).loadRooms();

    expect(component.error()).toBe(true);
    expect(component.rooms()).toEqual([]);
    expect(component.loading()).toBe(false);
  });

  it('reads stored map preference from localStorage with catch branch for thrown errors', async () => {
    const getItemSpy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('localStorage access denied');
    });

    TestBed.resetTestingModule();
    roomService = { getRooms: jest.fn().mockReturnValue(of(roomsResponse)) };
    wishlistService = {
      loadStatus: jest.fn().mockReturnValue(of({})),
      isSaved: jest.fn().mockReturnValue(false),
      toggle: jest.fn(),
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
            queryParams: of({ city: 'Paris' }),
            snapshot: {},
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(SearchResultsComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    // Should fall back to showing the map when localStorage throws
    expect(component.showMap()).toBe(true);
    expect(component.isMapCollapsed()).toBe(false);

    getItemSpy.mockRestore();
  });
});
