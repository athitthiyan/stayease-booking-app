import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { RoomService } from '../../core/services/room.service';
import { BookingService } from '../../core/services/booking.service';
import { AuthService } from '../../core/services/auth.service';
import { RoomCardComponent } from '../../shared/components/room-card/room-card.component';
import { Booking } from '../../core/models/booking.model';
import { Room } from '../../core/models/room.model';

interface Destination {
  name: string;
  country: string;
  image: string;
  hotels: number;
}

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, RoomCardComponent],
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
        @if (activeBooking()) {
          <div style="display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;padding:18px 20px;margin-bottom:24px;border:1px solid rgba(208,180,90,0.35);border-radius:20px;background:rgba(16,22,40,0.88);box-shadow:0 12px 32px rgba(0,0,0,0.18);">
            <div>
              <p class="section-label" style="margin-bottom:8px">Active Booking</p>
              <h3 style="margin:0 0 6px;font-size:1.1rem">Booking {{ activeBooking()!.booking_ref }} is still on hold</h3>
              <p style="margin:0;color:var(--color-text-muted)">
                Complete payment or cancel this booking before starting another one.
                Time left: {{ activeBookingMinutes() }}:{{ activeBookingSecondsPad() }}
              </p>
            </div>
            <button class="btn btn--primary" type="button" (click)="resumeActiveBooking()">
              Go To Booking
            </button>
          </div>
        }
        <div class="hero__eyebrow">
          <span class="section-label">Premium Hotel Booking</span>
        </div>

        <h1 class="hero__title">
          Find Your Perfect<br />
          <span class="hero__title-gold">Luxury Stay</span>
        </h1>

        <p class="hero__subtitle">
          Discover handpicked hotels and exclusive suites worldwide.<br />
          Book instantly, stay unforgettably.
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
            />
          </div>
          <div class="search-box__divider"></div>
          <div class="search-box__field">
            <label for="landing-check-in">📅 Check-in</label>
            <input id="landing-check-in" type="date" [(ngModel)]="checkIn" [min]="today" class="search-box__input" />
          </div>
          <div class="search-box__divider"></div>
          <div class="search-box__field">
            <label for="landing-check-out">📅 Check-out</label>
            <input id="landing-check-out" type="date" [(ngModel)]="checkOut" [min]="tomorrow" class="search-box__input" />
          </div>
          <div class="search-box__divider"></div>
          <div class="search-box__field">
            <label for="landing-guests">👤 Guests</label>
            <select id="landing-guests" [(ngModel)]="guests" class="search-box__input">
              <option [value]="1">1 Guest</option>
              <option [value]="2">2 Guests</option>
              <option [value]="3">3 Guests</option>
              <option [value]="4">4+ Guests</option>
            </select>
          </div>
          <button class="search-box__btn btn btn--primary" (click)="search()">
            🔍 Search
          </button>
        </div>

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
            <p class="section-label">Why StayEase</p>
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
export class LandingComponent implements OnInit, OnDestroy {
  private roomService = inject(RoomService);
  private bookingService = inject(BookingService);
  protected authService = inject(AuthService);
  private router = inject(Router);

  featuredRooms = signal<Room[]>([]);
  loadingRooms = signal(true);
  roomsError = signal(false);
  activeBooking = signal<Booking | null>(null);
  activeBookingSecondsLeft = signal(0);
  private countdownInterval: ReturnType<typeof setInterval> | null = null;

  searchCity = '';
  checkIn = '';
  checkOut = '';
  guests = 2;
  today = new Date().toISOString().split('T')[0];
  tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

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
    { name: 'Priya R.',  stay: 'Kyoto Garden Inn',       text: 'The most authentic Japanese experience I\'ve ever had. StayEase made it effortless to book.' },
  ];

  ngOnInit() {
    this.roomService.getFeaturedRooms(6).subscribe({
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

    if (this.authService.isLoggedIn) {
      this.loadActiveBooking();
    }
  }

  ngOnDestroy(): void {
    this.stopActiveBookingCountdown();
  }

  activeBookingMinutes(): string {
    return String(Math.floor(this.activeBookingSecondsLeft() / 60)).padStart(2, '0');
  }

  activeBookingSecondsPad(): string {
    return String(this.activeBookingSecondsLeft() % 60).padStart(2, '0');
  }

  private hasActivePendingBooking(booking: Booking): boolean {
    return (
      booking.status === 'pending' &&
      booking.payment_status !== 'paid' &&
      !!booking.hold_expires_at &&
      new Date(booking.hold_expires_at).getTime() > Date.now()
    );
  }

  private loadActiveBooking(): void {
    this.bookingService.getMyBookings().subscribe({
      next: response => {
        const activeBooking =
          response.bookings.find(booking => this.hasActivePendingBooking(booking)) || null;
        this.activeBooking.set(activeBooking);
        if (activeBooking?.hold_expires_at) {
          this.startActiveBookingCountdown(activeBooking.hold_expires_at);
        } else {
          this.stopActiveBookingCountdown();
        }
      },
      error: () => {
        this.activeBooking.set(null);
        this.stopActiveBookingCountdown();
      },
    });
  }

  private startActiveBookingCountdown(holdExpiresAt: string): void {
    this.stopActiveBookingCountdown();
    const expiry = new Date(holdExpiresAt).getTime();
    const tick = () => {
      const secondsLeft = Math.max(0, Math.round((expiry - Date.now()) / 1000));
      this.activeBookingSecondsLeft.set(secondsLeft);
      if (secondsLeft === 0) {
        this.stopActiveBookingCountdown();
        this.activeBooking.set(null);
      }
    };

    tick();
    this.countdownInterval = setInterval(tick, 1000);
  }

  private stopActiveBookingCountdown(): void {
    if (this.countdownInterval !== null) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    this.activeBookingSecondsLeft.set(0);
  }

  resumeActiveBooking(): void {
    const booking = this.activeBooking();
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

  search() {
    const params: Record<string, string | number> = {};
    if (this.searchCity) params['city'] = this.searchCity;
    if (this.checkIn)    params['check_in'] = this.checkIn;
    if (this.checkOut)   params['check_out'] = this.checkOut;
    if (this.guests)     params['guests'] = this.guests;
    this.router.navigate(['/search'], { queryParams: params });
  }

}
