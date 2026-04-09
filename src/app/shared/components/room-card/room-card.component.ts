import { Component, Input, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Room } from '../../../core/models/room.model';
import { WishlistService } from '../../../core/services/wishlist.service';
import { AuthService } from '../../../core/services/auth.service';
import {
  ROOM_IMAGE_PLACEHOLDER,
  applyRoomImageFallback,
  normalizeRoomImageUrl,
} from '../../utils/image-fallback';

@Component({
  selector: 'app-room-card',
  standalone: true,
  imports: [RouterLink, CommonModule],
  template: `
    <article
      class="room-card"
      [class.room-card--disabled]="!isRoomAvailable"
      [routerLink]="isRoomAvailable ? ['/rooms', room.id] : null"
    >
      <!-- Image -->
      <div class="room-card__image-wrap">
        <img
          [src]="resolveImage(room.image_url)"
          [alt]="room.hotel_name"
          class="room-card__image"
          loading="lazy"
          (error)="onImgError($event)"
        />
        <!-- Overlay badges -->
        <div class="room-card__badges">
          @if (room.is_featured) {
            <span class="badge badge--gold">⭐ Featured</span>
          }
          @if (discountPct > 0) {
            <span class="badge badge--error">-{{ discountPct }}%</span>
          }
        </div>

        <!-- Wishlist heart -->
        @if (authService.isLoggedIn) {
          <button
            class="room-card__wishlist"
            [class.saved]="wishlistService.isSaved(room.id)"
            (click)="toggleWishlist($event)"
            aria-label="Save to wishlist"
          >
            {{ wishlistService.isSaved(room.id) ? '❤️' : '🤍' }}
          </button>
        }
        <!-- Hover CTA -->
        <div class="room-card__hover-cta">
          <span>View Details →</span>
        </div>
      </div>

      <!-- Body -->
      <div class="room-card__body">
        <!-- Hotel & type -->
        <div class="room-card__meta">
          <span class="room-card__type">{{ roomTypeLabel }}</span>
          <span class="room-card__location">📍 {{ room.city }}, {{ room.country }}</span>
        </div>

        <h3 class="room-card__name">{{ room.hotel_name }}</h3>

        <!-- Rating -->
        <div class="rating">
          <span class="rating__stars">{{ starStr }}</span>
          <span class="rating__value">{{ room.rating }}</span>
          <span class="rating__count">({{ room.review_count | number }} reviews)</span>
        </div>

        <!-- Info pills -->
        <div class="room-card__info">
          <span class="room-card__pill">🛏 {{ room.beds }} Bed{{ room.beds > 1 ? 's' : '' }}</span>
          <span class="room-card__pill">🚿 {{ room.bathrooms }} Bath</span>
          <span class="room-card__pill">👤 {{ room.max_guests }} Guest{{ room.max_guests > 1 ? 's' : '' }}</span>
          @if (room.size_sqft) {
            <span class="room-card__pill">📐 {{ room.size_sqft }} ft²</span>
          }
        </div>

        <!-- Price -->
        <div class="room-card__footer">
          <div class="price">
            @if (room.original_price) {
              <span class="price__original">₹{{ room.original_price | number:'1.0-0' }}</span>
            }
            <span class="price__amount">₹{{ room.price | number:'1.0-0' }}</span>
            <span class="price__period">/ night</span>
          </div>
          @if (room.availabilityState === 'loading') {
            <span class="room-card__availability room-card__availability--loading">Checking availability…</span>
          } @else if (!isRoomAvailable) {
            <span class="room-card__availability room-card__availability--unavailable">
              {{ room.availabilityMessage || 'Unavailable for selected dates' }}
            </span>
          } @else {
            <a [routerLink]="['/rooms', room.id]" class="btn btn--primary btn--sm" (click)="$event.stopPropagation()">
              Book Now
            </a>
          }
        </div>
      </div>
    </article>
  `,
  styles: [`
    .room-card {
      cursor: pointer;
      background: var(--gradient-card);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-xl);
      overflow: hidden;
      transition: all var(--transition-base);
      display: flex;
      flex-direction: column;
    }

    .room-card:hover {
      border-color: rgba(201,168,76,0.3);
      transform: translateY(-6px);
      box-shadow: 0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(201,168,76,0.08);
    }

    .room-card--disabled {
      cursor: default;
      opacity: 0.86;
    }

    .room-card--disabled:hover {
      transform: none;
    }

    .room-card:hover .room-card__image { transform: scale(1.05); }
    .room-card:hover .room-card__hover-cta { opacity: 1; transform: translateY(0); }

    .room-card__image-wrap {
      position: relative;
      overflow: hidden;
      aspect-ratio: 16/10;
    }

    .room-card__image {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .room-card__badges {
      position: absolute;
      top: 12px;
      left: 12px;
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }

    .room-card__hover-cta {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 32px 16px 16px;
      background: linear-gradient(to top, rgba(8,13,26,0.9), transparent);
      color: white;
      font-weight: 600;
      font-size: 14px;
      opacity: 0;
      transform: translateY(8px);
      transition: all var(--transition-base);
    }

    .room-card__body {
      padding: var(--space-lg);
      display: flex;
      flex-direction: column;
      gap: var(--space-sm);
      flex: 1;
    }

    .room-card__meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .room-card__type {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: var(--color-primary);
      background: rgba(201,168,76,0.1);
      padding: 3px 10px;
      border-radius: var(--radius-full);
      border: 1px solid rgba(201,168,76,0.2);
    }

    .room-card__location {
      font-size: 12px;
      color: var(--color-text-muted);
    }

    .room-card__name {
      font-family: var(--font-serif);
      font-size: 1.2rem;
      font-weight: 600;
      color: var(--color-text);
      line-height: 1.3;
      margin-top: 2px;
    }

    .room-card__info {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 4px;
    }

    .room-card__pill {
      font-size: 12px;
      color: var(--color-text-muted);
      background: var(--color-surface);
      padding: 4px 10px;
      border-radius: var(--radius-full);
      border: 1px solid var(--color-border);
    }

    .room-card__footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-top: auto;
      padding-top: var(--space-md);
      border-top: 1px solid var(--color-border);
    }

    .room-card__availability {
      font-size: 12px;
      font-weight: 600;
      color: var(--color-text-muted);
    }

    .room-card__availability--loading {
      color: var(--color-primary);
    }

    .room-card__availability--unavailable {
      color: #fca5a5;
    }

    .room-card__footer .price {
      display: flex;
      align-items: baseline;
      gap: 6px;
    }

    .room-card__wishlist {
      position: absolute;
      top: 10px;
      right: 10px;
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: rgba(8,13,26,0.55);
      backdrop-filter: blur(6px);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      cursor: pointer;
      transition: all var(--transition-fast);
      z-index: 2;
    }

    .room-card__wishlist:hover {
      background: rgba(239,68,68,0.3);
      transform: scale(1.1);
    }
  `],
})
export class RoomCardComponent implements OnInit {
  @Input({ required: true }) room!: Room;

