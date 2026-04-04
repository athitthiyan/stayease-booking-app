import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { WishlistService } from '../../core/services/wishlist.service';
import { WishlistItemResponse } from '../../core/models/wishlist.model';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';
import { FooterComponent } from '../../shared/components/footer/footer.component';

@Component({
  selector: 'app-wishlist',
  standalone: true,
  imports: [CommonModule, RouterLink, NavbarComponent, FooterComponent],
  template: `
    <app-navbar />

    <main class="wishlist-page container">
      <div class="wishlist-header">
        <h1>Saved Stays</h1>
        @if (!loading() && items().length > 0) {
          <p class="subtitle">{{ items().length }} {{ items().length === 1 ? 'property' : 'properties' }} saved</p>
        }
      </div>

      @if (loading()) {
        <div class="state-loading">
          <div class="spinner"></div>
          <p>Loading your saved stays…</p>
        </div>
      }

      @if (!loading() && errorMsg()) {
        <div class="state-error">
          <p>{{ errorMsg() }}</p>
          <button class="btn btn--ghost btn--sm" (click)="load()">Retry</button>
        </div>
      }

      @if (!loading() && !errorMsg() && items().length === 0) {
        <div class="state-empty">
          <span class="empty-icon">❤️</span>
          <h2>No saved stays yet</h2>
          <p>Tap the heart icon on any property to save it here.</p>
          <a routerLink="/search" class="btn btn--primary">Browse stays</a>
        </div>
      }

      @if (!loading() && items().length > 0) {
        <div class="wishlist-grid">
          @for (item of items(); track item.id) {
            <article class="wishlist-card">
              <div class="card-image">
                @if (item.room?.image_url) {
                  <img [src]="item.room!.image_url" [alt]="item.room!.hotel_name" loading="lazy" />
                } @else {
                  <div class="no-image">🏨</div>
                }

                <button
                  class="remove-btn"
                  (click)="remove(item)"
                  [disabled]="removing().has(item.room_id)"
                  aria-label="Remove from wishlist"
                >
                  @if (removing().has(item.room_id)) { ⏳ } @else { ❌ }
                </button>
              </div>

              <div class="card-body">
                <h3>{{ item.room?.hotel_name }}</h3>
                <p class="location">📍 {{ item.room?.location }}</p>

                <div class="card-meta">
                  <span class="rating">⭐ {{ item.room?.rating | number: '1.1-1' }}</span>
                  <span class="type">{{ item.room?.room_type }}</span>
                </div>

                <div class="card-footer">
                  <span class="price">
                    <strong>{{ item.room?.price | currency }}</strong> / night
                  </span>
                  <a
                    [routerLink]="['/rooms', item.room_id]"
                    class="btn btn--primary btn--sm"
                  >
                    View
                  </a>
                </div>
              </div>
            </article>
          }
        </div>
      }
    </main>

    <app-footer />
  `,
  styles: [`
    .wishlist-page {
      padding-top: 120px;
      padding-bottom: var(--space-4xl);
      min-height: 100vh;
    }

    .wishlist-header { margin-bottom: var(--space-xl); }
    .wishlist-header h1 { font-size: 1.8rem; font-weight: 700; margin: 0 0 6px; }
    .subtitle { color: var(--color-text-muted); margin: 0; font-size: 14px; }

    .state-loading, .state-error, .state-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--space-lg);
      padding: 80px 20px;
      color: var(--color-text-muted);
      text-align: center;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid var(--color-border);
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    .empty-icon { font-size: 3rem; }
    .state-empty h2 { font-size: 1.3rem; font-weight: 600; margin: 0; color: var(--color-text); }

    .wishlist-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: var(--space-xl);
    }

    .wishlist-card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-xl);
      overflow: hidden;
      transition: transform var(--transition-base), border-color var(--transition-fast);
    }

    .wishlist-card:hover {
      transform: translateY(-4px);
      border-color: var(--color-primary);
    }

    .card-image {
      position: relative;
      height: 180px;
      overflow: hidden;
    }

    .card-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform var(--transition-slow);
    }

    .wishlist-card:hover .card-image img { transform: scale(1.05); }

    .no-image {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 3rem;
      background: var(--color-bg);
    }

    .remove-btn {
      position: absolute;
      top: 10px;
      right: 10px;
      background: rgba(0,0,0,0.5);
      backdrop-filter: blur(4px);
      border-radius: 50%;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      cursor: pointer;
      transition: background var(--transition-fast);
    }

    .remove-btn:hover:not(:disabled) { background: rgba(239,68,68,0.7); }
    .remove-btn:disabled { opacity: 0.6; cursor: not-allowed; }

    .card-body {
      padding: var(--space-lg);
      display: flex;
      flex-direction: column;
      gap: var(--space-sm);
    }

    .card-body h3 { font-size: 1rem; font-weight: 600; margin: 0; }

    .location { color: var(--color-text-muted); font-size: 13px; margin: 0; }

    .card-meta {
      display: flex;
      align-items: center;
      gap: var(--space-md);
      font-size: 13px;
    }

    .rating { color: var(--color-primary); font-weight: 600; }
    .type { text-transform: capitalize; color: var(--color-text-muted); }

    .card-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: var(--space-sm);
    }

    .price { font-size: 14px; color: var(--color-text-muted); }
    .price strong { color: var(--color-text); font-size: 1rem; }
  `],
})
export class WishlistComponent implements OnInit {
  private wishlistService = inject(WishlistService);

  items = signal<WishlistItemResponse[]>([]);
  loading = signal(true);
  errorMsg = signal('');
  removing = signal<Set<number>>(new Set());

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.errorMsg.set('');

    this.wishlistService.getWishlist().subscribe({
      next: res => {
        this.items.set(res.items);
        this.loading.set(false);
      },
      error: () => {
        this.errorMsg.set('Unable to load your wishlist. Please try again.');
        this.loading.set(false);
      },
    });
  }

  remove(item: WishlistItemResponse): void {
    const current = new Set(this.removing());
    current.add(item.room_id);
    this.removing.set(current);

    this.wishlistService.remove(item.room_id).subscribe({
      next: () => {
        this.items.update(prev => prev.filter(i => i.id !== item.id));
        const updated = new Set(this.removing());
        updated.delete(item.room_id);
        this.removing.set(updated);
      },
      error: () => {
        const updated = new Set(this.removing());
        updated.delete(item.room_id);
        this.removing.set(updated);
      },
    });
  }
}
