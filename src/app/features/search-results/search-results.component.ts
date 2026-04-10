import { Component, DestroyRef, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { RoomService } from '../../core/services/room.service';
import { WishlistService } from '../../core/services/wishlist.service';
import { AuthService } from '../../core/services/auth.service';
import { BookingSearchStore } from '../../core/services/booking-search.store';
import { RoomCardComponent } from '../../shared/components/room-card/room-card.component';
import { Room, RoomSearchParams, RoomSortOption } from '../../core/models/room.model';
import { GuestPickerComponent, GuestSelection } from '../../shared/components/guest-picker/guest-picker.component';
import { DateRangePickerComponent } from '../../shared/components/date-range-picker/date-range-picker.component';
import { SearchMapComponent } from './search-map.component';
import { AvailabilityService } from '../../core/services/availability.service';
import {
  ROOM_IMAGE_PLACEHOLDER,
  normalizeRoomImageUrl,
} from '../../shared/utils/image-fallback';
import { switchMap, tap } from 'rxjs/operators';

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
  imports: [CommonModule, RouterLink, FormsModule, RoomCardComponent, GuestPickerComponent, DateRangePickerComponent, SearchMapComponent],
  template: `
    <div class="search-page" [class.search-page--fullscreen]="fullscreenMap()">
      <!-- Filter Bar -->
      <div class="filter-bar">
        <div class="container filter-bar__inner">
          <div class="filter-bar__primary">
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

            <div class="filter-bar__stack filter-bar__stack--dates">
              <span class="filter-label" id="search-dates-picker-label">Dates</span>
              <app-date-range-picker
                id="search-dates-picker"
                aria-labelledby="search-dates-picker-label"
                [checkIn]="draftFilters.check_in || ''"
                [checkOut]="draftFilters.check_out || ''"
                (dateChange)="onDateChange($event)"
              />
            </div>

            <div class="filter-bar__stack filter-bar__stack--guests">
              <span class="filter-label" id="search-guests-picker-label">Guests</span>
              <app-guest-picker
                id="search-guests-picker"
                aria-labelledby="search-guests-picker-label"
                [compact]="true"
                [value]="guestSelection"
                (valueChange)="onGuestChange($event)"
              />
            </div>

            <button class="btn btn--primary btn--sm filter-bar__search-btn" (click)="applyFilters()">Search</button>
          </div>

          <div class="filter-bar__secondary">
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

            <div class="filter-bar__actions">
              <button class="btn btn--ghost btn--sm" (click)="toggleAdvanced()">
                Filters {{ activeFilterTags().length ? '(' + activeFilterTags().length + ')' : '' }}
              </button>
              <button class="btn btn--secondary btn--sm" (click)="toggleMap()">
                {{ showMap() ? 'Hide Map' : 'Show Map' }}
              </button>
              <button class="btn btn--secondary btn--sm" (click)="clearFilters()">Clear</button>
            </div>
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
              <div class="adv-label">Amenity filters</div>
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

      <!-- ═══ SPLIT-SCREEN LAYOUT ═══ -->
      <div
        class="explore-layout"
        [class.explore-layout--split]="showMap()"
        [class.explore-layout--fullscreen]="fullscreenMap()"
        [class.map-collapsed]="isMapCollapsed()"
      >

        <!-- Left Panel: Room List -->
        <section class="explore-panel hotel-results-panel" [class.explore-panel--hidden]="fullscreenMap()">
          <div class="explore-panel__header">
            @if (!loading()) {
              <h1 class="results-title">
                {{ resultsHeading() }} <span>{{ resultsAccent() }}</span>
              </h1>
              <p class="results-count">
                {{ total() }} properties found · sorted by {{ currentSortLabel() }}
                @if (searchStore.dateRangeText()) {
                  · <span class="results-dates">{{ searchStore.dateRangeText() }}</span>
                }
              </p>
            }
          </div>

          <div class="explore-panel__scroll">
            @if (loading()) {
              <div class="room-list">
                @for (s of [1,2,3,4,5,6]; track s) {
                  <div class="room-list-card room-list-card--skeleton">
                    <div class="skeleton" style="width:140px;height:100%;border-radius:12px 0 0 12px"></div>
                    <div style="flex:1;padding:16px;display:flex;flex-direction:column;gap:8px">
                      <div class="skeleton" style="height:10px;width:40%"></div>
                      <div class="skeleton" style="height:16px;width:70%"></div>
                      <div class="skeleton" style="height:10px;width:55%"></div>
                      <div style="margin-top:auto"><div class="skeleton" style="height:14px;width:30%"></div></div>
                    </div>
                  </div>
                }
              </div>
            } @else if (error()) {
              <div class="empty-state">
                <div class="empty-state__icon">⚠</div>
                <h3>Unable to load rooms</h3>
                <p>We couldn't connect to the server. Please check your connection and try again.</p>
                <button class="btn btn--primary btn--sm" (click)="loadRoomsPublic()">Retry</button>
              </div>
            } @else if (rooms().length === 0) {
              <div class="empty-state">
                <div class="empty-state__icon">🔍</div>
                <h3>No rooms found</h3>
                <p>Try adjusting your filters, remove a nearby landmark, or broaden the price range.</p>
                <button class="btn btn--ghost btn--sm" (click)="clearFilters()">Clear Filters</button>
              </div>
            } @else {
              <!-- Split view: horizontal list cards -->
              @if (showMap()) {
                <div class="room-list">
                  @for (room of rooms(); track room.id) {
                    <button
                      type="button"
                      class="room-list-card"
                      [attr.data-room-id]="room.id"
                      [class.room-list-card--active]="hoveredRoomId() === room.id"
                      (click)="selectRoom(room)"
                      (mouseenter)="onCardHover(room)"
                      (mouseleave)="onCardLeave()"
                    >
                      <img
                        class="room-list-card__img"
                        [src]="resolveImage(room.image_url)"
                        [alt]="room.hotel_name"
                        loading="lazy"
                        (error)="onImgError($event)"
                      />
                      <div class="room-list-card__body">
                        <span class="room-list-card__type">{{ room.room_type | titlecase }}</span>
                        <h4 class="room-list-card__name">{{ room.hotel_name }}</h4>
                        <p class="room-list-card__location">{{ room.location || room.city }}</p>
                        <div class="room-list-card__meta">
                          <span class="room-list-card__rating">{{ room.rating }} ★</span>
                          @if (room.review_count) {
                            <span class="room-list-card__reviews">({{ room.review_count }})</span>
                          }
                          <span class="room-list-card__beds">{{ room.beds }} bed · {{ room.bathrooms }} bath</span>
                        </div>
                        <div class="room-list-card__footer">
                          <span class="room-list-card__price">
                            @if (room.original_price) {
                              <small class="room-list-card__price-old">₹{{ room.original_price }}</small>
                            }
                            ₹{{ room.price }}<small>/night</small>
                          </span>
                          <a class="room-list-card__cta" [routerLink]="['/rooms', room.id]" (click)="$event.stopPropagation()">View</a>
                        </div>
                        @if (room.is_featured) {
                          <span class="room-list-card__featured">Featured</span>
                        }
                      </div>
                    </button>
                  }
                </div>
              } @else {
                <!-- Grid view: standard room cards -->
                <div class="grid-rooms">
                  @for (room of rooms(); track room.id) {
                    <app-room-card [room]="room" />
                  }
                </div>
              }

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
        </section>

        <!-- Right Panel: Map (always visible in split mode) -->
        @if (showMap()) {
          <aside class="explore-map map-panel" [class.explore-map--fullscreen]="fullscreenMap()">
            @defer (when showMap()) {
              <app-search-map
                [rooms]="rooms()"
                [hoveredRoomId]="hoveredRoomId()"
                [cityLabel]="draftFilters.city || draftFilters.landmark || 'Flexible search area'"
                (roomSelected)="onMapRoomSelected($event)"
              />
            } @placeholder {
              <div class="map-loading">
                <div class="map-loading__spinner"></div>
                <span>Loading map…</span>
              </div>
            }

            <!-- Fullscreen toggle -->
            <button
              type="button"
              class="map-fullscreen-btn"
              (click)="toggleFullscreen()"
              [attr.aria-label]="fullscreenMap() ? 'Exit fullscreen' : 'Fullscreen map'"
            >
              {{ fullscreenMap() ? '⊟' : '⊞' }}
              <span>{{ fullscreenMap() ? 'Exit Fullscreen' : 'Fullscreen' }}</span>
            </button>
          </aside>
        }
      </div>
    </div>
  `,
  styleUrl: './search-results.component.scss',
})
export class SearchResultsComponent implements OnInit {
  private static readonly MAP_PREFERENCE_KEY = 'stayvora_explore_map_collapsed';

