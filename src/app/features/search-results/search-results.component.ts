import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { RoomService } from '../../core/services/room.service';
import { WishlistService } from '../../core/services/wishlist.service';
import { AuthService } from '../../core/services/auth.service';
import { RoomCardComponent } from '../../shared/components/room-card/room-card.component';
import { Room, RoomSearchParams } from '../../core/models/room.model';

@Component({
  selector: 'app-search-results',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, RoomCardComponent],
  template: `
    <div class="search-page">

      <!-- Sticky Filter Bar -->
      <div class="filter-bar">
        <div class="container filter-bar__inner">
          <input type="text" [(ngModel)]="filters.city" placeholder="🔍 City or destination" class="form-control filter-bar__search" (keyup.enter)="applyFilters()" />

          <select [(ngModel)]="filters.room_type" class="form-control filter-bar__select" (change)="applyFilters()">
            <option value="">All Types</option>
            <option value="standard">Standard</option>
            <option value="deluxe">Deluxe</option>
            <option value="suite">Suite</option>
            <option value="penthouse">Penthouse</option>
          </select>

          <div class="filter-bar__price">
            <span class="filter-bar__price-label">Price: \${{ filters.min_price || 0 }} – \${{ filters.max_price || 2000 }}+</span>
            <input type="range" [(ngModel)]="filters.max_price" min="50" max="2000" step="50" (change)="applyFilters()" />
          </div>

          <select [(ngModel)]="filters.guests" class="form-control filter-bar__select" (change)="applyFilters()">
            <option [value]="0">Any Guests</option>
            <option [value]="1">1 Guest</option>
            <option [value]="2">2 Guests</option>
            <option [value]="3">3 Guests</option>
            <option [value]="4">4+ Guests</option>
          </select>

          <button class="btn btn--primary btn--sm" (click)="applyFilters()">Search</button>
          <button class="btn btn--ghost btn--sm" (click)="toggleAdvanced()">
            ⚙️ Filters {{ activeFilterCount() > 0 ? '(' + activeFilterCount() + ')' : '' }}
          </button>
          <button class="btn btn--secondary btn--sm" (click)="clearFilters()">Clear</button>
        </div>

        <!-- Advanced Filters Panel -->
        @if (advancedOpen()) {
          <div class="container advanced-filters" (click)="$event.stopPropagation()">
            <div class="adv-section">
              <label class="adv-label">Min rating: {{ advFilters.minRating }}⭐</label>
              <input type="range" [(ngModel)]="advFilters.minRating" min="1" max="5" step="0.5" />
            </div>

            <div class="adv-section">
              <label class="adv-label">Min price: {{ '$' + advFilters.minPrice }}</label>
              <input type="range" [(ngModel)]="advFilters.minPrice" min="0" max="1000" step="10" />
            </div>

            <div class="adv-section">
              <label class="adv-label">Amenities</label>
              <div class="amenity-chips">
                @for (amenity of amenityOptions; track amenity.value) {
                  <label class="chip" [class.active]="advFilters.amenities.has(amenity.value)">
                    <input
                      type="checkbox"
                      [checked]="advFilters.amenities.has(amenity.value)"
                      (change)="toggleAmenity(amenity.value)"
                    />
                    {{ amenity.icon }} {{ amenity.label }}
                  </label>
                }
              </div>
            </div>

            <div class="adv-section adv-toggles">
              <label class="toggle-label">
                <input type="checkbox" [(ngModel)]="advFilters.featuredOnly" />
                ⭐ Featured only
              </label>
            </div>

            <button class="btn btn--primary btn--sm" (click)="applyAdvanced()">Apply Filters</button>
          </div>
        }
      </div>

      <!-- Results -->
      <div class="container results-wrapper">
        <div class="results-header">
          @if (!loading()) {
            <h1 class="results-title">
              @if (filters.city) {
                Rooms in <span>{{ filters.city }}</span>
              } @else {
                All Available <span>Rooms</span>
              }
            </h1>
            <p class="results-count">{{ total() }} properties found</p>
          }
        </div>

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
            <p>Try adjusting your filters or explore a different destination.</p>
            <button class="btn btn--ghost" (click)="clearFilters()">Clear Filters</button>
          </div>
        } @else {
          <div class="grid-rooms">
            @for (room of rooms(); track room.id) {
              <app-room-card [room]="room" />
            }
          </div>

          <!-- Pagination -->
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
  perPage = 9;
  advancedOpen = signal(false);

  filters: RoomSearchParams = {
    city: '',
    room_type: '',
    min_price: undefined,
    max_price: 2000,
    guests: 0,
    page: 1,
    per_page: 9,
  };

  advFilters = {
    minRating: 0,
    minPrice: 0,
    amenities: new Set<string>(),
    featuredOnly: false,
  };

  readonly amenityOptions = [
    { value: 'WiFi', label: 'WiFi', icon: '📶' },
    { value: 'Pool', label: 'Pool', icon: '🏊' },
    { value: 'Breakfast Included', label: 'Breakfast', icon: '🍳' },
    { value: 'Parking', label: 'Parking', icon: '🚗' },
    { value: 'Spa', label: 'Spa', icon: '💆' },
    { value: 'Gym', label: 'Gym', icon: '🏋️' },
    { value: 'Pet Friendly', label: 'Pets OK', icon: '🐾' },
    { value: 'Kitchen', label: 'Kitchen', icon: '🍳' },
  ];

  activeFilterCount = computed(() => {
    let count = 0;
    if (this.advFilters.minRating > 0) count++;
    if (this.advFilters.minPrice > 0) count++;
    if (this.advFilters.amenities.size > 0) count += this.advFilters.amenities.size;
    if (this.advFilters.featuredOnly) count++;
    return count;
  });

  totalPages = computed(() => Math.ceil(this.total() / this.perPage));

  pageNumbers = computed(() => {
    const pages: number[] = [];
    const total = Math.ceil(this.total() / this.perPage);
    for (let i = 1; i <= Math.min(total, 7); i++) pages.push(i);
    return pages;
  });

  ngOnInit(): void {
    if (this.authService.isLoggedIn) {
      this.wishlistService.loadStatus().subscribe();
    }
    this.route.queryParams.subscribe(params => {
      this.filters.city = params['city'] || '';
      this.filters.room_type = params['room_type'] || '';
      this.filters.guests = params['guests'] ? +params['guests'] : 0;
      this.loadRooms();
    });
  }

  toggleAdvanced(): void {
    this.advancedOpen.update(v => !v);
  }

  applyFilters(): void {
    this.page.set(1);
    this.loadRooms();
  }

  applyAdvanced(): void {
    this.advancedOpen.set(false);
    this.filters.min_price = this.advFilters.minPrice > 0 ? this.advFilters.minPrice : undefined;
    this.page.set(1);
    this.loadRooms();
  }

  toggleAmenity(value: string): void {
    const amenities = new Set(this.advFilters.amenities);
    if (amenities.has(value)) {
      amenities.delete(value);
    } else {
      amenities.add(value);
    }
    this.advFilters = { ...this.advFilters, amenities };
  }

  clearFilters(): void {
    this.filters = { city: '', room_type: '', min_price: undefined, max_price: 2000, guests: 0, page: 1, per_page: 9 };
    this.advFilters = { minRating: 0, minPrice: 0, amenities: new Set<string>(), featuredOnly: false };
    this.loadRooms();
  }

  goToPage(p: number) {
    this.page.set(p);
    this.loadRooms();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  loadRoomsPublic() {
    this.loadRooms();
  }

  private loadRooms() {
    this.loading.set(true);
    this.error.set(false);
    const params: RoomSearchParams = {
      ...this.filters,
      page: this.page(),
      per_page: this.perPage,
    };
    if (!params.city) delete params.city;
    if (!params.room_type) delete params.room_type;
    if (!params.guests || params.guests === 0) delete params.guests;
    if (!params.max_price || params.max_price >= 2000) delete params.max_price;

    this.roomService.getRooms(params).subscribe({
      next: res => {
        let filtered = res.rooms;
        if (this.advFilters.minRating > 0) {
          filtered = filtered.filter(r => r.rating >= this.advFilters.minRating);
        }
        if (this.advFilters.featuredOnly) {
          filtered = filtered.filter(r => r.is_featured);
        }
        if (this.advFilters.amenities.size > 0) {
          filtered = filtered.filter(r => {
            try {
              const roomAmenities: string[] = JSON.parse(r.amenities ?? '[]');
              return [...this.advFilters.amenities].every(a =>
                roomAmenities.some(ra => ra.toLowerCase().includes(a.toLowerCase()))
              );
            } catch {
              return false;
            }
          });
        }
        this.rooms.set(filtered);
        this.total.set(res.total);
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

