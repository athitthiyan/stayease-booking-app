import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Booking } from '../../core/models/booking.model';
import { BookingService } from '../../core/services/booking.service';

@Component({
  selector: 'app-booking-confirmation',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="confirm-page">
      <div class="confirm-page__bg"></div>
      <div class="container confirm-page__content">
        <div class="confirm-card">
          <div class="confirm-card__icon">✅</div>
          <h1>Booking <span>Confirmed!</span></h1>
          <p class="confirm-card__desc">
            Your reservation has been successfully placed. A confirmation email will be sent shortly.
          </p>

          <div class="confirm-card__ref">
            <span class="confirm-card__ref-label">Booking Reference</span>
            <span class="confirm-card__ref-value">{{ bookingRef }}</span>
          </div>

          @if (loading) {
            <p class="confirm-card__status">Loading your booking details...</p>
          }

          @if (error) {
            <div class="confirm-card__detail-box">
              <p class="confirm-card__status confirm-card__status--error">{{ error }}</p>
            </div>
          }

          @if (booking) {
            <div class="confirm-card__details">
              <div class="confirm-card__detail-box">
                <span class="confirm-card__detail-label">Hotel</span>
                <strong>{{ booking.room?.hotel_name || 'Your stay' }}</strong>
                <span class="confirm-card__detail-sub">{{ booking.room?.location || '' }}</span>
              </div>

              <div class="confirm-card__detail-grid">
                <div class="confirm-card__detail-box">
                  <span class="confirm-card__detail-label">Check-in</span>
                  <strong>{{ booking.check_in | date:'mediumDate' }}</strong>
                </div>
                <div class="confirm-card__detail-box">
                  <span class="confirm-card__detail-label">Check-out</span>
                  <strong>{{ booking.check_out | date:'mediumDate' }}</strong>
                </div>
                <div class="confirm-card__detail-box">
                  <span class="confirm-card__detail-label">Guests</span>
                  <strong>{{ booking.guests }}</strong>
                </div>
                <div class="confirm-card__detail-box">
                  <span class="confirm-card__detail-label">Total</span>
                  <strong>\${{ booking.total_amount | number:'1.2-2' }}</strong>
                </div>
              </div>

              <div class="confirm-card__detail-grid">
                <div class="confirm-card__detail-box">
                  <span class="confirm-card__detail-label">Booking Status</span>
                  <strong>{{ booking.status }}</strong>
                </div>
                <div class="confirm-card__detail-box">
                  <span class="confirm-card__detail-label">Payment Status</span>
                  <strong>{{ booking.payment_status }}</strong>
                </div>
              </div>
            </div>
          }

          <div class="confirm-card__actions">
            <a routerLink="/" class="btn btn--primary btn--lg">Back to Home</a>
            <a routerLink="/search" class="btn btn--secondary btn--lg">Browse More Rooms</a>
          </div>

          <div class="confirm-card__links">
            <p>View the payment for this booking at:</p>
            <a href="https://payflow-payment-app.vercel.app" target="_blank" class="text-gold">
              PayFlow Gateway →
            </a>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .confirm-page {
      position: relative;
      min-height: 100vh;
      display: flex;
      align-items: center;
      padding-top: 80px;
    }

    .confirm-page__bg {
      position: absolute;
      inset: 0;
      background: var(--gradient-hero);
    }

    .confirm-page__bg::after {
      content: '';
      position: absolute;
      inset: 0;
      background: radial-gradient(ellipse at center, rgba(34,197,94,0.08) 0%, transparent 60%);
    }

    .confirm-page__content {
      position: relative;
      z-index: 1;
      display: flex;
      justify-content: center;
    }

    .confirm-card {
      background: var(--gradient-card);
      border: 1px solid rgba(34,197,94,0.3);
      border-radius: var(--radius-2xl);
      padding: var(--space-4xl);
      text-align: center;
      max-width: 560px;
      width: 100%;
      animation: fadeInUp 0.6s ease;
      box-shadow: 0 0 60px rgba(34,197,94,0.1), var(--shadow-xl);
    }

    .confirm-card__icon {
      font-size: 4rem;
      margin-bottom: var(--space-xl);
      animation: pulse-ring 1.5s ease 1;
      display: inline-block;
    }

    .confirm-card h1 {
      font-family: var(--font-serif);
      font-size: 2.5rem;
      color: var(--color-text);
      margin-bottom: var(--space-lg);
    }

    .confirm-card h1 span { color: var(--color-success); }

    .confirm-card__desc {
      font-size: 16px;
      color: var(--color-text-muted);
      line-height: 1.7;
      margin-bottom: var(--space-xl);
    }

    .confirm-card__ref {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      padding: var(--space-lg);
      margin-bottom: var(--space-xl);
    }

    .confirm-card__ref-label {
      display: block;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: var(--color-text-muted);
      margin-bottom: 8px;
    }

    .confirm-card__ref-value {
      font-size: 1.5rem;
      font-weight: 800;
      color: var(--color-primary);
      letter-spacing: 3px;
      font-family: monospace;
    }

    .confirm-card__actions {
      display: flex;
      gap: var(--space-md);
      justify-content: center;
      flex-wrap: wrap;
      margin-bottom: var(--space-xl);
    }

    .confirm-card__details {
      display: grid;
      gap: var(--space-md);
      margin-bottom: var(--space-xl);
      text-align: left;
    }

    .confirm-card__detail-grid {
      display: grid;
      gap: var(--space-md);
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .confirm-card__detail-box {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      padding: var(--space-lg);
    }

    .confirm-card__detail-label {
      display: block;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: var(--color-text-muted);
      margin-bottom: 8px;
    }

    .confirm-card__detail-sub {
      display: block;
      margin-top: 6px;
      color: var(--color-text-muted);
      font-size: 14px;
    }

    .confirm-card__status {
      margin-bottom: var(--space-xl);
      color: var(--color-text-muted);
    }

    .confirm-card__status--error {
      color: #fca5a5;
      margin-bottom: 0;
    }

    .confirm-card__links {
      font-size: 14px;
      color: var(--color-text-muted);
    }

    .confirm-card__links a { font-weight: 600; }

    @media (max-width: 640px) {
      .confirm-card__detail-grid {
        grid-template-columns: 1fr;
      }
    }
  `],
})
export class BookingConfirmationComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private bookingService = inject(BookingService);
  bookingRef = '';
  booking: Booking | null = null;
  loading = true;
  error = '';

  ngOnInit() {
    this.bookingRef = this.route.snapshot.queryParamMap.get('ref') ?? '';
    if (!this.bookingRef) {
      this.loading = false;
      this.error = 'Booking reference is missing from the confirmation link.';
      return;
    }

    this.bookingService.getBookingByRef(this.bookingRef).subscribe({
      next: (booking) => {
        this.booking = booking;
        this.loading = false;
      },
      error: () => {
        this.error = 'We could not load your booking details right now.';
        this.loading = false;
      },
    });
  }
}
