import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActiveBookingService } from '../../../core/services/active-booking.service';

@Component({
  selector: 'app-active-booking-cta-bar',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (activeBookingService.shouldShowActiveReservation()) {
      <section class="active-booking-shell" aria-live="polite">
        <aside class="active-booking-bar">
          <div class="active-booking-bar__content">
            <div class="active-booking-bar__status">
              <span class="active-booking-bar__pulse" aria-hidden="true"></span>
              <div>
                <p class="active-booking-bar__eyebrow">Active booking hold</p>
                <h3>You already have an active booking in progress</h3>
              </div>
            </div>

            <div class="active-booking-bar__details">
              <div class="active-booking-bar__hotel">
                <strong>{{ activeBookingService.activeHold()!.hotel_name }}</strong>
                <span>{{ activeBookingService.activeHold()!.room_name | titlecase }}</span>
              </div>
              <div class="active-booking-bar__meta">
                <span>{{ activeBookingService.activeHold()!.check_in }} to {{ activeBookingService.activeHold()!.check_out }}</span>
                <span>{{ activeBookingService.activeHold()!.guests }} guests</span>
              </div>
            </div>

            <div class="active-booking-bar__countdown" aria-label="Time remaining to complete booking">
              <span class="active-booking-bar__countdown-label">Complete payment within</span>
              <strong>{{ countdownLabel() }}</strong>
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
      </section>
    }

    @if (activeBookingService.toastMessage()) {
      <div class="active-booking-toast" role="status" aria-live="polite">
        {{ activeBookingService.toastMessage() }}
      </div>
    }
  `,
  styles: [`
    .active-booking-shell {
      position: sticky;
      top: 84px;
      z-index: calc(var(--z-nav) - 1);
      width: 100%;
      padding: 16px 16px 0;
      pointer-events: none;
    }

    .active-booking-bar {
      width: min(1240px, 100%);
      margin: 0 auto;
      border: 1px solid rgba(208, 180, 90, 0.28);
      border-radius: 28px;
      background:
        radial-gradient(circle at top left, rgba(214, 188, 92, 0.14), transparent 28%),
        linear-gradient(135deg, rgba(15, 20, 35, 0.98), rgba(21, 28, 48, 0.96));
      box-shadow: 0 22px 48px rgba(5, 8, 18, 0.34);
      backdrop-filter: blur(18px);
      pointer-events: auto;
    }
    .active-booking-bar__content {
      display: grid;
      align-items: center;
      grid-template-columns: minmax(240px, 1.2fr) minmax(220px, 1fr) auto auto;
      gap: 18px;
      padding: 18px 22px;
    }

    .active-booking-bar__status {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .active-booking-bar__pulse {
      width: 12px;
      height: 12px;
      border-radius: 999px;
      flex-shrink: 0;
      background: var(--color-primary);
      box-shadow: 0 0 0 0 rgba(214, 188, 92, 0.55);
      animation: active-booking-pulse 1.8s infinite;
    }

    .active-booking-bar__eyebrow {
      margin-bottom: 6px !important;
      color: var(--color-primary) !important;
      font-size: 0.8rem !important;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .active-booking-bar__status h3 {
      margin: 0;
      font-size: 1.1rem;
      color: var(--color-text);
      line-height: 1.2;
    }

    .active-booking-bar__details {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
      color: var(--color-text-muted);
    }

    .active-booking-bar__hotel {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .active-booking-bar__hotel strong,
    .active-booking-bar__countdown strong {
      color: var(--color-text);
    }

    .active-booking-bar__hotel strong {
      font-size: 1rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .active-booking-bar__hotel span,
    .active-booking-bar__meta span,
    .active-booking-bar__countdown-label {
      font-size: 0.92rem;
      color: var(--color-text-muted);
    }

    .active-booking-bar__meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 14px;
    }

    .active-booking-bar__countdown {
      display: flex;
      flex-direction: column;
      gap: 4px;
      align-items: flex-end;
      min-width: 130px;
      text-align: right;
    }

    .active-booking-bar__countdown strong {
      font-size: 1.5rem;
      line-height: 1;
      letter-spacing: 0.04em;
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
      top: 168px;
      transform: translateX(-50%);
      z-index: calc(var(--z-nav) + 8);
      padding: 12px 18px;
      border-radius: 999px;
      background: rgba(12, 17, 31, 0.96);
      border: 1px solid var(--color-border);
      color: var(--color-text);
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.35);
    }

    @keyframes active-booking-pulse {
      0% {
        box-shadow: 0 0 0 0 rgba(214, 188, 92, 0.5);
      }
      70% {
        box-shadow: 0 0 0 14px rgba(214, 188, 92, 0);
      }
      100% {
        box-shadow: 0 0 0 0 rgba(214, 188, 92, 0);
      }
    }

    @media (max-width: 1080px) {
      .active-booking-bar__content {
        grid-template-columns: minmax(220px, 1fr) minmax(180px, 0.9fr);
      }

      .active-booking-bar__countdown {
        align-items: flex-start;
        text-align: left;
      }

      .active-booking-bar__actions {
        grid-column: 1 / -1;
      }
    }

    @media (max-width: 768px) {
      .active-booking-shell {
        top: 74px;
        padding: 12px 12px 0;
      }

      .active-booking-bar__content {
        grid-template-columns: 1fr;
        align-items: stretch;
        padding: 16px;
        gap: 14px;
      }

      .active-booking-bar__actions {
        width: 100%;
        flex-direction: column;
      }

      .active-booking-bar__actions .btn {
        width: 100%;
      }

      .active-booking-bar__countdown {
        align-items: flex-start;
        text-align: left;
      }

      .active-booking-toast {
        left: 12px;
        right: 12px;
        top: 164px;
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
