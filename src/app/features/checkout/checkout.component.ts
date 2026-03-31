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
  styleUrl: './checkout.component.scss',
})
export class CheckoutComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private bookingService = inject(BookingService);

  checkoutState = signal<CheckoutState | null>(null);
  submitting = signal(false);
  submitError = signal('');

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
    this.submitError.set('');
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
        this.submitError.set('Unable to create the booking right now. Please try again.');
        this.submitting.set(false);
      },
    });
  }
}

