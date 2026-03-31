import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { RoomService } from '../../core/services/room.service';
import { RoomCardComponent } from '../../shared/components/room-card/room-card.component';
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
            <label>📍 Destination</label>
            <input
              type="text"
              placeholder="Where are you going?"
              [(ngModel)]="searchCity"
              class="search-box__input"
            />
          </div>
          <div class="search-box__divider"></div>
          <div class="search-box__field">
            <label>📅 Check-in</label>
            <input type="date" [(ngModel)]="checkIn" [min]="today" class="search-box__input" />
          </div>
          <div class="search-box__divider"></div>
          <div class="search-box__field">
            <label>📅 Check-out</label>
            <input type="date" [(ngModel)]="checkOut" [min]="tomorrow" class="search-box__input" />
          </div>
          <div class="search-box__divider"></div>
          <div class="search-box__field">
            <label>👤 Guests</label>
            <select [(ngModel)]="guests" class="search-box__input">
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
    <section class="section">
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
  styles: [`
    // ─── Hero ─────────────────────────────────────────────────────────────────
    .hero {
      position: relative;
      min-height: 100vh;
      display: flex;
      align-items: center;
      padding-top: 100px;
      overflow: hidden;

      &__bg {
        position: absolute;
        inset: 0;
        background: var(--gradient-hero);
        z-index: 0;
      }

      &__grid {
        position: absolute;
        inset: 0;
        background-image:
          linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
        background-size: 60px 60px;
      }

      &__orbs {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }

      &__orb {
        position: absolute;
        border-radius: 50%;
        filter: blur(80px);

        &--1 {
          width: 600px;
          height: 600px;
          background: rgba(201,168,76,0.06);
          top: -200px;
          right: -100px;
          animation: float 8s ease-in-out infinite;
        }
        &--2 {
          width: 400px;
          height: 400px;
          background: rgba(79,142,247,0.05);
          bottom: -100px;
          left: -50px;
          animation: float 10s ease-in-out infinite 2s;
        }
        &--3 {
          width: 300px;
          height: 300px;
          background: rgba(201,168,76,0.04);
          top: 40%;
          left: 30%;
          animation: float 12s ease-in-out infinite 4s;
        }
      }

      &__particles {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }

      &__particle {
        position: absolute;
        width: 2px;
        height: 2px;
        border-radius: 50%;
        background: rgba(201,168,76,0.6);
        animation: fadeIn 2s ease both;
      }

      &__content {
        position: relative;
        z-index: 1;
        padding-block: var(--space-4xl);
      }

      &__eyebrow {
        margin-bottom: var(--space-xl);
      }

      &__title {
        font-family: var(--font-serif);
        font-size: clamp(3rem, 7vw, 5.5rem);
        font-weight: 700;
        line-height: 1.05;
        color: var(--color-text);
        margin-bottom: var(--space-lg);
        animation: fadeInUp 0.7s ease both;
      }

      &__title-gold {
        background: var(--gradient-gold);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        display: block;
      }

      &__subtitle {
        font-size: clamp(1rem, 2vw, 1.2rem);
        color: var(--color-text-muted);
        line-height: 1.8;
        margin-bottom: var(--space-3xl);
        animation: fadeInUp 0.7s ease 0.15s both;
      }

      &__trust {
        display: flex;
        align-items: center;
        gap: var(--space-xl);
        flex-wrap: wrap;
        margin-top: var(--space-3xl);
        animation: fadeInUp 0.7s ease 0.4s both;
      }

      &__trust-item {
        text-align: center;
        strong {
          display: block;
          font-size: 1.5rem;
          font-weight: 800;
          color: var(--color-primary);
        }
        span {
          font-size: 12px;
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 1px;
        }
      }

      &__trust-sep {
        width: 1px;
        height: 40px;
        background: var(--color-border);
      }

      &__scroll {
        position: absolute;
        bottom: 32px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        color: var(--color-text-muted);
        font-size: 11px;
        letter-spacing: 2px;
        text-transform: uppercase;
      }

      &__scroll-line {
        width: 1px;
        height: 40px;
        background: linear-gradient(to bottom, var(--color-primary), transparent);
        animation: fadeInUp 1.5s ease infinite;
      }
    }

    // ─── Search Box ───────────────────────────────────────────────────────────
    .search-box {
      display: flex;
      align-items: center;
      background: rgba(17, 24, 39, 0.85);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid var(--color-border-light);
      border-radius: var(--radius-xl);
      padding: 8px;
      gap: 0;
      animation: fadeInUp 0.7s ease 0.25s both;
      box-shadow: 0 20px 60px rgba(0,0,0,0.4);
      max-width: 900px;

      &__field {
        flex: 1;
        padding: 12px 20px;

        label {
          display: block;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: var(--color-primary);
          margin-bottom: 4px;
        }
      }

      &__input {
        width: 100%;
        background: none;
        border: none;
        color: var(--color-text);
        font-size: 15px;
        font-weight: 500;
        outline: none;

        &::placeholder { color: var(--color-text-subtle); }

        option { background: var(--color-bg-2); color: var(--color-text); }
      }

      &__divider {
        width: 1px;
        height: 48px;
        background: var(--color-border);
        flex-shrink: 0;
      }

      &__btn {
        flex-shrink: 0;
        margin: 4px;
        padding: 16px 28px;
        font-size: 15px;
      }

      @media (max-width: 768px) {
        flex-direction: column;
        gap: 0;
        padding: var(--space-md);

        &__divider { width: 100%; height: 1px; }
        &__btn { width: 100%; margin: 8px 0 0; }
      }
    }

    // ─── Featured Header ──────────────────────────────────────────────────────
    .featured__header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-bottom: var(--space-3xl);

      @media (max-width: 600px) {
        flex-direction: column;
        align-items: flex-start;
        gap: var(--space-lg);
      }
    }

    // ─── Section Dark ──────────────────────────────────────────────────────────
    .section--dark {
      background: var(--color-bg-2);
    }

    // ─── Destinations ─────────────────────────────────────────────────────────
    .destinations {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      grid-template-rows: auto auto;
      gap: var(--space-md);
      margin-top: var(--space-3xl);

      @media (max-width: 900px) { grid-template-columns: repeat(2, 1fr); }
      @media (max-width: 480px) { grid-template-columns: 1fr; }
    }

    .dest-card {
      position: relative;
      overflow: hidden;
      border-radius: var(--radius-xl);
      cursor: pointer;
      display: block;
      aspect-ratio: 4/3;

      &:first-child {
        grid-column: 1 / 2;
        grid-row: 1 / 3;
        aspect-ratio: unset;
      }

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform 0.6s ease;
      }

      &__overlay {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        padding: var(--space-xl) var(--space-lg) var(--space-lg);
        background: linear-gradient(to top, rgba(8,13,26,0.9) 0%, transparent 100%);

        h3 {
          font-family: var(--font-serif);
          font-size: 1.3rem;
          font-weight: 700;
          color: white;
        }

        p {
          font-size: 13px;
          color: rgba(255,255,255,0.7);
          margin-top: 4px;
        }
      }

      &:hover {
        img { transform: scale(1.06); }
        .dest-card__overlay {
          background: linear-gradient(to top, rgba(8,13,26,0.95) 0%, rgba(201,168,76,0.1) 100%);
        }
      }
    }

    // ─── Why Us ───────────────────────────────────────────────────────────────
    .why-us {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-4xl);
      align-items: center;

      @media (max-width: 900px) { grid-template-columns: 1fr; }

      &__features {
        display: flex;
        flex-direction: column;
        gap: var(--space-md);
      }
    }

    .feature-card {
      display: flex;
      align-items: flex-start;
      gap: var(--space-md);
      padding: var(--space-lg);
      background: var(--gradient-card);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      transition: all var(--transition-base);

      &:hover {
        border-color: rgba(201,168,76,0.3);
        transform: translateX(6px);
      }

      &__icon {
        font-size: 2rem;
        width: 56px;
        height: 56px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(201,168,76,0.1);
        border-radius: var(--radius-md);
        flex-shrink: 0;
      }

      h4 {
        font-size: 16px;
        font-weight: 600;
        color: var(--color-text);
        margin-bottom: 4px;
      }

      p {
        font-size: 14px;
        color: var(--color-text-muted);
        line-height: 1.6;
      }
    }

    // ─── Testimonials ─────────────────────────────────────────────────────────
    .testimonials {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: var(--space-lg);
    }

    .testimonial-card {
      padding: var(--space-xl);
      background: var(--gradient-card);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-xl);
      transition: all var(--transition-base);

      &:hover {
        border-color: rgba(201,168,76,0.3);
        transform: translateY(-4px);
        box-shadow: var(--shadow-xl);
      }

      &__stars {
        color: var(--color-primary);
        font-size: 18px;
        margin-bottom: var(--space-md);
      }

      &__text {
        font-size: 15px;
        color: var(--color-text-muted);
        line-height: 1.8;
        font-style: italic;
        margin-bottom: var(--space-lg);
      }

      &__author {
        display: flex;
        align-items: center;
        gap: var(--space-md);

        strong {
          display: block;
          font-size: 15px;
          color: var(--color-text);
        }

        span {
          font-size: 13px;
          color: var(--color-text-muted);
        }
      }

      &__avatar {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: var(--gradient-gold);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        font-weight: 700;
        color: #0a0f1e;
        flex-shrink: 0;
      }
    }

    // ─── CTA Section ──────────────────────────────────────────────────────────
    .cta-section {
      position: relative;
      padding: var(--space-4xl) 0;
      overflow: hidden;

      &__bg {
        position: absolute;
        inset: 0;
        background: var(--gradient-hero);
        &::after {
          content: '';
          position: absolute;
          inset: 0;
          background: var(--gradient-glow);
        }
      }

      &__content {
        position: relative;
        z-index: 1;
        max-width: 700px;
      }
    }
  `],
})
export class LandingComponent implements OnInit {
  private roomService = inject(RoomService);
  private router = inject(Router);

