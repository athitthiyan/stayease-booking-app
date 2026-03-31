import { Component, OnInit, inject, signal } from '@angular/core';
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
  styles: [`
    .search-page {
      padding-top: 80px;
      min-height: 100vh;
    }

    .filter-bar {
      position: sticky;
      top: 72px;
      z-index: var(--z-raised);
      background: rgba(8, 13, 26, 0.95);
      backdrop-filter: blur(24px);
      border-bottom: 1px solid var(--color-border);
      padding: 12px 0;

      &__inner {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }

      &__search {
        flex: 1;
        min-width: 180px;
        padding: 10px 16px !important;
      }

      &__select {
        flex: 0 1 160px;
        padding: 10px 16px !important;
      }

      &__price {
        display: flex;
        flex-direction: column;
        gap: 4px;
        flex: 0 1 200px;

        &-label {
          font-size: 11px;
          color: var(--color-text-muted);
          font-weight: 600;
        }

        input[type=range] {
          width: 100%;
          accent-color: var(--color-primary);
        }
      }
    }

    .results-wrapper {
      padding-top: var(--space-3xl);
      padding-bottom: var(--space-4xl);
    }

    .results-header {
      margin-bottom: var(--space-3xl);
    }

    .results-title {
      font-family: var(--font-serif);
      font-size: 2rem;
      color: var(--color-text);
      span { color: var(--color-primary); }
    }

    .results-count {
      font-size: 14px;
      color: var(--color-text-muted);
      margin-top: 6px;
    }

    .empty-state {
      text-align: center;
      padding: var(--space-4xl) 0;

      &__icon { font-size: 4rem; margin-bottom: var(--space-lg); }
      h3 { font-size: 1.5rem; color: var(--color-text); margin-bottom: var(--space-sm); }
      p { color: var(--color-text-muted); margin-bottom: var(--space-xl); }
    }

    .pagination {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 8px;
      margin-top: var(--space-3xl);
      flex-wrap: wrap;
    }
  `],
})
export class SearchResultsComponent implements OnInit {
  private roomService = inject(RoomService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  rooms = signal<Room[]>([]);
  loading = signal(true);
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

  get totalPages() {
    return signal(Math.ceil(this.total() / this.perPage));
  }

  get pageNumbers() {
    const pages: number[] = [];
    const total = Math.ceil(this.total() / this.perPage);
    for (let i = 1; i <= Math.min(total, 7); i++) pages.push(i);
    return signal(pages);
  }

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

  private loadRooms() {
    this.loading.set(true);
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
        this.loading.set(false);
      },
      error: () => {
        this.rooms.set(this.getMockRooms());
        this.total.set(6);
        this.loading.set(false);
      },
    });
  }

  private getMockRooms(): Room[] {
    return [
      { id:1, hotel_name:'The Grand Azure', room_type:'penthouse', price:850, original_price:1200, availability:true, rating:4.9, review_count:284, image_url:'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800', location:'Manhattan, New York', city:'New York', country:'USA', max_guests:4, beds:2, bathrooms:3, size_sqft:2800, floor:52, is_featured:true, created_at:'', amenities:'["King Bed","Private Terrace","Jacuzzi","Butler Service","Minibar","Smart TV","WiFi","City View"]', gallery_urls:'' },
      { id:2, hotel_name:'Serenity Beach Resort', room_type:'suite', price:420, original_price:580, availability:true, rating:4.8, review_count:512, image_url:'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800', location:'Bali, Indonesia', city:'Bali', country:'Indonesia', max_guests:2, beds:1, bathrooms:2, size_sqft:1200, floor:3, is_featured:true, created_at:'', amenities:'["Ocean View","Infinity Pool","Spa Access","King Bed","WiFi"]', gallery_urls:'' },
      { id:3, hotel_name:'Alpine Summit Lodge', room_type:'deluxe', price:280, original_price:350, availability:true, rating:4.7, review_count:198, image_url:'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800', location:'Zermatt, Switzerland', city:'Zermatt', country:'Switzerland', max_guests:2, beds:1, bathrooms:1, size_sqft:650, floor:2, is_featured:true, created_at:'', amenities:'["Fireplace","Mountain View","Ski-in/Ski-out","Hot Tub","WiFi"]', gallery_urls:'' },
      { id:4, hotel_name:'Kyoto Garden Inn', room_type:'suite', price:310, availability:true, rating:4.9, review_count:445, image_url:'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=800', location:'Gion District, Kyoto', city:'Kyoto', country:'Japan', max_guests:2, beds:1, bathrooms:1, size_sqft:900, floor:1, is_featured:true, created_at:'', amenities:'', gallery_urls:'' },
      { id:5, hotel_name:'Metropolis Business', room_type:'deluxe', price:195, original_price:240, availability:true, rating:4.6, review_count:820, image_url:'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=800', location:'City Centre, London', city:'London', country:'UK', max_guests:2, beds:1, bathrooms:1, size_sqft:480, floor:15, is_featured:false, created_at:'', amenities:'', gallery_urls:'' },
      { id:6, hotel_name:'Desert Mirage Palace', room_type:'suite', price:520, availability:true, rating:4.8, review_count:167, image_url:'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800', location:'Dubai, UAE', city:'Dubai', country:'UAE', max_guests:2, beds:1, bathrooms:2, size_sqft:1800, floor:5, is_featured:true, created_at:'', amenities:'', gallery_urls:'' },
    ];
  }
}
