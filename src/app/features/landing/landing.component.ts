import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { RoomCardComponent } from '../../shared/components/room-card/room-card.component';
import { GuestPickerComponent, GuestSelection } from '../../shared/components/guest-picker/guest-picker.component';
import { DateRangePickerComponent } from '../../shared/components/date-range-picker/date-range-picker.component';
import { BookingSearchStore } from '../../core/services/booking-search.store';
import { Room } from '../../core/models/room.model';
import { AvailabilityService } from '../../core/services/availability.service';

/** Format a Date as YYYY-MM-DD using local timezone (avoids UTC shift from toISOString). */
function formatLocalDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

interface Destination {
  name: string;
  country: string;
  image: string;
  hotels: number;
}

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, RoomCardComponent, GuestPickerComponent, DateRangePickerComponent],
  template: `
    <!-- ─── Hero ───────────────────────────────────────────────────────────── -->
    <section class="hero">
      <div class="hero__bg">
        <div class="hero__particles">
          @for (p of particles; track $index) {
            <span class="hero__particle" [style]="p"></span>
          }
        </div>
        <div class="hero__orbs">
          <div class="hero__orb hero__orb--1"></div>
          <div class="hero__orb hero__orb--2"></div>
          <div class="hero__orb hero__orb--3"></div>
        </div>
        <div class="hero__grid"></div>
      </div>

      <div class="container hero__content">
        <div class="hero__eyebrow">
          <span class="section-label">Stay Better. Travel Smarter.</span>
        </div>

        <h1 class="hero__title">
          Find Your Perfect<br />
          <span class="hero__title-gold">Luxury Stay</span>
        </h1>

        <p class="hero__subtitle">
          Stayvora helps you discover handpicked hotels and book with smarter timing,<br />
          clearer value, and a smoother trip from search to stay.
        </p>

        <!-- Search Box -->
        <div class="search-box">
          <div class="search-box__field">
            <label for="landing-destination">📍 Destination</label>
            <input
              id="landing-destination"
              type="text"
              placeholder="Where are you going?"
              [(ngModel)]="searchCity"
              class="search-box__input"
              (ngModelChange)="searchStore.updateDestination($event)"
            />
          </div>
          <div class="search-box__divider"></div>
          <div class="search-box__field search-box__field--dates">
            <label for="dates-picker">📅 Dates</label>
            <app-date-range-picker
              id="dates-picker"
              [checkIn]="checkIn"
              [checkOut]="checkOut"
              (dateChange)="onDateChange($event)"
            />
          </div>
          <div class="search-box__divider"></div>
          <div class="search-box__field search-box__field--guests">
            <label for="guests-picker">👤 Guests</label>
            <app-guest-picker
              id="guests-picker"
              [value]="guestSelection"
              (valueChange)="onGuestChange($event)"
            />
          </div>
          <button
            class="search-box__btn btn btn--primary"
            (click)="search()"
            [disabled]="!!searchValidationError"
          >
            🔍 Search
          </button>
        </div>
        @if (searchValidationError) {
          <div class="search-validation">{{ searchValidationError }}</div>
        }

        <!-- Booking Recovery Banner -->
        @if (showRecoveryBanner()) {
          <div class="recovery-banner" (click)="resumeSearch()" (keydown.enter)="resumeSearch()" tabindex="0" role="button">
            <span class="recovery-banner__icon">🔄</span>
            <span class="recovery-banner__text">
              Continue your recent search?
              <strong>{{ searchStore.destination() }}</strong>
              @if (searchStore.dateRangeText()) {
                · {{ searchStore.dateRangeText() }}
              }
            </span>
            <button class="recovery-banner__btn">Resume</button>
            <button class="recovery-banner__close" (click)="dismissRecovery($event)">✕</button>
          </div>
        }

        <!-- Trust Badges -->
        <div class="hero__trust">
          <div class="hero__trust-item">
            <strong>50,000+</strong>
            <span>Happy Guests</span>
          </div>
          <div class="hero__trust-sep"></div>
          <div class="hero__trust-item">
            <strong>200+</strong>
            <span>Premium Hotels</span>
          </div>
          <div class="hero__trust-sep"></div>
          <div class="hero__trust-item">
            <strong>40+</strong>
            <span>Countries</span>
          </div>
          <div class="hero__trust-sep"></div>
          <div class="hero__trust-item">
            <strong>4.9 ★</strong>
            <span>Average Rating</span>
          </div>
        </div>
      </div>

      <!-- Scroll indicator -->
      <div class="hero__scroll">
        <span>Scroll to explore</span>
        <div class="hero__scroll-line"></div>
      </div>
    </section>

    <!-- ─── Featured Rooms ──────────────────────────────────────────────────── -->
    <section class="section">
      <div class="container">
        <div class="featured__header">
          <div>
            <p class="section-label">Curated Selection</p>
            <h2 class="section-title">Featured <span>Stays</span></h2>
            <p class="section-subtitle">
              Handpicked luxury rooms and suites from around the world.
            </p>
          </div>
          <a routerLink="/search" class="btn btn--ghost">View All →</a>
        </div>

        @if (loadingRooms()) {
          <div class="grid-rooms">
            @for (s of [1,2,3,4,5,6]; track s) {
              <div class="skeleton-card">
                <div class="skeleton" style="height:220px;border-radius:16px 16px 0 0"></div>
                <div style="padding:20px;display:flex;flex-direction:column;gap:10px">
                  <div class="skeleton" style="height:14px;width:60%"></div>
                  <div class="skeleton" style="height:20px;width:80%"></div>
                  <div class="skeleton" style="height:14px;width:40%"></div>
                </div>
              </div>
            }
          </div>
        } @else if (roomsError()) {
          <div class="empty-state" style="padding: 48px 24px; text-align: center;">
            <div class="empty-state__icon" style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
            <h3 style="margin-bottom: 8px;">Unable to load featured rooms</h3>
            <p style="opacity: 0.7; margin-bottom: 24px;">We're having trouble connecting to the server. Please try again shortly.</p>
            <a routerLink="/search" class="btn btn--primary">Browse All Rooms →</a>
          </div>
        } @else {
          <div class="grid-rooms">
            @for (room of featuredRooms(); track room.id) {
              <app-room-card [room]="room" />
            }
          </div>
        }
      </div>
    </section>

    <!-- ─── Destinations ────────────────────────────────────────────────────── -->
    <section class="section section--dark" id="destinations">
      <div class="container">
        <p class="section-label">Explore the World</p>
        <h2 class="section-title">Top <span>Destinations</span></h2>
        <div class="destinations">
          @for (d of destinations; track d.name) {
            <a class="dest-card" [routerLink]="['/search']" [queryParams]="{city: d.name}">
              <img [src]="d.image" [alt]="d.name" loading="lazy" />
              <div class="dest-card__overlay">
                <h3>{{ d.name }}</h3>
                <p>{{ d.country }} · {{ d.hotels }} Hotels</p>
              </div>
            </a>
          }
        </div>
      </div>
    </section>

    <!-- ─── Why Choose Us ────────────────────────────────────────────────────── -->
    <section class="section" id="about">
      <div class="container">
        <div class="why-us">
          <div class="why-us__text">
            <p class="section-label">Why Stayvora</p>
            <h2 class="section-title">The Premium<br /><span>Booking Experience</span></h2>
            <p class="section-subtitle">
              We curate only the finest properties so every stay exceeds expectations.
            </p>
            <a routerLink="/search" class="btn btn--primary btn--lg" style="margin-top: 32px">
              Start Exploring →
            </a>
          </div>
          <div class="why-us__features">
            @for (f of features; track f.title) {
              <div class="feature-card">
                <div class="feature-card__icon">{{ f.icon }}</div>
                <div>
                  <h4>{{ f.title }}</h4>
                  <p>{{ f.desc }}</p>
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    </section>

    <!-- ─── Testimonials ─────────────────────────────────────────────────────── -->
    <section class="section section--dark">
      <div class="container">
        <p class="section-label">Guest Reviews</p>
        <h2 class="section-title" style="text-align:center;margin-bottom:48px">What Guests <span>Say</span></h2>
        <div class="testimonials">
          @for (t of testimonials; track t.name) {
            <div class="testimonial-card">
              <div class="testimonial-card__stars">★★★★★</div>
              <p class="testimonial-card__text">"{{ t.text }}"</p>
              <div class="testimonial-card__author">
                <div class="testimonial-card__avatar">{{ t.name[0] }}</div>
                <div>
                  <strong>{{ t.name }}</strong>
                  <span>{{ t.stay }}</span>
                </div>
              </div>
            </div>
          }
        </div>
      </div>
    </section>

    <!-- ─── CTA Banner ───────────────────────────────────────────────────────── -->
    <section class="cta-section">
      <div class="cta-section__bg"></div>
      <div class="container cta-section__content">
        <h2 class="section-title">Ready for Your<br /><span>Dream Stay?</span></h2>
        <p class="section-subtitle">Browse our full catalog and book your perfect room today.</p>
        <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:32px">
          <a routerLink="/search" class="btn btn--primary btn--lg">Browse All Rooms →</a>
        </div>
      </div>
    </section>
  `,
  styleUrl: './landing.component.scss',
})
export class LandingComponent implements OnInit {
  private router = inject(Router);
  private availabilityService = inject(AvailabilityService);
  searchStore = inject(BookingSearchStore);

