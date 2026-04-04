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
