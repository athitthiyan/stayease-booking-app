import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BookingService, CheckoutState } from '../../core/services/booking.service';
import { Booking } from '../../core/models/booking.model';
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

          <!-- ── Resumable-booking banner ── -->
          @if (resumableBooking()) {
            <div class="hold-banner hold-banner--resume">
              <span class="hold-banner__icon">🔄</span>
              <div>
                <strong>You have an active reservation for these dates.</strong>
                <p>Booking {{ resumableBooking()!.booking_ref }} is still held.
                  Complete payment to confirm it.
                </p>
              </div>
            </div>
          }

          <!-- ── Hold expiry countdown ── -->
          @if (holdSecondsLeft() > 0) {
            <div class="hold-banner" [class.hold-banner--warning]="holdSecondsLeft() < 120">
              <span class="hold-banner__icon">⏳</span>
              <div>
                <strong>Your hold expires in {{ holdMinutes() }}:{{ holdSecondsPad() }}</strong>
                <p>Complete payment before the timer runs out to secure your dates.</p>
              </div>
            </div>
          }

          @if (holdExpired()) {
            <div class="hold-banner hold-banner--expired">
              <span class="hold-banner__icon">⏰</span>
              <div>
                <strong>Your reservation hold has expired.</strong>
                @if (extendingHold()) {
                  <p>Checking date availability…</p>
                } @else {
                  <p>We'll try to re-reserve your dates automatically.</p>
                }
              </div>
            </div>
          }

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

          <!-- Error banner -->
          @if (submitError()) {
            <div class="checkout-error">⚠️ {{ submitError() }}</div>
          }

          <!-- Submit -->
          <div class="checkout-actions">
            <button class="btn btn--primary btn--lg"
              (click)="proceedToPayment()"
              [disabled]="submitting() || extendingHold()">
              @if (submitting() || extendingHold()) {
                <span class="spinner-sm"></span> {{ extendingHold() ? 'Extending hold…' : 'Processing...' }}
              } @else if (resumableBooking()) {
                Complete Payment →
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
export class CheckoutComponent implements OnInit, OnDestroy {
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

  /** Existing resumable booking (PENDING, non-expired hold) for these dates/email. */
  resumableBooking = signal<Booking | null>(null);
  /** Seconds remaining on the hold countdown. 0 = not yet started or expired. */
  holdSecondsLeft = signal(0);
  /** True once the countdown reaches 0. */
  holdExpired = signal(false);
  /** True while the extend-hold API call is in-flight. */
  extendingHold = signal(false);

  private countdownInterval: ReturnType<typeof setInterval> | null = null;

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

    // Recover from payment failure redirect —
    // `pending_booking` is written by redirectToPayment() before sending the user to PayFlow.
    // When the user returns (back button / failed payment redirect) we restore the hold.
    const pendingRaw = sessionStorage.getItem('pending_booking');
    if (pendingRaw) {
      try {
        const pending: Booking = JSON.parse(pendingRaw);
        if (pending?.id && pending.payment_status !== 'paid' && pending.status !== 'confirmed') {
          if (pending.hold_expires_at && new Date(pending.hold_expires_at).getTime() > Date.now()) {
            this.resumableBooking.set(pending);
            this.startCountdown(pending.hold_expires_at);
            this.submitError.set('Your previous payment failed. Complete checkout to retry.');
          } else {
            sessionStorage.removeItem('pending_booking');
          }
        } else if (pending?.payment_status === 'paid') {
          sessionStorage.removeItem('pending_booking');
        }
      } catch {
        sessionStorage.removeItem('pending_booking');
      }
    }
  }

  ngOnDestroy(): void {
    this.stopCountdown();
  }

  // ── Countdown helpers ─────────────────────────────────────────────────────

  holdMinutes(): string {
    return String(Math.floor(this.holdSecondsLeft() / 60)).padStart(2, '0');
  }

  holdSecondsPad(): string {
    return String(this.holdSecondsLeft() % 60).padStart(2, '0');
  }

  startCountdown(holdExpiresAt: string): void {
    this.stopCountdown();
    const expiry = new Date(holdExpiresAt).getTime();
    const tick = () => {
      const secs = Math.max(0, Math.round((expiry - Date.now()) / 1000));
      this.holdSecondsLeft.set(secs);
      if (secs === 0) {
        this.stopCountdown();
        this.holdExpired.set(true);
        // Automatically attempt to extend the hold so the user isn't blocked
        const booking = this.resumableBooking();
        if (booking && this.form.email) {
          this.tryExtendHold(booking.id, this.form.email);
        }
      }
    };
    tick();
    this.countdownInterval = setInterval(tick, 1000);
  }

  private stopCountdown(): void {
    if (this.countdownInterval !== null) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  // ── Extend-hold ───────────────────────────────────────────────────────────

  private tryExtendHold(bookingId: number, email: string): void {
    this.extendingHold.set(true);
    this.bookingService.extendHold(bookingId, email).subscribe({
      next: extended => {
        this.resumableBooking.set(extended);
        this.holdExpired.set(false);
        this.extendingHold.set(false);
        if (extended.hold_expires_at) {
          this.startCountdown(extended.hold_expires_at);
        }
      },
      error: err => {
        this.extendingHold.set(false);
        const detail = err?.error?.detail || '';
        if (detail.toLowerCase().includes('no longer available') || err?.status === 409) {
          this.submitError.set(
            'Your hold expired and the dates are no longer available. Please go back and select new dates.',
          );
          this.resumableBooking.set(null);
        } else {
          this.submitError.set('Could not extend your reservation hold. Please try again.');
        }
      },
    });
  }

  // ── Redirect helper ───────────────────────────────────────────────────────

  private redirectToPayment(booking: Booking): void {
    sessionStorage.setItem('pending_booking', JSON.stringify(booking));
    const paymentUrl = `${environment.paymentAppUrl}?booking_id=${booking.id}&ref=${booking.booking_ref}`;
    window.location.href = paymentUrl;
  }

  // ── Main flow ─────────────────────────────────────────────────────────────

  proceedToPayment() {
    if (!this.form.user_name || !this.form.email) {
      alert('Please fill in your name and email');
      return;
    }

    // ① Prevent duplicate clicks — set immediately before any async work
    if (this.submitting()) return;
    this.submitting.set(true);
    this.submitError.set('');

    const state = this.checkoutState()!;

    // ② Check for a resumable booking (same room/dates/email, non-expired hold)
    this.bookingService
      .findResumableBooking(
        state.room!.id,
        new Date(state.checkIn).toISOString(),
        new Date(state.checkOut).toISOString(),
        this.form.email,
      )
      .subscribe({
        next: existing => {
          if (existing) {
            // ── Resume path: reuse the existing booking ──────────────────
            this.resumableBooking.set(existing);
            if (existing.hold_expires_at) {
              this.startCountdown(existing.hold_expires_at);
            }

            // If the hold is still valid, go straight to payment
            const holdExp = existing.hold_expires_at
              ? new Date(existing.hold_expires_at).getTime()
              : 0;
            if (holdExp > Date.now()) {
              this.redirectToPayment(existing);
            } else {
              // Hold already expired — try to extend before redirecting
              this.submitting.set(false);
              this.tryExtendHold(existing.id, this.form.email);
            }
          } else {
            // ── New booking path ─────────────────────────────────────────
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
                this.resumableBooking.set(booking);
                if (booking.hold_expires_at) {
                  this.startCountdown(booking.hold_expires_at);
                }
                this.redirectToPayment(booking);
              },
              error: err => {
                const detail: string = err?.error?.detail || '';
                if (err?.status === 409) {
                  this.submitError.set(
                    detail || 'These dates are no longer available. Please go back and choose different dates.',
                  );
                } else {
                  this.submitError.set('Unable to create the booking right now. Please try again.');
                }
                this.submitting.set(false);
              },
            });
          }
        },
        // findResumableBooking catches 404 and returns null — this branch handles
        // genuine network/server errors from the resumable lookup itself
        error: () => {
          this.submitError.set('Unable to check existing reservations. Please try again.');
          this.submitting.set(false);
        },
      });
  }
}
