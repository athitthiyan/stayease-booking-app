import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';

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

          <div class="confirm-card__actions">
            <a routerLink="/" class="btn btn--primary btn--lg">Back to Home</a>
            <a routerLink="/search" class="btn btn--secondary btn--lg">Browse More Rooms</a>
          </div>

          <div class="confirm-card__links">
            <p>View the payment for this booking at:</p>
            <a href="https://payflow-gateway.vercel.app" target="_blank" class="text-gold">
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

      &__bg {
        position: absolute;
        inset: 0;
        background: var(--gradient-hero);
        &::after {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at center, rgba(34,197,94,0.08) 0%, transparent 60%);
        }
      }

      &__content {
        position: relative;
        z-index: 1;
        display: flex;
        justify-content: center;
      }
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

      &__icon {
        font-size: 4rem;
        margin-bottom: var(--space-xl);
        animation: pulse-ring 1.5s ease 1;
        display: inline-block;
      }

      h1 {
        font-family: var(--font-serif);
        font-size: 2.5rem;
        color: var(--color-text);
        margin-bottom: var(--space-lg);
        span { color: var(--color-success); }
      }

      &__desc {
        font-size: 16px;
        color: var(--color-text-muted);
        line-height: 1.7;
        margin-bottom: var(--space-xl);
      }

      &__ref {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        padding: var(--space-lg);
        margin-bottom: var(--space-xl);

        &-label {
          display: block;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 2px;
          color: var(--color-text-muted);
          margin-bottom: 8px;
        }

        &-value {
          font-size: 1.5rem;
          font-weight: 800;
          color: var(--color-primary);
          letter-spacing: 3px;
          font-family: monospace;
        }
      }

      &__actions {
        display: flex;
        gap: var(--space-md);
        justify-content: center;
        flex-wrap: wrap;
        margin-bottom: var(--space-xl);
      }

      &__links {
        font-size: 14px;
        color: var(--color-text-muted);
        a { font-weight: 600; }
      }
    }
  `],
})
export class BookingConfirmationComponent implements OnInit {
  private route = inject(ActivatedRoute);
  bookingRef = '';

  ngOnInit() {
    this.bookingRef = this.route.snapshot.queryParamMap.get('ref') || 'BK12345678';
  }
}