  protected wishlistService = inject(WishlistService);
  protected authService = inject(AuthService);

  placeholderImg = ROOM_IMAGE_PLACEHOLDER;
  starStr = '★★★★★';
  roomTypeLabel = '';
  discountPct = 0;
  protected isRoomAvailable = true;

  ngOnInit() {
    const labelMap: Record<string, string> = {
      standard: 'Standard Room',
      deluxe: 'Deluxe Room',
      suite: 'Suite',
      penthouse: 'Penthouse',
    };
    this.roomTypeLabel = labelMap[this.room.room_type] || this.room.room_type;

    const stars = Math.round(this.room.rating);
    this.starStr = '★'.repeat(stars) + '☆'.repeat(5 - stars);

    if (this.room.original_price && this.room.original_price > this.room.price) {
      this.discountPct = Math.round(
        ((this.room.original_price - this.room.price) / this.room.original_price) * 100
      );
    }

    this.isRoomAvailable = this.room.availabilityState !== 'unavailable';
  }

  onImgError(event: Event): void {
    applyRoomImageFallback(event);
  }

  resolveImage(imageUrl?: string): string {
    return normalizeRoomImageUrl(imageUrl) || this.placeholderImg;
  }

  toggleWishlist(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    this.wishlistService.toggle(this.room.id).subscribe();
  }
}