  featuredRooms = signal<Room[]>([]);
  loadingRooms = signal(true);
  roomsError = signal(false);
  showRecoveryBanner = signal(false);

  searchCity = '';
  checkIn = '';
  checkOut = '';
  guests = 2;
  guestSelection: GuestSelection = { adults: 2, children: 0, infants: 0 };
  today = formatLocalDate(new Date());
  tomorrow = formatLocalDate(new Date(Date.now() + 86400000));
  searchValidationError = '';

  particles = Array.from({ length: 20 }, () => {
    const x = Math.random() * 100;
    const y = Math.random() * 100;
    const delay = Math.random() * 3;
    return `left:${x}%;top:${y}%;animation-delay:${delay}s`;
  });

  destinations: Destination[] = [
    { name: 'Bali',     country: 'Indonesia',    image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800', hotels: 48 },
    { name: 'Dubai',    country: 'UAE',           image: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800', hotels: 72 },
    { name: 'Kyoto',    country: 'Japan',         image: 'https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=800', hotels: 35 },
    { name: 'New York', country: 'USA',           image: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=800', hotels: 120 },
    { name: 'Zermatt',  country: 'Switzerland',   image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800', hotels: 28 },
  ];

  features = [
    { icon: '🔒', title: 'Secure Payments', desc: 'Every transaction is protected with Stripe-grade encryption.' },
    { icon: '🌟', title: 'Curated Quality', desc: 'Every property is verified and reviewed for exceptional standards.' },
    { icon: '⚡', title: 'Instant Confirmation', desc: 'Book in seconds and receive confirmation immediately.' },
    { icon: '💰', title: 'Best Price Guarantee', desc: 'Find a lower price? We\'ll match it, no questions asked.' },
  ];

  testimonials = [
    { name: 'Sarah M.',  stay: 'Grand Azure Penthouse', text: 'Absolutely breathtaking views. The butler service was impeccable and the room was pure luxury.' },
    { name: 'James K.',  stay: 'Serenity Beach Resort',  text: 'Woke up to the sound of waves every morning. The infinity pool is even better in person.' },
    { name: 'Priya R.',  stay: 'Kyoto Garden Inn',       text: 'The most authentic Japanese experience I\'ve ever had. Stayvora made it effortless to book.' },
  ];

  ngOnInit() {
    // Restore previous search state from store
    const state = this.searchStore.state();
    if (state.destination) this.searchCity = state.destination;
    if (state.checkIn)  this.checkIn = state.checkIn;
    if (state.checkOut) this.checkOut = state.checkOut;
    if (state.adults || state.children || state.infants) {
      this.guestSelection = {
        adults: state.adults || 2,
        children: state.children || 0,
        infants: state.infants || 0,
      };
      this.guests = (state.adults || 2) + (state.children || 0);
    }

    // Show recovery banner if there's a recent search
    if (this.searchStore.hasRecentSearch() && !this.searchCity) {
      this.showRecoveryBanner.set(true);
    }

    this.loadFeaturedRooms();
  }

  onDateChange(event: { checkIn: string; checkOut: string }) {
    this.checkIn = event.checkIn;
    this.checkOut = event.checkOut;
    this.searchStore.updateDates(event.checkIn, event.checkOut);
    this.validateSearch();
    this.loadFeaturedRooms();
  }

  onGuestChange(selection: GuestSelection) {
    this.guestSelection = selection;
    this.guests = selection.adults + selection.children;
    this.searchStore.updateGuests(selection.adults, selection.children, selection.infants);
  }

  validateSearch(): void {
    this.searchValidationError = '';

    if (this.checkIn && this.checkOut) {
      const ci = new Date(this.checkIn + 'T00:00:00');
      const co = new Date(this.checkOut + 'T00:00:00');
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (ci < today) {
        this.searchValidationError = 'Check-in date cannot be in the past';
      } else if (co <= ci) {
        this.searchValidationError = 'Check-out must be after check-in (minimum 1 night)';
      }
    }
  }

  search() {
    this.validateSearch();
    if (this.searchValidationError) return;

    // Persist to centralized store
    this.searchStore.patchState({
      destination: this.searchCity,
      checkIn: this.checkIn,
      checkOut: this.checkOut,
      adults: this.guestSelection.adults,
      children: this.guestSelection.children,
      infants: this.guestSelection.infants,
    });

    const params = this.searchStore.toQueryParams();
    if (this.guests) params['guests'] = String(this.guests);
    this.router.navigate(['/search'], { queryParams: params });
  }

  resumeSearch() {
    this.showRecoveryBanner.set(false);
    const state = this.searchStore.state();
    this.searchCity = state.destination;
    this.checkIn = state.checkIn;
    this.checkOut = state.checkOut;
    this.guestSelection = {
      adults: state.adults,
      children: state.children,
      infants: state.infants,
    };
    this.guests = state.adults + state.children;
    this.search();
  }

  dismissRecovery(event: MouseEvent) {
    event.stopPropagation();
    this.showRecoveryBanner.set(false);
  }

  private loadFeaturedRooms(): void {
    this.loadingRooms.set(true);
    this.roomsError.set(false);

    this.availabilityService.getFeaturedRooms(6, this.checkIn, this.checkOut).subscribe({
      next: rooms => {
        this.featuredRooms.set(rooms);
        this.roomsError.set(false);
        this.loadingRooms.set(false);
      },
      error: () => {
        this.featuredRooms.set([]);
        this.roomsError.set(true);
        this.loadingRooms.set(false);
      },
    });
  }

}
