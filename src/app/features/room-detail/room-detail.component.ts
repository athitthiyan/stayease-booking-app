import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { RoomService } from '../../core/services/room.service';
import { BookingService } from '../../core/services/booking.service';
import { Room } from '../../core/models/room.model';

@Component({
  selector: 'app-room-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
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
            <img [src]="activeImage()" [alt]="room()!.hotel_name" class="gallery__img" />
            <div class="gallery__badge">
              @if (room()!.is_featured) { <span class="badge badge--gold">⭐ Featured</span> }
            </div>
          </div>
          @if (galleryImages().length > 1) {
            <div class="gallery__thumbs">
              @for (img of galleryImages(); track img; let i = $index) {
                <img [src]="img" [alt]="'Gallery ' + i" class="gallery__thumb"
                  [class.active]="activeImageIdx() === i"
                  (click)="setActiveImage(i)" loading="lazy" />
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
                <label>Check-in</label>
                <input type="date" [(ngModel)]="checkIn" [min]="today" class="form-control" (change)="onDateChange()" />
              </div>
              <div class="form-group" style="margin-top:12px">
                <label>Check-out</label>
                <input type="date" [(ngModel)]="checkOut" [min]="tomorrow" class="form-control" (change)="onDateChange()" />
              </div>
              <div class="form-group" style="margin-top:12px">
                <label>Guests</label>
                <select [(ngModel)]="guests" class="form-control">
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

              <button class="btn btn--primary" style="width:100%;margin-top:20px;padding:16px" (click)="bookNow()">
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

  room = signal<Room | null>(null);
  loading = signal(true);
  activeImageIdx = signal(0);
  galleryImages = signal<string[]>([]);

  checkIn = '';
  checkOut = '';
  guests = 2;
  today = new Date().toISOString().split('T')[0];
  tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  nights = signal(0);
  totalAmount = signal(0);

  get guestOptions() {
    return Array.from({ length: this.room()?.max_guests || 4 }, (_, i) => i + 1);
  }

  amenities = computed<string[]>(() => {
      try {
        return JSON.parse(this.room()?.amenities || '[]');
      } catch { return []; }
    });

  activeImage = signal('');

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.roomService.getRoom(id).subscribe({
      next: room => {
        this.room.set(room);
        const imgs: string[] = room.image_url ? [room.image_url] : [];
        try {
          const gallery = JSON.parse(room.gallery_urls || '[]');
          imgs.push(...gallery.filter((g: string) => g !== room.image_url));
        } catch {}
        this.galleryImages.set(imgs);
        this.activeImage.set(imgs[0] || '');
        this.loading.set(false);
      },
      error: () => {
        // Mock fallback
        const mock: Room = { id, hotel_name:'The Grand Azure', room_type:'penthouse', price:850, original_price:1200, availability:true, rating:4.9, review_count:284, image_url:'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800', location:'Manhattan, New York', city:'New York', country:'USA', max_guests:4, beds:2, bathrooms:3, size_sqft:2800, floor:52, is_featured:true, description:'Spectacular penthouse suite with panoramic city views, private terrace, and butler service.', amenities:'["King Bed","Private Terrace","Jacuzzi","Butler Service","Minibar","Smart TV","WiFi","City View"]', gallery_urls:'["https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800","https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800"]', created_at:'' };
        this.room.set(mock);
        this.galleryImages.set([mock.image_url!, 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800']);
        this.activeImage.set(mock.image_url!);
        this.loading.set(false);
      },
    });
  }

  setActiveImage(idx: number) {
    this.activeImageIdx.set(idx);
    this.activeImage.set(this.galleryImages()[idx]);
  }

  onDateChange() {
    if (this.checkIn && this.checkOut) {
      const nights = Math.max(0, (new Date(this.checkOut).getTime() - new Date(this.checkIn).getTime()) / 86400000);
      this.nights.set(Math.floor(nights));
      const roomRate = (this.room()?.price || 0) * this.nights();
      this.totalAmount.set(Math.round(roomRate * 1.17)); // +12% tax +5% service
    }
  }

  bookNow() {
    if (!this.checkIn || !this.checkOut || this.nights() < 1) {
      alert('Please select check-in and check-out dates');
      return;
    }
    this.bookingService.setCheckoutState({
      room: this.room()!,
      checkIn: this.checkIn,
      checkOut: this.checkOut,
      guests: this.guests,
    });
    this.router.navigate(['/checkout', this.room()!.id]);
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

