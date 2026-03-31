import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BookingService, CheckoutState } from '../../core/services/booking.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="checkout-page">
      <div class="container checkout-page__inner">

        <!-- Left: Form -->
        <div class="checkout-form">
          <nav class="breadcrumb">
            <a routerLink="/">Home</a> <span>›</span>
            <a routerLink="/search">Search</a> <span>›</span>
            <span>Checkout</span>
          </nav>

          <h1 class="checkout-title">Complete Your <span>Booking</span></h1>

          <!-- Guest Details -->
          <section class="checkout-section">
            <h2>Guest Information</h2>
            <div class="form-row">
              <div class="form-group">
                <label>Full Name *</label>
                <input type="text" [(ngModel)]="form.user_name" class="form-control" placeholder="John Doe" required />
              </div>
              <div class="form-group">
                <label>Email Address *</label>
                <input type="email" [(ngModel)]="form.email" class="form-control" placeholder="john@example.com" required />
              </div>
            </div>
            <div class="form-group" style="margin-top:16px">
              <label>Phone Number</label>
              <input type="tel" [(ngModel)]="form.phone" class="form-control" placeholder="+1 (555) 000-0000" />
            </div>
            <div class="form-group" style="margin-top:16px">
              <label>Special Requests (Optional)</label>
              <textarea [(ngModel)]="form.special_requests" class="form-control" rows="3" placeholder="Any special requirements or preferences..."></textarea>
            </div>
          </section>

          <!-- Stay Details -->
          <section class="checkout-section">
            <h2>Stay Details</h2>
            <div class="stay-details">
              <div class="stay-detail">
                <span class="stay-detail__label">Check-in</span>
                <span class="stay-detail__value">{{ checkoutState()?.checkIn | date:'MMM d, yyyy' }}</span>
              </div>
              <div class="stay-detail">
                <span class="stay-detail__label">Check-out</span>
                <span class="stay-detail__value">{{ checkoutState()?.checkOut | date:'MMM d, yyyy' }}</span>
              </div>
              <div class="stay-detail">
                <span class="stay-detail__label">Duration</span>
                <span class="stay-detail__value">{{ nights() }} Night{{ nights() !== 1 ? 's' : '' }}</span>
              </div>
              <div class="stay-detail">
                <span class="stay-detail__label">Guests</span>
                <span class="stay-detail__value">{{ checkoutState()?.guests }}</span>
              </div>
            </div>
          </section>

          <!-- Submit -->
          <div class="checkout-actions">
            <button class="btn btn--primary btn--lg" (click)="proceedToPayment()" [disabled]="submitting()">
              @if (submitting()) {
                <span class="spinner-sm"></span> Processing...
              } @else {
                Proceed to Payment →
              }
            </button>
            <p class="checkout-note">
              🔒 Your data is encrypted and secure. No payment charged until confirmed.
            </p>
          </div>
        </div>

        <!-- Right: Order Summary -->
        <aside class="order-summary">
          <div class="order-summary__card">
            <h3>Order Summary</h3>
            <div class="divider"></div>

            @if (checkoutState()?.room) {
              <div class="order-summary__room">
                <img
                  [src]="checkoutState()!.room!.image_url"
                  [alt]="checkoutState()!.room!.hotel_name"
                  class="order-summary__img"
                />
                <div>
                  <span class="order-summary__type">{{ checkoutState()!.room!.room_type | titlecase }}</span>
                  <h4>{{ checkoutState()!.room!.hotel_name }}</h4>
                  <p>📍 {{ checkoutState()!.room!.location }}</p>
                </div>
              </div>
            }

            <div class="divider"></div>

            <div class="order-summary__breakdown">
              <div class="breakdown-row">
                <span>Room rate / night</span>
                <span>\${{ checkoutState()?.room?.price | number:'1.0-0' }}</span>
              </div>
              <div class="breakdown-row">
                <span>Nights</span>
                <span>× {{ nights() }}</span>
              </div>
              <div class="breakdown-row">
                <span>Subtotal</span>
                <span>\${{ subtotal() | number:'1.0-0' }}</span>
              </div>
              <div class="breakdown-row">
                <span>Taxes (12%)</span>
                <span>\${{ taxes() | number:'1.0-0' }}</span>
              </div>
              <div class="breakdown-row">
                <span>Service fee (5%)</span>
                <span>\${{ serviceFee() | number:'1.0-0' }}</span>
              </div>
              <div class="divider"></div>
              <div class="breakdown-row breakdown-row--total">
                <span>Total</span>
                <span>\${{ total() | number:'1.0-0' }}</span>
              </div>
            </div>

            <!-- Trust badges -->
            <div class="order-summary__trust">
              <div class="trust-item">✅ Free cancellation (48h)</div>
              <div class="trust-item">🔒 Secure payment</div>
              <div class="trust-item">⭐ Best price guaranteed</div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  `,
  styles: [`
    .checkout-page {
      padding-top: 100px;
      padding-bottom: var(--space-4xl);
      min-height: 100vh;

      &__inner {
        display: grid;
        grid-template-columns: 1fr 380px;
        gap: var(--space-3xl);
        align-items: start;

        @media (max-width: 1024px) { grid-template-columns: 1fr; }
      }
    }

    .checkout-title {
      font-family: var(--font-serif);
      font-size: 2.2rem;
      color: var(--color-text);
      margin: var(--space-xl) 0 var(--space-3xl);
      span { color: var(--color-primary); }
    }

    .checkout-section {
      background: var(--gradient-card);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-xl);
      padding: var(--space-xl);
      margin-bottom: var(--space-lg);

      h2 {
        font-size: 16px;
        font-weight: 700;
        color: var(--color-text);
        margin-bottom: var(--space-lg);
        padding-bottom: var(--space-md);
        border-bottom: 1px solid var(--color-border);
      }
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-md);

      @media (max-width: 600px) { grid-template-columns: 1fr; }
    }

    .stay-details {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: var(--space-md);
    }

    .stay-detail {
      padding: var(--space-md);
      background: var(--color-surface);
      border-radius: var(--radius-md);
      border: 1px solid var(--color-border);

      &__label {
        display: block;
        font-size: 11px;
        color: var(--color-primary);
        text-transform: uppercase;
        letter-spacing: 1px;
        font-weight: 700;
        margin-bottom: 4px;
      }

      &__value {
        font-weight: 600;
        font-size: 15px;
        color: var(--color-text);
      }
    }

    .checkout-actions {
      margin-top: var(--space-xl);

      .btn { width: 100%; }
    }

    .checkout-note {
      text-align: center;
      font-size: 12px;
      color: var(--color-text-muted);
      margin-top: var(--space-md);
    }

    // ── Order Summary ──────────────────────────────────────────────────────────
    .order-summary {
      position: sticky;
      top: 100px;

      &__card {
        background: var(--gradient-card);
        border: 1px solid var(--color-border-light);
        border-radius: var(--radius-xl);
        padding: var(--space-xl);
        box-shadow: var(--shadow-xl);

        h3 {
          font-family: var(--font-serif);
          font-size: 1.3rem;
          color: var(--color-text);
          margin-bottom: var(--space-md);
        }
      }

      &__room {
        display: flex;
        gap: var(--space-md);
        margin-bottom: var(--space-md);
        align-items: flex-start;

        div {
          span { display: block; font-size: 11px; color: var(--color-primary); font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
          h4 { font-size: 15px; color: var(--color-text); margin-bottom: 4px; }
          p { font-size: 13px; color: var(--color-text-muted); }
        }
      }

      &__img {
        width: 80px;
        height: 60px;
        object-fit: cover;
        border-radius: var(--radius-md);
        flex-shrink: 0;
      }

      &__breakdown {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
      }

      &__trust {
        margin-top: var(--space-lg);
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);

        .trust-item {
          font-size: 13px;
          color: var(--color-text-muted);
        }
      }
    }

    .breakdown-row {
      display: flex;
      justify-content: space-between;
      font-size: 14px;
      color: var(--color-text-muted);

      &--total {
        font-size: 18px;
        font-weight: 800;
        color: var(--color-text);
        .price__amount { color: var(--color-primary); }
      }
    }

    .spinner-sm {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid rgba(0,0,0,0.3);
      border-top-color: #0a0f1e;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
  `],
})
export class CheckoutComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private bookingService = inject(BookingService);

  checkoutState = signal<CheckoutState | null>(null);
  submitting = signal(false);

  nights = signal(0);
  subtotal = signal(0);
  taxes = signal(0);
  serviceFee = signal(0);
  total = signal(0);

  form = {
    user_name: '',
    email: '',
    phone: '',
    special_requests: '',
  };

  ngOnInit() {
    const state = this.bookingService.getCheckoutState();
    if (!state) {
      this.router.navigate(['/search']);
      return;
    }
    this.checkoutState.set(state);
    const nights = Math.floor(
      (new Date(state.checkOut).getTime() - new Date(state.checkIn).getTime()) / 86400000
    );
    this.nights.set(nights);
    const sub = (state.room?.price || 0) * nights;
    const tax = Math.round(sub * 0.12);
    const fee = Math.round(sub * 0.05);
    this.subtotal.set(sub);
    this.taxes.set(tax);
    this.serviceFee.set(fee);
    this.total.set(sub + tax + fee);
  }

  proceedToPayment() {
    if (!this.form.user_name || !this.form.email) {
      alert('Please fill in your name and email');
      return;
    }
    this.submitting.set(true);
    const state = this.checkoutState()!;

    this.bookingService.createBooking({
      user_name: this.form.user_name,
      email: this.form.email,
      phone: this.form.phone,
      room_id: state.room!.id,
      check_in: new Date(state.checkIn).toISOString(),
      check_out: new Date(state.checkOut).toISOString(),
      guests: state.guests,
      special_requests: this.form.special_requests,
    }).subscribe({
      next: booking => {
        sessionStorage.setItem('pending_booking', JSON.stringify(booking));
        // Redirect to PayFlow payment app
        const paymentUrl = `${environment.paymentAppUrl}?booking_id=${booking.id}&ref=${booking.booking_ref}`;
        window.location.href = paymentUrl;
      },
      error: () => {
        // Demo fallback: simulate booking and redirect
        const mockBookingId = Math.floor(Math.random() * 1000) + 1;
        const mockRef = 'BK' + Math.random().toString(36).substring(2, 10).toUpperCase();
        this.router.navigate(['/booking-confirmation'], {
          queryParams: { ref: mockRef, demo: true }
        });
        this.submitting.set(false);
      },
    });
  }
}