  featuredRooms = signal<Room[]>([]);
  loadingRooms = signal(true);

  searchCity = '';
  checkIn = '';
  checkOut = '';
  guests = 2;
  today = new Date().toISOString().split('T')[0];
  tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  particles = Array.from({ length: 20 }, (_, i) => {
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
        this.loadingRooms.set(false);
      },
      error: () => {
        // Fallback to mock data for demo
        this.featuredRooms.set(this.getMockRooms());
        this.loadingRooms.set(false);
      },
    });
  }

  search() {
    const params: Record<string, string | number> = {};
    if (this.searchCity) params['city'] = this.searchCity;
    if (this.checkIn)    params['check_in'] = this.checkIn;
    if (this.checkOut)   params['check_out'] = this.checkOut;
    if (this.guests)     params['guests'] = this.guests;
    this.router.navigate(['/search'], { queryParams: params });
  }

  private getMockRooms(): Room[] {
    return [
      { id:1, hotel_name:'The Grand Azure', room_type:'penthouse', price:850, original_price:1200, availability:true, rating:4.9, review_count:284, image_url:'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800', location:'Manhattan, New York', city:'New York', country:'USA', max_guests:4, beds:2, bathrooms:3, size_sqft:2800, floor:52, is_featured:true, created_at:'', amenities:'', gallery_urls:'' },
      { id:2, hotel_name:'Serenity Beach Resort', room_type:'suite', price:420, original_price:580, availability:true, rating:4.8, review_count:512, image_url:'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800', location:'Bali, Indonesia', city:'Bali', country:'Indonesia', max_guests:2, beds:1, bathrooms:2, size_sqft:1200, floor:3, is_featured:true, created_at:'', amenities:'', gallery_urls:'' },
      { id:3, hotel_name:'Alpine Summit Lodge', room_type:'deluxe', price:280, original_price:350, availability:true, rating:4.7, review_count:198, image_url:'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800', location:'Zermatt, Switzerland', city:'Zermatt', country:'Switzerland', max_guests:2, beds:1, bathrooms:1, size_sqft:650, floor:2, is_featured:true, created_at:'', amenities:'', gallery_urls:'' },
      { id:4, hotel_name:'Kyoto Garden Inn', room_type:'suite', price:310, availability:true, rating:4.9, review_count:445, image_url:'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=800', location:'Gion District, Kyoto', city:'Kyoto', country:'Japan', max_guests:2, beds:1, bathrooms:1, size_sqft:900, floor:1, is_featured:true, created_at:'', amenities:'', gallery_urls:'' },
      { id:5, hotel_name:'Metropolis Business', room_type:'deluxe', price:195, original_price:240, availability:true, rating:4.6, review_count:820, image_url:'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=800', location:'City Centre, London', city:'London', country:'UK', max_guests:2, beds:1, bathrooms:1, size_sqft:480, floor:15, is_featured:false, created_at:'', amenities:'', gallery_urls:'' },
      { id:6, hotel_name:'Desert Mirage Palace', room_type:'suite', price:520, availability:true, rating:4.8, review_count:167, image_url:'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800', location:'Dubai, UAE', city:'Dubai', country:'UAE', max_guests:2, beds:1, bathrooms:2, size_sqft:1800, floor:5, is_featured:true, created_at:'', amenities:'', gallery_urls:'' },
    ];
  }
}
