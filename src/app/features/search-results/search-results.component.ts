import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { RoomService } from '../../core/services/room.service';
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
          <button class="btn btn--secondary btn--sm" (click)="clearFilters()">Clear</button>
        </div>
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

  rooms = signal<Room[]>([]);
  loading = signal(true);
  error = signal(false);
  total = signal(0);
  page = signal(1);
  perPage = 9;

  filters: RoomSearchParams = {
    city: '',
    room_type: '',
    min_price: undefined,
    max_price: 2000,
    guests: 0,
    page: 1,
    per_page: 9,
  };

  totalPages = computed(() => Math.ceil(this.total() / this.perPage));

  pageNumbers = computed(() => {
    const pages: number[] = [];
    const total = Math.ceil(this.total() / this.perPage);
    for (let i = 1; i <= Math.min(total, 7); i++) pages.push(i);
    return pages;
  });

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.filters.city = params['city'] || '';
      this.filters.room_type = params['room_type'] || '';
      this.filters.guests = params['guests'] ? +params['guests'] : 0;
      this.loadRooms();
    });
  }

  applyFilters() {
    this.page.set(1);
    this.loadRooms();
  }

  clearFilters() {
    this.filters = { city: '', room_type: '', min_price: undefined, max_price: 2000, guests: 0, page: 1, per_page: 9 };
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
        this.rooms.set(res.rooms);
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

