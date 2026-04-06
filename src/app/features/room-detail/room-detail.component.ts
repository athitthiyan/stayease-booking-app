import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { RoomService } from '../../core/services/room.service';
import { BookingService } from '../../core/services/booking.service';
import { WishlistService } from '../../core/services/wishlist.service';
import { AuthService } from '../../core/services/auth.service';
import { Booking } from '../../core/models/booking.model';
import { Room } from '../../core/models/room.model';
import { ReviewsSectionComponent } from '../../shared/components/reviews-section/reviews-section.component';
import {
  ROOM_IMAGE_PLACEHOLDER,
  applyRoomImageFallback,
  getRoomGalleryImages,
} from '../../shared/utils/image-fallback';

/** ISO date string, e.g. "2026-05-10" */
type ISODateString = string;

@Component({
  selector: 'app-room-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, ReviewsSectionComponent],
  template: `
    <div class="room-detail" [class.loaded]="!loading()">

      @if (loading()) {
        <div class="room-detail__loading">
          <div class="spinner"></div>
        </div>
      } @else if (room()) {
        <!-- Hero image gallery -->
        <div class="gallery">
          <div class="gallery__main">
            <img
              [src]="activeImage() || placeholderImg"
              [alt]="room()!.hotel_name"
              class="gallery__img"
              (error)="onImageError($event)"
            />
            <div class="gallery__badge">
              @if (room()!.is_featured) { <span class="badge badge--gold">⭐ Featured</span> }
              @if (authService.isLoggedIn) {
                <button
                  class="wishlist-btn"
                  [class.saved]="wishlistService.isSaved(room()!.id)"
                  (click)="toggleWishlist()"
                  aria-label="Save to wishlist"
                >
                  {{ wishlistService.isSaved(room()!.id) ? '❤️' : '🤍' }}
                </button>
              }
            </div>
          </div>
          @if (galleryImages().length > 1) {
            <div class="gallery__thumbs">
              @for (img of galleryImages(); track img; let i = $index) {
                <button
                  type="button"
                  class="gallery__thumb-btn"
                  [class.active]="activeImageIdx() === i"
                  (click)="setActiveImage(i)"
                  [attr.aria-label]="'View gallery image ' + (i + 1)"
                >
                  <img
                    [src]="img"
                    [alt]="'Gallery ' + i"
                    class="gallery__thumb"
                    loading="lazy"
                    (error)="onImageError($event)"
                  />
                </button>
              }
            </div>
          }
        </div>

        <div class="container room-detail__body">
          <div class="room-detail__main">

            <!-- Breadcrumb -->
            <nav class="breadcrumb">
              <a routerLink="/">Home</a>
              <span>›</span>
              <a routerLink="/search">Search</a>
              <span>›</span>
              <span>{{ room()!.hotel_name }}</span>
            </nav>

            <!-- Header -->
            <div class="room-detail__header">
              <span class="room-detail__type">{{ room()!.room_type | titlecase }}</span>
              <h1 class="room-detail__name">{{ room()!.hotel_name }}</h1>
              <div class="room-detail__location">📍 {{ room()!.location }}</div>

              <div class="room-detail__meta">
                <div class="rating">
                  <span class="rating__stars">★★★★★</span>
                  <span class="rating__value">{{ room()!.rating }}</span>
                  <span class="rating__count">({{ room()!.review_count | number }} reviews)</span>
                </div>
                <div class="room-detail__pills">
                  <span class="room-card__pill">🛏 {{ room()!.beds }} Bed</span>
                  <span class="room-card__pill">🚿 {{ room()!.bathrooms }} Bath</span>
                  <span class="room-card__pill">👤 {{ room()!.max_guests }} Guests max</span>
                  @if (room()!.size_sqft) {
                    <span class="room-card__pill">📐 {{ room()!.size_sqft }} ft²</span>
                  }
                  @if (room()!.floor) {
                    <span class="room-card__pill">🏢 Floor {{ room()!.floor }}</span>
                  }
                </div>
              </div>
            </div>

            <div class="divider divider--gold"></div>

            <!-- Map Section -->
            <div class="room-map" *ngIf="room()?.map_embed_url || (room()?.latitude && room()?.longitude)">
              <h3 class="section-title">Location</h3>
              @if (room()?.map_embed_url) {
                <iframe
                  [src]="safeMapUrl()"
                  class="map-iframe"
                  allowfullscreen=""
                  loading="lazy"
                  referrerpolicy="no-referrer-when-downgrade"
                  title="Hotel location map">
                </iframe>
              } @else if (room()?.latitude && room()?.longitude) {
                <iframe
                  [src]="coordinatesMapUrl()"
                  class="map-iframe"
                  allowfullscreen=""
                  loading="lazy"
                  referrerpolicy="no-referrer-when-downgrade"
                  title="Hotel location map">
                </iframe>
              }
              @if (room()?.location) {
                <p class="map-address">📍 {{ room()?.location }}</p>
              }
            </div>

            <!-- Description -->
            <div class="room-detail__section">
              <h2>About This Room</h2>
              <p>{{ room()!.description }}</p>
            </div>

            <!-- Amenities -->
            @if (amenities().length > 0) {
              <div class="room-detail__section">
                <h2>Amenities</h2>
                <div class="amenities">
                  @for (a of amenities(); track a) {
                    <div class="amenity">
                      <span class="amenity__icon">{{ getAmenityIcon(a) }}</span>
                      <span>{{ a }}</span>
                    </div>
                  }
                </div>
              </div>
            }

            <!-- Policies -->
            <div class="room-detail__section">
              <h2>Policies</h2>
              <div class="policies">
                <div class="policy">✅ <strong>Free Cancellation</strong> up to 48 hours before check-in</div>
                <div class="policy">🕐 <strong>Check-in:</strong> From 3:00 PM</div>
                <div class="policy">🕐 <strong>Check-out:</strong> Until 12:00 PM</div>
                <div class="policy">🚭 <strong>Non-smoking</strong> property</div>
                <div class="policy">🐾 <strong>Pets:</strong> Not allowed</div>
              </div>
            </div>

            <!-- Reviews -->
            <div class="room-detail__section">
              <app-reviews-section [roomId]="room()!.id" />
            </div>

          </div>

          <!-- Booking Panel (sticky) -->
          <aside class="booking-panel">
            <div class="booking-panel__card">
              <div class="booking-panel__price">
                @if (room()!.original_price) {
                  <span class="price__original">\${{ room()!.original_price | number:'1.0-0' }}</span>
                }
                <span class="price__amount">\${{ room()!.price | number:'1.0-0' }}</span>
                <span class="price__period">/ night</span>
              </div>

              @if (room()!.original_price) {
                <div class="booking-panel__savings">
                  You save \${{ (room()!.original_price! - room()!.price) | number:'1.0-0' }} per night!
                </div>
              }

              <div class="divider"></div>

              <!-- Dates -->
              <div class="form-group">
                <label for="room-detail-check-in">Check-in</label>
                <input id="room-detail-check-in" type="date" [(ngModel)]="checkIn" [min]="today" class="form-control"
                  [class.input--error]="dateConflict()" (change)="onDateChange()" />
              </div>
              <div class="form-group" style="margin-top:12px">
                <label for="room-detail-check-out">Check-out</label>
                <input id="room-detail-check-out" type="date" [(ngModel)]="checkOut" [min]="checkIn || tomorrow" class="form-control"
                  [class.input--error]="dateConflict()" (change)="onDateChange()" />
              </div>
              @if (dateConflict()) {
                <div class="date-conflict-alert">
                  <span>⚠️</span>
                  <span>{{ dateConflict() }}</span>
                </div>
              }
              @if (availabilityStatus() === 'error') {
                <div class="date-conflict-alert">
                  <span>⚠️</span>
                  <span>We can't verify live availability right now. Please try again in a moment.</span>
                </div>
              }
              @if (availabilityStatus() === 'error') {
                <button
                  type="button"
                  class="btn btn--ghost"
                  style="width:100%;margin-top:12px"
                  (click)="retryLiveAvailability()"
                >
                  Retry Live Dates
                </button>
              }
              @if (formError()) {
                <div class="date-conflict-alert">
                  <span>⚠️</span>
                  <span>{{ formError() }}</span>
                </div>
              }
              @if (blockingActiveBooking()) {
                <div class="date-conflict-alert">
                  <span>ðŸ”„</span>
                  <span>
                    Booking {{ blockingActiveBooking()!.booking_ref }} is still active. Complete payment or cancel that booking before starting a new one.
                  </span>
                </div>
                <button
                  type="button"
                  class="btn btn--ghost"
                  style="width:100%;margin-top:12px"
                  (click)="resumePreviousBooking()"
                >
                  Return to Previous Booking
                </button>
              }
              <div class="form-group" style="margin-top:12px">
                <label for="room-detail-guests">Guests</label>
                <select id="room-detail-guests" [(ngModel)]="guests" class="form-control">
                  @for (g of guestOptions; track g) {
                    <option [value]="g">{{ g }} Guest{{ g > 1 ? 's' : '' }}</option>
                  }
                </select>
              </div>

              <!-- Price breakdown -->
              @if (nights() > 0) {
                <div class="divider"></div>
                <div class="booking-panel__breakdown">
                  <div class="breakdown-row">
                    <span>\${{ room()!.price | number:'1.0-0' }} × {{ nights() }} nights</span>
                    <span>\${{ (room()!.price * nights()) | number:'1.0-0' }}</span>
                  </div>
                  <div class="breakdown-row">
                    <span>Taxes (12%)</span>
                    <span>\${{ (room()!.price * nights() * 0.12) | number:'1.0-0' }}</span>
                  </div>
                  <div class="breakdown-row">
                    <span>Service fee (5%)</span>
                    <span>\${{ (room()!.price * nights() * 0.05) | number:'1.0-0' }}</span>
                  </div>
                  <div class="divider"></div>
                  <div class="breakdown-row breakdown-row--total">
                    <span>Total</span>
                    <span>\${{ totalAmount() | number:'1.0-0' }}</span>
                  </div>
                </div>
              }

              <button class="btn btn--primary" style="width:100%;margin-top:20px;padding:16px"
                (click)="bookNow()" [disabled]="!!dateConflict() || availabilityStatus() !== 'ready' || checkingExistingBooking()">
                {{ nights() > 0 ? 'Book Now — $' + (totalAmount() | number:'1.0-0') : 'Select Dates to Book' }}
              </button>

              <p class="booking-panel__note">No charge until you complete checkout</p>
            </div>
          </aside>
        </div>
      } @else {
        <div class="container" style="padding-top:120px;text-align:center">
          <h2>Room not found</h2>
          <a routerLink="/search" class="btn btn--primary" style="margin-top:20px">Browse Rooms</a>
        </div>
      }
    </div>
  `,
  styleUrl: './room-detail.component.scss',
})
export class RoomDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private roomService = inject(RoomService);
  private bookingService = inject(BookingService);
  protected wishlistService = inject(WishlistService);
  protected authService = inject(AuthService);
  private sanitizer = inject(DomSanitizer);

  room = signal<Room | null>(null);
  loading = signal(true);
  loadError = signal(false);
  activeImageIdx = signal(0);
  galleryImages = signal<string[]>([]);
  protected readonly placeholderImg = ROOM_IMAGE_PLACEHOLDER;

  checkIn = '';
  checkOut = '';
  guests = 2;
  today = new Date().toISOString().split('T')[0];
  tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  nights = signal(0);
  totalAmount = signal(0);

  /** Dates that are permanently booked (confirmed/blocked). */
  unavailableDates = signal<ISODateString[]>([]);
  /** Dates temporarily held by another user's active booking hold. */
  heldDates = signal<ISODateString[]>([]);
  availabilityStatus = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  /** Non-empty string = user's date range overlaps a taken date. */
  dateConflict = signal('');
  formError = signal('');
  blockingActiveBooking = signal<Booking | null>(null);
  checkingExistingBooking = signal(false);

  get guestOptions() {
    return Array.from({ length: this.room()?.max_guests || 4 }, (_, i) => i + 1);
  }

  amenities = computed<string[]>(() => {
      try {
        return JSON.parse(this.room()?.amenities || '[]');
      } catch { return []; }
    });

  safeMapUrl = computed<SafeResourceUrl | null>(() => {
    const url = this.room()?.map_embed_url;
    if (!url) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });

  coordinatesMapUrl = computed<SafeResourceUrl | null>(() => {
    const lat = this.room()?.latitude;
    const lng = this.room()?.longitude;
    if (!lat || !lng) return null;
    const key = ''; // Google Maps API key goes here
    const url = key
      ? `https://www.google.com/maps/embed/v1/view?key=${key}&center=${lat},${lng}&zoom=15`
      : `https://maps.google.com/maps?q=${lat},${lng}&output=embed`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });

  activeImage = signal('');

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (this.authService.isLoggedIn) {
      this.wishlistService.loadStatus().subscribe();
    }
    this.roomService.getRoom(id).subscribe({
      next: room => {
        this.room.set(room);
        this.loadError.set(false);
        const imgs = getRoomGalleryImages(room);
        this.galleryImages.set(imgs);
        this.activeImage.set(imgs[0] || '');
        this.loading.set(false);
        this.loadUnavailableDates(room.id);
      },
      error: () => {
        this.room.set(null);
        this.galleryImages.set([]);
        this.activeImage.set('');
        this.loadError.set(true);
        this.loading.set(false);
      },
    });
  }

  setActiveImage(idx: number) {
    this.activeImageIdx.set(idx);
    this.activeImage.set(this.galleryImages()[idx] || this.placeholderImg);
  }

  onImageError(event: Event): void {
    applyRoomImageFallback(event);
  }

  resumePreviousBooking(): void {
    const booking = this.blockingActiveBooking();
    if (!booking || !booking.room) {
      this.router.navigate(['/booking-history']);
      return;
    }

    sessionStorage.setItem('pending_booking', JSON.stringify(booking));
    this.bookingService.setCheckoutState({
      room: booking.room,
      checkIn: booking.check_in.slice(0, 10),
      checkOut: booking.check_out.slice(0, 10),
      guests: booking.guests,
    });
    this.router.navigate(['/checkout', booking.room_id]);
  }

  private beginCheckout(): void {
    this.bookingService.setCheckoutState({
      room: this.room()!,
      checkIn: this.checkIn,
      checkOut: this.checkOut,
      guests: this.guests,
    });
    this.router.navigate(['/checkout', this.room()!.id]);
  }

  private loadUnavailableDates(roomId: number): void {
    const fromDate = this.today;
    const toDate = new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0];
    this.availabilityStatus.set('loading');
    this.bookingService.getUnavailableDates(roomId, fromDate, toDate).subscribe({
      next: res => {
        this.unavailableDates.set(res.unavailable_dates);
        this.heldDates.set(res.held_dates);
        this.availabilityStatus.set('ready');
        // Re-run validation in case dates were already selected
        this.validateDateConflict();
      },
      error: () => {
        this.unavailableDates.set([]);
        this.heldDates.set([]);
        this.availabilityStatus.set('error');
        this.dateConflict.set('');
      },
    });
  }

  /** Iterate every night in the selected range and check against taken dates. */
  private validateDateConflict(): void {
    if (!this.checkIn || !this.checkOut) {
      this.dateConflict.set('');
      return;
    }
    const nights = Math.floor(
      (new Date(this.checkOut).getTime() - new Date(this.checkIn).getTime()) / 86400000,
    );
    if (nights < 1) {
      this.dateConflict.set('');
      return;
    }
    const unavailable = new Set(this.unavailableDates());
    const held = new Set(this.heldDates());

    for (let i = 0; i < nights; i++) {
      const d = new Date(this.checkIn);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      if (unavailable.has(dateStr)) {
        this.dateConflict.set('These dates are already booked. Please select different dates.');
        return;
      }
      if (held.has(dateStr)) {
        this.dateConflict.set('These dates are temporarily held by another guest. Try again shortly or choose different dates.');
        return;
      }
    }
    this.dateConflict.set('');
  }

  onDateChange() {
    this.formError.set('');
    this.blockingActiveBooking.set(null);
    if (this.checkIn && this.checkOut) {
      const nights = Math.max(0, (new Date(this.checkOut).getTime() - new Date(this.checkIn).getTime()) / 86400000);
      this.nights.set(Math.floor(nights));
      const roomRate = (this.room()?.price || 0) * this.nights();
      this.totalAmount.set(Math.round(roomRate * 1.17)); // +12% tax +5% service
    }
    this.validateDateConflict();
  }

  retryLiveAvailability(): void {
    const roomId = this.room()?.id;
    if (!roomId) {
      return;
    }
    this.formError.set('');
    this.loadUnavailableDates(roomId);
  }

  bookNow() {
    if (!this.checkIn || !this.checkOut || this.nights() < 1) {
      this.formError.set('Please select valid check-in and check-out dates.');
      return;
    }
    if (this.availabilityStatus() !== 'ready') {
      this.formError.set('We can’t confirm this room’s live availability right now. Please try again shortly.');
      return;
    }
    if (this.dateConflict()) {
      return; // Button should already be disabled; guard for keyboard/a11y activation
    }
    this.formError.set('');
    this.blockingActiveBooking.set(null);
    this.checkingExistingBooking.set(false);
    this.beginCheckout();
  }

  toggleWishlist(): void {
    const room = this.room();
    if (!room) return;
    this.wishlistService.toggle(room.id).subscribe();
  }

  getAmenityIcon(amenity: string): string {
    const icons: Record<string, string> = {
      'WiFi': '📶', 'Pool': '🏊', 'Infinity Pool': '🏊', 'Spa': '💆', 'Jacuzzi': '🛁',
      'Gym': '🏋️', 'Gym Access': '🏋️', 'King Bed': '🛏', 'Butler Service': '🤵',
      'Minibar': '🍷', 'Smart TV': '📺', 'City View': '🌆', 'Ocean View': '🌊',
      'Mountain View': '⛰', 'Fireplace': '🔥', 'Balcony': '🏗', 'Private Balcony': '🏗',
      'Room Service': '🛎', 'Breakfast Included': '🍳', 'Parking': '🚗',
    };
    for (const [k, v] of Object.entries(icons)) {
      if (amenity.toLowerCase().includes(k.toLowerCase())) return v;
    }
    return '✓';
  }
}
