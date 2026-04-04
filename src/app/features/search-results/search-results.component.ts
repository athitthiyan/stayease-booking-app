import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { RoomService } from '../../core/services/room.service';
import { WishlistService } from '../../core/services/wishlist.service';
import { AuthService } from '../../core/services/auth.service';
import { RoomCardComponent } from '../../shared/components/room-card/room-card.component';
import { Room, RoomSearchParams, RoomSortOption } from '../../core/models/room.model';
import { SearchMapPlaceholderComponent } from './search-map-placeholder.component';

type FilterKey =
  | 'query'
  | 'city'
  | 'landmark'
  | 'room_type'
  | 'price'
  | 'rating'
  | 'amenities'
  | 'guests'
  | 'sort';

interface SearchSuggestion {
  label: string;
  params: Partial<RoomSearchParams>;
}

interface ActiveFilterTag {
  key: FilterKey;
  label: string;
}

@Component({
  selector: 'app-search-results',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, RoomCardComponent, SearchMapPlaceholderComponent],
  template: `
    <div class="search-page">
      <div class="filter-bar">
        <div class="container filter-bar__inner">
          <div class="filter-bar__stack filter-bar__stack--wide">
            <label class="filter-label" for="queryInput">Search</label>
            <input
              id="queryInput"
              type="text"
              [(ngModel)]="draftFilters.query"
              placeholder="City, hotel, or family stay"
              class="form-control filter-bar__search"
              (keyup.enter)="applyFilters()"
            />
          </div>

          <div class="filter-bar__stack">
            <label class="filter-label" for="cityInput">Destination</label>
            <input
              id="cityInput"
              type="text"
              [(ngModel)]="draftFilters.city"
              placeholder="Chennai"
              class="form-control filter-bar__search"
              (keyup.enter)="applyFilters()"
            />
          </div>

          <div class="filter-bar__stack">
            <label class="filter-label" for="landmarkInput">Nearby</label>
            <input
              id="landmarkInput"
              type="text"
              [(ngModel)]="draftFilters.landmark"
              placeholder="Marina Beach"
              class="form-control filter-bar__search"
              (keyup.enter)="applyFilters()"
            />
          </div>

          <div class="filter-bar__stack filter-bar__stack--compact">
            <label class="filter-label" for="sortSelect">Sort</label>
            <select id="sortSelect" [(ngModel)]="draftFilters.sort_by" class="form-control filter-bar__select" (change)="applyFilters()">
              @for (option of sortOptions; track option.value) {
                <option [value]="option.value">{{ option.label }}</option>
              }
            </select>
          </div>

          <div class="filter-bar__stack filter-bar__stack--compact">
            <label class="filter-label" for="roomTypeSelect">Room Type</label>
            <select id="roomTypeSelect" [(ngModel)]="draftFilters.room_type" class="form-control filter-bar__select" (change)="applyFilters()">
              <option value="">All types</option>
              <option value="standard">Standard</option>
              <option value="deluxe">Deluxe</option>
              <option value="suite">Suite</option>
              <option value="penthouse">Penthouse</option>
            </select>
          </div>

          <div class="filter-bar__stack filter-bar__stack--compact">
            <label class="filter-label" for="guestsSelect">Guests</label>
            <select id="guestsSelect" [(ngModel)]="draftFilters.guests" class="form-control filter-bar__select" (change)="applyFilters()">
              <option [ngValue]="undefined">Any guests</option>
              <option [ngValue]="1">1 guest</option>
              <option [ngValue]="2">2 guests</option>
              <option [ngValue]="3">3 guests</option>
              <option [ngValue]="4">4+ guests</option>
            </select>
          </div>

          <div class="filter-bar__actions">
            <button class="btn btn--primary btn--sm" (click)="applyFilters()">Search</button>
            <button class="btn btn--ghost btn--sm" (click)="toggleAdvanced()">
              Filters {{ activeFilterTags().length ? '(' + activeFilterTags().length + ')' : '' }}
            </button>
            <button class="btn btn--secondary btn--sm" (click)="toggleMap()">{{ showMap() ? 'Hide Map' : 'Map View' }}</button>
            <button class="btn btn--secondary btn--sm" (click)="clearFilters()">Clear</button>
          </div>
        </div>

        <div class="container phrase-suggestions" aria-label="Search phrase suggestions">
          @for (suggestion of visibleSuggestions(); track suggestion.label) {
            <button type="button" class="phrase-chip" (click)="applySuggestion(suggestion)">
              {{ suggestion.label }}
            </button>
          }
        </div>

        @if (activeFilterTags().length) {
          <div class="container active-tags" aria-label="Active search filters">
            @for (tag of activeFilterTags(); track tag.label) {
              <button type="button" class="active-tag" (click)="removeFilter(tag.key)">
                {{ tag.label }} <span aria-hidden="true">×</span>
              </button>
            }
          </div>
        }

        @if (advancedOpen()) {
          <div class="container advanced-filters">
            <div class="adv-section">
              <label class="adv-label" for="minPriceRange">Min price</label>
              <input id="minPriceRange" type="range" [(ngModel)]="draftFilters.min_price" min="0" max="20000" step="500" />
              <span class="adv-value">₹{{ draftFilters.min_price || 0 }}</span>
            </div>

            <div class="adv-section">
              <label class="adv-label" for="maxPriceRange">Max price</label>
              <input id="maxPriceRange" type="range" [(ngModel)]="draftFilters.max_price" min="1000" max="30000" step="500" />
              <span class="adv-value">₹{{ draftFilters.max_price || 30000 }}</span>
            </div>

            <div class="adv-section">
              <label class="adv-label" for="minRatingSelect">Minimum rating</label>
              <select id="minRatingSelect" [(ngModel)]="draftFilters.min_rating" class="form-control filter-bar__select">
                <option [ngValue]="undefined">Any rating</option>
                <option [ngValue]="3">3+ stars</option>
                <option [ngValue]="3.5">3.5+ stars</option>
                <option [ngValue]="4">4+ stars</option>
                <option [ngValue]="4.5">4.5+ stars</option>
              </select>
            </div>

            <div class="adv-section adv-section--wide">
              <label class="adv-label">Amenity filters</label>
              <div class="amenity-chips">
                @for (amenity of amenityOptions; track amenity.value) {
                  <button
                    type="button"
                    class="chip"
                    [class.active]="selectedAmenities().includes(amenity.value)"
                    (click)="toggleAmenity(amenity.value)"
                  >
                    {{ amenity.icon }} {{ amenity.label }}
                  </button>
                }
              </div>
            </div>

            <div class="adv-actions">
              <button class="btn btn--primary btn--sm" (click)="applyFilters()">Apply Filters</button>
              <button class="btn btn--ghost btn--sm" (click)="toggleAdvanced()">Close</button>
            </div>
          </div>
        }
      </div>

      <div class="container results-wrapper">
        <div class="results-header">
          @if (!loading()) {
            <h1 class="results-title">
              {{ resultsHeading() }} <span>{{ resultsAccent() }}</span>
            </h1>
            <p class="results-count">{{ total() }} properties found · sorted by {{ currentSortLabel() }}</p>
          }
        </div>

        @if (showMap()) {
          @defer (when showMap()) {
            <app-search-map-placeholder [rooms]="rooms()" [cityLabel]="draftFilters.city || draftFilters.landmark || 'Flexible search area'" />
          } @placeholder {
            <div class="map-loading">Loading map architecture…</div>
          }
        }

        @if (loading()) {
          <div class="grid-rooms">
            @for (s of [1,2,3,4,5,6,7,8,9]; track s) {
              <div class="skeleton-card">
                <div class="skeleton" style="height:200px;border-radius:16px 16px 0 0"></div>
                <div style="padding:20px;display:flex;flex-direction:column;gap:10px">
                  <div class="skeleton" style="height:12px;width:50%"></div>
                  <div class="skeleton" style="height:20px;width:75%"></div>
                  <div class="skeleton" style="height:12px;width:35%"></div>
                </div>
              </div>
            }
          </div>
        } @else if (error()) {
          <div class="empty-state">
            <div class="empty-state__icon">⚠️</div>
            <h3>Unable to load rooms</h3>
            <p>We couldn't connect to the server. Please check your connection and try again.</p>
            <button class="btn btn--primary" (click)="loadRoomsPublic()">Retry</button>
          </div>
        } @else if (rooms().length === 0) {
          <div class="empty-state">
            <div class="empty-state__icon">🔍</div>
            <h3>No rooms found</h3>
            <p>Try adjusting your filters, remove a nearby landmark, or broaden the price range.</p>
            <button class="btn btn--ghost" (click)="clearFilters()">Clear Filters</button>
          </div>
        } @else {
          <div class="grid-rooms">
            @for (room of rooms(); track room.id) {
              <app-room-card [room]="room" />
            }
          </div>

          @if (totalPages() > 1) {
            <div class="pagination">
              <button class="btn btn--secondary btn--sm" [disabled]="page() === 1" (click)="goToPage(page() - 1)">← Prev</button>
              @for (p of pageNumbers(); track p) {
                <button
                  class="btn btn--sm"
                  [class.btn--primary]="p === page()"
                  [class.btn--secondary]="p !== page()"
                  (click)="goToPage(p)"
                >{{ p }}</button>
              }
              <button class="btn btn--secondary btn--sm" [disabled]="page() === totalPages()" (click)="goToPage(page() + 1)">Next →</button>
            </div>
          }
        }
      </div>
    </div>
  `,
  styleUrl: './search-results.component.scss',
})
export class SearchResultsComponent implements OnInit {
  private roomService = inject(RoomService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private wishlistService = inject(WishlistService);
  private authService = inject(AuthService);

  rooms = signal<Room[]>([]);
  loading = signal(true);
  error = signal(false);
  total = signal(0);
  page = signal(1);
  showMap = signal(false);
  advancedOpen = signal(false);
  readonly perPage = 9;

  readonly sortOptions: Array<{ value: RoomSortOption; label: string }> = [
    { value: 'recommended', label: 'Recommended' },
    { value: 'price_low_to_high', label: 'Price low to high' },
    { value: 'price_high_to_low', label: 'Price high to low' },
    { value: 'top_rated', label: 'Top rated' },
    { value: 'most_popular', label: 'Most popular' },
  ];

  readonly amenityOptions = [
    { value: 'WiFi', label: 'WiFi', icon: '📶' },
    { value: 'Pool', label: 'Pool', icon: '🏊' },
    { value: 'Breakfast', label: 'Breakfast', icon: '🍳' },
    { value: 'Parking', label: 'Parking', icon: '🚗' },
    { value: 'Spa', label: 'Spa', icon: '💆' },
    { value: 'Gym', label: 'Gym', icon: '🏋️' },
    { value: 'Family', label: 'Family room', icon: '👨‍👩‍👧‍👦' },
    { value: 'Kitchen', label: 'Kitchen', icon: '🍽️' },
  ];

  readonly searchSuggestions: SearchSuggestion[] = [
    { label: 'Chennai', params: { city: 'Chennai', sort_by: 'recommended' } },
    { label: 'Near Marina Beach', params: { city: 'Chennai', landmark: 'Marina Beach', sort_by: 'top_rated' } },
    { label: 'Under ₹3000', params: { max_price: 3000, sort_by: 'price_low_to_high' } },
    { label: 'Breakfast included', params: { amenities: 'Breakfast', sort_by: 'recommended' } },
    { label: 'Family room', params: { amenities: 'Family', guests: 4, sort_by: 'most_popular' } },
  ];

  draftFilters: RoomSearchParams = this.defaultFilters();

  readonly activeFilterTags = () => {
    const tags: ActiveFilterTag[] = [];
    const filters = this.draftFilters;

    if (filters.query) tags.push({ key: 'query', label: `Search: ${filters.query}` });
    if (filters.city) tags.push({ key: 'city', label: `City: ${filters.city}` });
    if (filters.landmark) tags.push({ key: 'landmark', label: `Nearby: ${filters.landmark}` });
    if (filters.room_type) tags.push({ key: 'room_type', label: `Type: ${filters.room_type}` });
    if (filters.min_price || filters.max_price) {
      tags.push({ key: 'price', label: `Price: ₹${filters.min_price || 0} - ₹${filters.max_price || 30000}` });
    }
    if (filters.min_rating) tags.push({ key: 'rating', label: `${filters.min_rating}+ stars` });
    if (this.selectedAmenities().length) tags.push({ key: 'amenities', label: `Amenities: ${this.selectedAmenities().join(', ')}` });
    if (filters.guests) tags.push({ key: 'guests', label: `${filters.guests}+ guests` });
    if (filters.sort_by && filters.sort_by !== 'recommended') tags.push({ key: 'sort', label: this.currentSortLabel() });

    return tags;
  };

  readonly visibleSuggestions = () => {
    const city = (this.draftFilters.city || this.draftFilters.query || '').toLowerCase();
    if (!city) {
      return this.searchSuggestions;
    }
    return this.searchSuggestions.filter(suggestion => suggestion.label.toLowerCase().includes(city)).slice(0, 5);
  };

  totalPages = computed(() => Math.ceil(this.total() / this.perPage));

  pageNumbers = computed(() => {
    const pages: number[] = [];
    const total = Math.ceil(this.total() / this.perPage);
    for (let i = 1; i <= Math.min(total, 7); i++) {
      pages.push(i);
    }
    return pages;
  });

  readonly resultsHeading = () => {
    if (this.draftFilters.city) return 'Stays in';
    if (this.draftFilters.landmark) return 'Nearby stays for';
    return 'Explore';
  };

  readonly resultsAccent = () =>
    this.draftFilters.city || this.draftFilters.landmark || this.draftFilters.query || 'curated results'
  ;

  ngOnInit(): void {
    if (this.authService.isLoggedIn) {
      this.wishlistService.loadStatus().subscribe();
    }

    this.route.queryParams.subscribe(params => {
      this.page.set(params['page'] ? +params['page'] : 1);
      this.showMap.set(params['view'] === 'map');
      this.draftFilters = {
        query: params['query'] || '',
        city: params['city'] || '',
        landmark: params['landmark'] || '',
        room_type: params['room_type'] || '',
        min_price: params['min_price'] ? +params['min_price'] : undefined,
        max_price: params['max_price'] ? +params['max_price'] : undefined,
        min_rating: params['min_rating'] ? +params['min_rating'] : undefined,
        amenities: params['amenities'] || '',
        guests: params['guests'] ? +params['guests'] : undefined,
        sort_by: this.normalizeSortValue(params['sort_by']),
        check_in: params['check_in'] || '',
        check_out: params['check_out'] || '',
        page: this.page(),
        per_page: this.perPage,
      };
      this.loadRooms();
    });
  }

  toggleAdvanced(): void {
    this.advancedOpen.update(current => !current);
  }

  toggleMap(): void {
    this.showMap.update(current => !current);
    this.syncQueryParams();
  }

  applySuggestion(suggestion: SearchSuggestion): void {
    this.draftFilters = {
      ...this.defaultFilters(),
      ...this.draftFilters,
      ...suggestion.params,
      page: 1,
      per_page: this.perPage,
    };
    this.applyFilters();
  }

  applyFilters(): void {
    if (
      this.draftFilters.min_price !== undefined &&
      this.draftFilters.max_price !== undefined &&
      this.draftFilters.min_price > this.draftFilters.max_price
    ) {
      const currentMin = this.draftFilters.min_price;
      this.draftFilters.min_price = this.draftFilters.max_price;
      this.draftFilters.max_price = currentMin;
    }
    this.page.set(1);
    this.syncQueryParams();
  }

  toggleAmenity(value: string): void {
    const current = new Set(this.selectedAmenities());
    if (current.has(value)) {
      current.delete(value);
    } else {
      current.add(value);
    }
    this.draftFilters = {
      ...this.draftFilters,
      amenities: [...current].join(','),
    };
  }

  removeFilter(key: FilterKey): void {
    switch (key) {
      case 'query':
      case 'city':
      case 'landmark':
      case 'room_type':
        this.draftFilters = { ...this.draftFilters, [key]: '' };
        break;
      case 'price':
        this.draftFilters = { ...this.draftFilters, min_price: undefined, max_price: undefined };
        break;
      case 'rating':
        this.draftFilters = { ...this.draftFilters, min_rating: undefined };
        break;
      case 'amenities':
        this.draftFilters = { ...this.draftFilters, amenities: '' };
        break;
      case 'guests':
        this.draftFilters = { ...this.draftFilters, guests: undefined };
        break;
      case 'sort':
        this.draftFilters = { ...this.draftFilters, sort_by: 'recommended' };
        break;
    }
    this.applyFilters();
  }

  clearFilters(): void {
    this.draftFilters = this.defaultFilters();
    this.page.set(1);
    this.showMap.set(false);
    this.syncQueryParams();
  }

  goToPage(pageNumber: number): void {
    this.page.set(pageNumber);
    this.syncQueryParams();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  loadRoomsPublic(): void {
    this.loadRooms();
  }

  currentSortLabel(): string {
    return this.sortOptions.find(option => option.value === this.draftFilters.sort_by)?.label || 'Recommended';
  }

  selectedAmenities(): string[] {
    return this.draftFilters.amenities
      ? this.draftFilters.amenities.split(',').map(value => value.trim()).filter(Boolean)
      : [];
  }

  private defaultFilters(): RoomSearchParams {
    return {
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
      per_page: this.perPage,
    };
  }

  private normalizeSortValue(raw: unknown): RoomSortOption {
    if (raw === 'price_low_to_high' || raw === 'price_asc') return 'price_low_to_high';
    if (raw === 'price_high_to_low' || raw === 'price_desc') return 'price_high_to_low';
    if (raw === 'top_rated' || raw === 'rating_desc') return 'top_rated';
    if (raw === 'most_popular' || raw === 'featured') return 'most_popular';
    return 'recommended';
  }

  private syncQueryParams(): void {
    const queryParams: Record<string, string | number> = {};
    const filters = this.draftFilters;

    if (filters.query) queryParams['query'] = filters.query;
    if (filters.city) queryParams['city'] = filters.city;
    if (filters.landmark) queryParams['landmark'] = filters.landmark;
    if (filters.room_type) queryParams['room_type'] = filters.room_type;
    if (filters.min_price !== undefined) queryParams['min_price'] = filters.min_price;
    if (filters.max_price !== undefined) queryParams['max_price'] = filters.max_price;
    if (filters.min_rating !== undefined) queryParams['min_rating'] = filters.min_rating;
    if (filters.amenities) queryParams['amenities'] = filters.amenities;
    if (filters.guests !== undefined) queryParams['guests'] = filters.guests;
    if (filters.sort_by && filters.sort_by !== 'recommended') queryParams['sort_by'] = filters.sort_by;
    if (filters.check_in) queryParams['check_in'] = filters.check_in;
    if (filters.check_out) queryParams['check_out'] = filters.check_out;
    if (this.page() > 1) queryParams['page'] = this.page();
    if (this.showMap()) queryParams['view'] = 'map';

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      replaceUrl: true,
    });
  }

  private loadRooms(): void {
    this.loading.set(true);
    this.error.set(false);

    const params: RoomSearchParams = {
      ...this.draftFilters,
      sort_by: this.draftFilters.sort_by || 'recommended',
      page: this.page(),
      per_page: this.perPage,
    };

    this.roomService.getRooms(params).subscribe({
      next: response => {
        this.rooms.set(response.rooms);
        this.total.set(response.total);
        this.error.set(false);
        this.loading.set(false);
      },
      error: () => {
        this.rooms.set([]);
        this.total.set(0);
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }
}
