import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActiveBookingService } from '../../../core/services/active-booking.service';

@Component({
  selector: 'app-active-booking-cta-bar',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (activeBookingService.activeHold()) {
      <aside class="active-booking-bar" aria-live="polite">
        <div class="active-booking-bar__content">
          <div class="active-booking-bar__copy">
            <p class="active-booking-bar__eyebrow">Active booking hold</p>
            <h3>You already have an active booking hold</h3>
            <p>
              Complete payment for
              <strong>{{ activeBookingService.activeHold()!.hotel_name }}</strong>
              within
              <strong>{{ countdownLabel() }}</strong>.
            </p>
          </div>

          <div class="active-booking-bar__actions">
            <button
              class="btn btn--primary btn--sm"
              type="button"
              [disabled]="!activeBookingService.canContinue()"
              (click)="activeBookingService.continueBooking()"
            >
              Continue Booking
            </button>
            <button
              class="btn btn--ghost btn--sm"
              type="button"
              (click)="activeBookingService.cancelActiveBooking()"
            >
              Cancel Booking
            </button>
          </div>
        </div>
      </aside>
    } @else if (activeBookingService.loadError()) {
      <aside class="active-booking-bar active-booking-bar--error" aria-live="polite">
        <div class="active-booking-bar__content">
          <div class="active-booking-bar__copy">
            <p class="active-booking-bar__eyebrow">Booking recovery</p>
            <h3>Unable to retrieve active booking</h3>
            <p>Please retry to check whether you still have a live hold.</p>
          </div>

          <div class="active-booking-bar__actions">
            <button class="btn btn--primary btn--sm" type="button" (click)="activeBookingService.retryLoad()">
              Retry
            </button>
          </div>
        </div>
      </aside>
    }

    @if (activeBookingService.toastMessage()) {
      <div class="active-booking-toast" role="status" aria-live="polite">
        {{ activeBookingService.toastMessage() }}
      </div>
    }
  `,
  styles: [`
    .active-booking-bar {
      position: fixed;
      left: 16px;
      right: 16px;
      bottom: 20px;
      z-index: calc(var(--z-nav) + 5);
      border: 1px solid rgba(208, 180, 90, 0.35);
      border-radius: 24px;
      background: rgba(16, 22, 40, 0.96);
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35);
      backdrop-filter: blur(20px);
    }

    .active-booking-bar--error {
      border-color: rgba(248, 113, 113, 0.35);
    }

    .active-booking-bar__content {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      padding: 18px 20px;
    }

    .active-booking-bar__copy h3 {
      margin: 0 0 6px;
      font-size: 1.05rem;
      color: var(--color-text);
    }

    .active-booking-bar__copy p {
      margin: 0;
      color: var(--color-text-muted);
      font-size: 0.95rem;
      line-height: 1.5;
    }

    .active-booking-bar__eyebrow {
      margin-bottom: 6px !important;
      color: var(--color-primary) !important;
      font-size: 0.8rem !important;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .active-booking-bar__actions {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-shrink: 0;
    }

    .active-booking-toast {
      position: fixed;
      left: 50%;
      bottom: 128px;
      transform: translateX(-50%);
      z-index: calc(var(--z-nav) + 6);
      padding: 12px 18px;
      border-radius: 999px;
      background: rgba(12, 17, 31, 0.96);
      border: 1px solid var(--color-border);
      color: var(--color-text);
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.35);
    }

    @media (max-width: 768px) {
      .active-booking-bar {
        left: 12px;
        right: 12px;
        bottom: 12px;
      }

      .active-booking-bar__content {
        flex-direction: column;
        align-items: stretch;
      }

      .active-booking-bar__actions {
        width: 100%;
      }

      .active-booking-bar__actions .btn {
        flex: 1;
      }

      .active-booking-toast {
        left: 12px;
        right: 12px;
        bottom: 144px;
        transform: none;
        text-align: center;
        border-radius: 18px;
      }
    }
  `],
})
export class ActiveBookingCtaBarComponent {
  protected readonly activeBookingService = inject(ActiveBookingService);

  countdownLabel(): string {
    const seconds = this.activeBookingService.remainingSeconds();
    const minutes = Math.floor(seconds / 60);
    const paddedSeconds = String(seconds % 60).padStart(2, '0');
    return `${String(minutes).padStart(2, '0')}:${paddedSeconds}`;
  }
}