  @ViewChild(SearchMapComponent) private mapComponent?: SearchMapComponent;

  private roomService = inject(RoomService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private wishlistService = inject(WishlistService);
  private authService = inject(AuthService);
  protected searchStore = inject(BookingSearchStore);
  private availabilityService = inject(AvailabilityService);
  private destroyRef = inject(DestroyRef);

  rooms = signal<Room[]>([]);
  loading = signal(true);
  error = signal(false);
  total = signal(0);
  page = signal(1);
  showMap = signal(true);
  fullscreenMap = signal(false);
  advancedOpen = signal(false);
  hoveredRoomId = signal<number | null>(null);
  readonly perPage = 12;

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
  guestSelection: GuestSelection = { adults: 2, children: 0, infants: 0 };

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
    if (filters.guests) {
      const parts: string[] = [];
      if (filters.adults) parts.push(`${filters.adults} Adult${filters.adults !== 1 ? 's' : ''}`);
      if (filters.children) parts.push(`${filters.children} Child${filters.children !== 1 ? 'ren' : ''}`);
      if (filters.infants) parts.push(`${filters.infants} Infant${filters.infants !== 1 ? 's' : ''}`);
      tags.push({ key: 'guests', label: parts.length ? parts.join(', ') : `${filters.guests} guests` });
    }
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

  readonly isMapCollapsed = computed(() => !this.showMap());

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

  resolveImage(url?: string): string {
    return normalizeRoomImageUrl(url) || ROOM_IMAGE_PLACEHOLDER;
  }

  onImgError(event: Event): void {
    (event.target as HTMLImageElement).src = ROOM_IMAGE_PLACEHOLDER;
  }

  ngOnInit(): void {
    if (this.authService.isLoggedIn) {
      this.wishlistService.loadStatus().subscribe();
    }

    const storedMapPreference = this.readStoredMapPreference();
    if (storedMapPreference !== null) {
      this.showMap.set(!storedMapPreference);
    }

    this.route.queryParams.pipe(
      tap(params => {
        const searchState = this.searchStore.state();
        this.page.set(params['page'] ? +params['page'] : 1);
        if (params['view'] === 'list') {
          this.showMap.set(false);
          this.persistMapPreference(true);
        } else if (params['view'] === 'map') {
          this.showMap.set(true);
          this.persistMapPreference(false);
        } else if (storedMapPreference !== null) {
          this.showMap.set(!storedMapPreference);
        }

        const adults = params['adults'] ? +params['adults'] : searchState.adults || undefined;
        const children = params['children'] ? +params['children'] : searchState.children || undefined;
        const infants = params['infants'] ? +params['infants'] : searchState.infants || undefined;
        const guests = params['guests'] ? +params['guests'] : (adults !== undefined ? (adults + (children || 0)) : undefined);

        this.draftFilters = {
          query: params['query'] || '',
          city: params['city'] || searchState.destination || '',
          landmark: params['landmark'] || '',
          room_type: params['room_type'] || '',
          min_price: params['min_price'] ? +params['min_price'] : undefined,
          max_price: params['max_price'] ? +params['max_price'] : undefined,
          min_rating: params['min_rating'] ? +params['min_rating'] : undefined,
          amenities: params['amenities'] || '',
          guests,
          adults,
          children,
          infants,
          sort_by: this.normalizeSortValue(params['sort_by']),
          check_in: params['check_in'] || '',
          check_out: params['check_out'] || '',
          page: this.page(),
          per_page: this.perPage,
        };
        this.guestSelection = {
          adults: adults || 2,
          children: children || 0,
          infants: infants || 0,
        };
        this.syncSearchStore();
        this.loading.set(true);
        this.error.set(false);
      }),
      switchMap(() => this.availabilityService.getRoomsForSearch({
        ...this.draftFilters,
        sort_by: this.draftFilters.sort_by || 'recommended',
        page: this.page(),
        per_page: this.perPage,
      })),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(response => {
      this.rooms.set(response.rooms);
      this.total.set(response.total);
      this.error.set(false);
      this.loading.set(false);
    });

    // ESC exits fullscreen map
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape' && this.fullscreenMap()) {
        this.fullscreenMap.set(false);
      }
    });
  }

  toggleAdvanced(): void {
    this.advancedOpen.update(current => !current);
  }

  toggleMap(): void {
    this.showMap.update(current => !current);
    this.persistMapPreference(!this.showMap());
    if (!this.showMap()) {
      this.fullscreenMap.set(false);
    }
    this.syncQueryParams();
  }

  toggleFullscreen(): void {
    if (!this.fullscreenMap()) {
      // Entering fullscreen — save current bounds
      this.mapComponent?.saveBounds();
    }
    this.fullscreenMap.update(v => !v);
    // CRITICAL: invalidate map size after fullscreen toggle
    this.mapComponent?.invalidate();
    setTimeout(() => {
      this.mapComponent?.invalidate();
      window.dispatchEvent(new Event('resize'));
    }, 300);
    if (this.fullscreenMap()) {
      // Exiting fullscreen — restore bounds after animation
      setTimeout(() => this.mapComponent?.restoreBounds(), 400);
    }
  }

  /** Card clicked → zoom marker + open popup */
  selectRoom(room: Room): void {
    this.hoveredRoomId.set(room.id);
  }

  /** Card hovered → glow the marker on map */
  onCardHover(room: Room): void {
    this.hoveredRoomId.set(room.id);
  }

  /** Card unhovered → reset marker */
  onCardLeave(): void {
    this.hoveredRoomId.set(null);
  }

  /** Marker clicked → highlight card + auto-scroll sidebar */
  onMapRoomSelected(room: Room): void {
    this.hoveredRoomId.set(room.id);
    // Scroll room card into view in the left panel using data-room-id
    setTimeout(() => {
      const el = document.querySelector(`[data-room-id="${room.id}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Add brief flash animation
        el.classList.add('room-list-card--flash');
        setTimeout(() => el.classList.remove('room-list-card--flash'), 1200);
      }
    }, 50);
  }

  onGuestChange(selection: GuestSelection): void {
    this.guestSelection = selection;
    const totalGuests = selection.adults + selection.children;
    this.draftFilters = {
      ...this.draftFilters,
      guests: totalGuests || undefined,
      adults: selection.adults,
      children: selection.children,
      infants: selection.infants,
    };
    this.applyFilters();
  }

  onDateChange(selection: { checkIn: string; checkOut: string }): void {
    this.draftFilters = {
      ...this.draftFilters,
      check_in: selection.checkIn,
      check_out: selection.checkOut,
    };
    this.applyFilters();
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
    this.syncSearchStore();
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
        this.draftFilters = { ...this.draftFilters, guests: undefined, adults: undefined, children: undefined, infants: undefined };
        this.guestSelection = { adults: 2, children: 0, infants: 0 };
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
    this.syncSearchStore();
    this.syncQueryParams();
  }

  goToPage(pageNumber: number): void {
    this.page.set(pageNumber);
    this.syncQueryParams();
    // Scroll to top of room list panel
    const panel = document.querySelector('.explore-panel__scroll');
    if (panel) {
      panel.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  loadRoomsPublic(): void {
    this.loadRooms();
  }

  currentSortLabel(): string {
    return this.sortOptions.find(option => option.value === this.draftFilters.sort_by)?.label || 'Recommended';
  }

  selectedAmenities(): string[] {
    return this.draftFilters.amenities
      ? this.draftFilters.amenities.split(',').map((value: string) => value.trim()).filter(Boolean)
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
    if (filters.adults !== undefined) queryParams['adults'] = filters.adults;
    if (filters.children !== undefined && filters.children > 0) queryParams['children'] = filters.children;
    if (filters.infants !== undefined && filters.infants > 0) queryParams['infants'] = filters.infants;
    if (filters.sort_by && filters.sort_by !== 'recommended') queryParams['sort_by'] = filters.sort_by;
    if (filters.check_in) queryParams['check_in'] = filters.check_in;
    if (filters.check_out) queryParams['check_out'] = filters.check_out;
    if (this.page() > 1) queryParams['page'] = this.page();
    if (!this.showMap()) queryParams['view'] = 'list';

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      replaceUrl: true,
    });
  }

  private syncSearchStore(): void {
    this.searchStore.patchState({
      destination: this.draftFilters.city || '',
      checkIn: this.draftFilters.check_in || '',
      checkOut: this.draftFilters.check_out || '',
      adults: this.draftFilters.adults ?? this.guestSelection.adults,
      children: this.draftFilters.children ?? this.guestSelection.children,
      infants: this.draftFilters.infants ?? this.guestSelection.infants,
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

    this.availabilityService.getRoomsForSearch(params).subscribe({
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

  private readStoredMapPreference(): boolean | null {
    try {
      const raw = globalThis.localStorage?.getItem(SearchResultsComponent.MAP_PREFERENCE_KEY);
      if (raw === 'true') return true;
      if (raw === 'false') return false;
      return null;
    } catch {
      return null;
    }
  }

  private persistMapPreference(collapsed: boolean): void {
    try {
      globalThis.localStorage?.setItem(SearchResultsComponent.MAP_PREFERENCE_KEY, String(collapsed));
    } catch {
      // Ignore storage failures so search UX still works in restricted environments.
    }
  }
}
