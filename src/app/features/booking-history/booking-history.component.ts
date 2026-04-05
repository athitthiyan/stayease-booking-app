import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BookingService } from '../../core/services/booking.service';
import { Booking, MyBookingsResponse } from '../../core/models/booking.model';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';
import {
  ROOM_IMAGE_PLACEHOLDER,
  applyRoomImageFallback,
  normalizeRoomImageUrl,
} from '../../shared/utils/image-fallback';

type TabKey = 'all' | 'upcoming' | 'past' | 'cancelled';

@Component({
  selector: 'app-booking-history',
  standalone: true,
  imports: [CommonModule, RouterLink, NavbarComponent],
  template: `
    <app-navbar />

    <main class="bookings-page container">
      <div class="bookings-header">
        <h1>My Bookings</h1>
        @if (data()) {
          <div class="stats">
            <span class="stat">{{ data()!.upcoming }} upcoming</span>
            <span class="sep">·</span>
            <span class="stat">{{ data()!.past }} past</span>
            <span class="sep">·</span>
            <span class="stat">{{ data()!.cancelled }} cancelled</span>
          </div>
        }
      </div>

      <!-- Tabs -->
      <div class="tabs" role="tablist">
        @for (tab of tabs; track tab.key) {
          <button
            role="tab"
            class="tab"
            [class.active]="activeTab() === tab.key"
            (click)="setTab(tab.key)"
          >
            {{ tab.label }}
            @if (tabCount(tab.key) > 0) {
              <span class="badge">{{ tabCount(tab.key) }}</span>
            }
          </button>
        }
      </div>

      <!-- Loading -->
      @if (loading()) {
        <div class="state-loading">
          <div class="spinner"></div>
          <p>Loading your bookings…</p>
        </div>
      }

      <!-- Error -->
      @if (!loading() && errorMsg()) {
        <div class="state-error">
          <p>{{ errorMsg() }}</p>
          <button class="btn btn--ghost btn--sm" (click)="load()">Try again</button>
        </div>
      }

      <!-- Empty -->
      @if (!loading() && !errorMsg() && filteredBookings().length === 0) {
        <div class="state-empty">
          <span class="empty-icon">📋</span>
          <p>No bookings found</p>
          <a routerLink="/search" class="btn btn--primary btn--sm">Explore stays</a>
        </div>
      }

      <!-- Bookings list -->
      @if (!loading() && !errorMsg() && filteredBookings().length > 0) {
        <div class="bookings-list">
          @for (booking of filteredBookings(); track booking.id) {
            <article class="booking-card">
              @if (booking.room?.image_url) {
                <img
                  class="booking-img"
                  [src]="resolveRoomImage(booking.room!.image_url)"
                  [alt]="booking.room!.hotel_name"
                  loading="lazy"
                  (error)="onImageError($event)"
                />
              }
              <div class="booking-body">
                <div class="booking-top">
                  <div>
                    <h3>{{ booking.room?.hotel_name ?? 'Hotel' }}</h3>
                    <p class="location">{{ booking.room?.location }}</p>
                  </div>
                  <div class="booking-badges">
                    <span class="badge-status" [class]="'status-' + booking.status">
                      {{ booking.status }}
                    </span>
                    <span class="badge-payment" [class]="'payment-' + booking.payment_status">
                      {{ booking.payment_status }}
                    </span>
                  </div>
                </div>

                <div class="booking-details">
                  <div class="detail">
                    <span class="detail-label">Check-in</span>
                    <span>{{ formatDate(booking.check_in) }}</span>
                  </div>
                  <div class="detail">
                    <span class="detail-label">Check-out</span>
                    <span>{{ formatDate(booking.check_out) }}</span>
                  </div>
                  <div class="detail">
                    <span class="detail-label">Nights</span>
                    <span>{{ booking.nights }}</span>
                  </div>
                  <div class="detail">
                    <span class="detail-label">Guests</span>
                    <span>{{ booking.guests }}</span>
                  </div>
                </div>

                <div class="booking-footer">
                  <div class="ref">Ref: <strong>{{ booking.booking_ref }}</strong></div>
                  <div class="total">Total: <strong>{{ booking.total_amount | currency }}</strong></div>
                </div>

                @if (hasRefundTimeline(booking)) {
                  <div class="refund-timeline">
                    <div class="refund-timeline__header">
                      <strong>Refund timeline</strong>
                      <span class="refund-status">{{ refundStatusLabel(booking) }}</span>
                    </div>
                    <div class="refund-timeline__meta">
                      <span>Amount: {{ refundAmount(booking) | currency }}</span>
                      @if (booking.refund_expected_settlement_at && booking.refund_status !== 'refund_success') {
                        <span>Expected settlement: {{ formatDateTime(booking.refund_expected_settlement_at) }}</span>
                      }
                      @if (booking.refund_gateway_reference) {
                        <span>Reference: {{ booking.refund_gateway_reference }}</span>
                      }
                    </div>
                    <ul class="refund-timeline__steps">
                      <li [class.is-complete]="!!booking.refund_requested_at">
                        Refund requested
                        @if (booking.refund_requested_at) {
                          <span>{{ formatDateTime(booking.refund_requested_at) }}</span>
                        }
                      </li>
                      <li [class.is-complete]="isRefundStepComplete(booking, 'initiated')">
                        Bank processing
                        @if (booking.refund_initiated_at) {
                          <span>{{ formatDateTime(booking.refund_initiated_at) }}</span>
                        }
                      </li>
                      <li [class.is-complete]="booking.refund_status === 'refund_success'">
                        Refund completed
                        @if (booking.refund_completed_at) {
                          <span>{{ formatDateTime(booking.refund_completed_at) }}</span>
                        }
                      </li>
                    </ul>
                    @if (booking.refund_status === 'refund_failed') {
                      <p class="refund-timeline__issue">
                        Refund failed: {{ booking.refund_failed_reason || 'Please contact support for help.' }}
                      </p>
                    }
                    @if (booking.refund_status === 'refund_reversed') {
                      <p class="refund-timeline__issue">
                        Refund reversed: {{ booking.refund_failed_reason || 'Manual finance correction applied.' }}
                      </p>
                    }
                  </div>
                }

                @if (actionMessage() && busyBookingId() === booking.id) {
                  <p class="booking-feedback booking-feedback--success">{{ actionMessage() }}</p>
                }

                @if (actionError() && busyBookingId() === booking.id) {
                  <p class="booking-feedback booking-feedback--error">{{ actionError() }}</p>
                }

                <div class="booking-actions">
                  @if (canResumeBooking(booking)) {
                    <a class="btn btn--primary btn--sm" [routerLink]="['/checkout', booking.id]">
                      Continue Payment
                    </a>
                    <button
                      type="button"
                      class="btn btn--ghost btn--sm"
                      [disabled]="busyBookingId() === booking.id"
                      (click)="cancelPendingBooking(booking)"
                    >
                      Cancel Hold
                    </button>
                  } @else if (canRequestCancellationHelp(booking)) {
                    <button
                      type="button"
                      class="btn btn--primary btn--sm"
                      [disabled]="busyBookingId() === booking.id"
                      (click)="requestCancellationHelp(booking)"
                    >
                      Need Cancellation Help
                    </button>
                    <a class="btn btn--ghost btn--sm" routerLink="/cancellation-policy">
                      View Policy
                    </a>
                  }

                  @if (canDownloadDocuments(booking)) {
                    <button
                      type="button"
                      class="btn btn--ghost btn--sm"
                      [disabled]="busyBookingId() === booking.id"
                      (click)="downloadInvoice(booking)"
                    >
                      Invoice
                    </button>
                    <button
                      type="button"
                      class="btn btn--ghost btn--sm"
                      [disabled]="busyBookingId() === booking.id"
                      (click)="downloadVoucher(booking)"
                    >
                      Voucher
                    </button>
                  }
                </div>
              </div>
            </article>
          }
        </div>
      }
    </main>

  `,
  styles: [`
    .bookings-page {
      padding-top: 120px;
      padding-bottom: var(--space-4xl);
      min-height: 100vh;
    }

    .bookings-header {
      margin-bottom: var(--space-xl);
    }

    .bookings-header h1 { font-size: 1.8rem; font-weight: 700; margin: 0 0 8px; }

    .stats {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--color-text-muted);
      font-size: 14px;
    }
    .sep { color: var(--color-border); }

    .tabs {
      display: flex;
      gap: 4px;
      margin-bottom: var(--space-xl);
      border-bottom: 1px solid var(--color-border);
    }

    .tab {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 10px 16px;
      background: none;
      color: var(--color-text-muted);
      font-size: 14px;
      font-weight: 500;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
      transition: all var(--transition-fast);
      cursor: pointer;
    }

    .tab:hover { color: var(--color-text); }
    .tab.active { color: var(--color-primary); border-bottom-color: var(--color-primary); }

    .badge {
      background: var(--color-primary);
      color: #000;
      font-size: 11px;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 99px;
    }

    .state-loading, .state-error, .state-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--space-lg);
      padding: 80px 20px;
      color: var(--color-text-muted);
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid var(--color-border);
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    .empty-icon { font-size: 3rem; }

    .bookings-list {
      display: flex;
      flex-direction: column;
      gap: var(--space-lg);
    }

    .booking-card {
      display: flex;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-xl);
      overflow: hidden;
      transition: border-color var(--transition-fast);
    }

    .booking-card:hover { border-color: var(--color-primary); }

    .booking-img {
      width: 180px;
      object-fit: cover;
      flex-shrink: 0;
    }

    .booking-body {
      flex: 1;
      padding: var(--space-lg);
      display: flex;
      flex-direction: column;
      gap: var(--space-md);
    }

    .booking-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: var(--space-md);
    }

    .booking-top h3 { font-size: 1.1rem; font-weight: 600; margin: 0 0 4px; }
    .location { color: var(--color-text-muted); font-size: 13px; margin: 0; }

    .booking-badges { display: flex; gap: 6px; flex-wrap: wrap; }

    .badge-status, .badge-payment {
      font-size: 11px;
      font-weight: 600;
      padding: 3px 10px;
      border-radius: 99px;
      text-transform: capitalize;
    }

    .status-confirmed { background: rgba(34,197,94,0.15); color: #4ade80; }
    .status-pending   { background: rgba(251,191,36,0.15); color: #fbbf24; }
    .status-cancelled { background: rgba(239,68,68,0.15);  color: #f87171; }
    .status-completed { background: rgba(99,102,241,0.15); color: #818cf8; }
    .status-expired   { background: rgba(107,114,128,0.15); color: #9ca3af; }

    .payment-paid     { background: rgba(34,197,94,0.15); color: #4ade80; }
    .payment-pending  { background: rgba(251,191,36,0.15); color: #fbbf24; }
    .payment-failed   { background: rgba(239,68,68,0.15);  color: #f87171; }
    .payment-refunded { background: rgba(99,102,241,0.15); color: #818cf8; }

    .booking-details {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: var(--space-md);
    }

    .detail { display: flex; flex-direction: column; gap: 2px; }
    .detail-label { font-size: 11px; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.05em; }

    .booking-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: var(--space-sm);
      border-top: 1px solid var(--color-border);
      font-size: 13px;
      color: var(--color-text-muted);
    }

    .booking-actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 4px;
    }

    .refund-timeline {
      border: 1px solid rgba(129, 140, 248, 0.25);
      border-radius: 16px;
      padding: 14px;
      background: rgba(99, 102, 241, 0.08);
    }

    .refund-timeline__header,
    .refund-timeline__meta {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
    }

    .refund-timeline__meta {
      margin-top: 8px;
      color: var(--color-text-muted);
      font-size: 12px;
    }

    .refund-status {
      font-size: 12px;
      text-transform: capitalize;
      color: #c4b5fd;
    }

    .refund-timeline__steps {
      list-style: none;
      margin: 12px 0 0;
      padding: 0;
      display: grid;
      gap: 10px;
    }

    .refund-timeline__steps li {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      color: var(--color-text-muted);
      font-size: 13px;
    }

    .refund-timeline__steps li.is-complete {
      color: #bfdbfe;
      font-weight: 600;
    }

    .refund-timeline__issue {
      margin: 10px 0 0;
      color: #fda4af;
      font-size: 13px;
    }

    .booking-feedback {
      margin: 0;
      font-size: 13px;
    }

    .booking-feedback--success { color: #4ade80; }
    .booking-feedback--error { color: #f87171; }

    @media (max-width: 640px) {
      .booking-card { flex-direction: column; }
      .booking-img { width: 100%; height: 160px; }
      .booking-details { grid-template-columns: repeat(2, 1fr); }
    }
  `],
})
export class BookingHistoryComponent implements OnInit {
  private bookingService = inject(BookingService);
  protected readonly placeholderImg = ROOM_IMAGE_PLACEHOLDER;

  data = signal<MyBookingsResponse | null>(null);
  loading = signal(true);
  errorMsg = signal('');
  activeTab = signal<TabKey>('all');
  actionMessage = signal('');
  actionError = signal('');
  busyBookingId = signal<number | null>(null);

  readonly tabs: { key: TabKey; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'past', label: 'Past' },
    { key: 'cancelled', label: 'Cancelled' },
  ];

  resolveRoomImage(imageUrl?: string): string {
    return normalizeRoomImageUrl(imageUrl) || this.placeholderImg;
  }

  onImageError(event: Event): void {
    applyRoomImageFallback(event);
  }

  ngOnInit(): void {
    this.load();
  }

  load(preserveActionState = false): void {
    this.loading.set(true);
    this.errorMsg.set('');
    if (!preserveActionState) {
      this.actionMessage.set('');
      this.actionError.set('');
      this.busyBookingId.set(null);
    }

    this.bookingService.getMyBookings().subscribe({
      next: res => {
        this.data.set(res);
        this.loading.set(false);
      },
      error: () => {
        this.errorMsg.set('Unable to load bookings. Please try again.');
        this.loading.set(false);
      },
    });
  }

  setTab(tab: TabKey): void {
    this.activeTab.set(tab);
  }

  filteredBookings(): Booking[] {
    const bookings = this.data()?.bookings ?? [];
    const tab = this.activeTab();
    if (tab === 'all') return bookings;
    if (tab === 'upcoming') {
      return bookings.filter(
        b =>
          b.status === 'confirmed' &&
          new Date(b.check_out) >= new Date()
      );
    }
    if (tab === 'past') {
      return bookings.filter(
        b =>
          b.status === 'completed' ||
          (b.status === 'confirmed' && new Date(b.check_out) < new Date())
      );
    }
    return bookings.filter(
      b => b.status === 'cancelled'
    );
  }

  tabCount(tab: TabKey): number {
    if (tab === 'all') return this.data()?.total ?? 0;
    if (tab === 'upcoming') return this.data()?.upcoming ?? 0;
    if (tab === 'past') return this.data()?.past ?? 0;
    return this.data()?.cancelled ?? 0;
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  canResumeBooking(booking: Booking): boolean {
    if (booking.payment_status === 'paid' || booking.status === 'confirmed') {
      return false;
    }
    if (!booking.hold_expires_at) {
      return false;
    }
    return new Date(booking.hold_expires_at).getTime() > Date.now();
  }

  canRequestCancellationHelp(booking: Booking): boolean {
    if (booking.status !== 'confirmed' || booking.payment_status !== 'paid') {
      return false;
    }
    return new Date(booking.check_out).getTime() >= Date.now();
  }

  cancelPendingBooking(booking: Booking): void {
    this.busyBookingId.set(booking.id);
    this.actionMessage.set('');
    this.actionError.set('');
    this.bookingService.cancelBooking(booking.id).subscribe({
      next: () => {
        this.actionMessage.set('Your booking hold was cancelled and inventory has been released.');
        this.load(true);
      },
      error: () => {
        this.actionError.set('We could not cancel this hold right now. Please try again.');
      },
    });
  }

  requestCancellationHelp(booking: Booking): void {
    this.busyBookingId.set(booking.id);
    this.actionMessage.set('');
    this.actionError.set('');
    this.bookingService
      .requestBookingSupport(
        booking.id,
        'cancellation_help',
        `Guest requested cancellation/refund assistance for booking ${booking.booking_ref}.`,
      )
      .subscribe({
        next: response => {
          this.actionMessage.set(response.message);
        },
        error: () => {
          this.actionError.set(
            'We could not send your support request right now. Please email support@stayvora.co.in.',
          );
        },
      });
  }

  canDownloadDocuments(booking: Booking): boolean {
    return booking.payment_status === 'paid' || booking.payment_status === 'refunded';
  }

  hasRefundTimeline(booking: Booking): boolean {
    return !!booking.refund_status;
  }

  refundStatusLabel(booking: Booking): string {
    return (booking.refund_status || 'refund_requested')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, character => character.toUpperCase());
  }

  refundAmount(booking: Booking): number {
    return booking.refund_amount ?? booking.total_amount;
  }

  isRefundStepComplete(booking: Booking, step: 'initiated'): boolean {
    if (step === 'initiated') {
      return !!booking.refund_initiated_at
        || booking.refund_status === 'refund_processing'
        || booking.refund_status === 'refund_success'
        || booking.refund_status === 'refund_failed'
        || booking.refund_status === 'refund_reversed';
    }
    return false;
  }

  formatDateTime(dateStr: string): string {
    return new Date(dateStr).toLocaleString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  downloadInvoice(booking: Booking): void {
    this.busyBookingId.set(booking.id);
    this.actionError.set('');
    this.bookingService.downloadInvoice(booking.id).subscribe({
      next: blob => {
        this.actionMessage.set('Invoice download started.');
        this.saveDocument(blob, `invoice-${booking.booking_ref}.pdf`);
      },
      error: () => {
        this.actionError.set('We could not download the invoice right now. Please try again.');
      },
    });
  }

  downloadVoucher(booking: Booking): void {
    this.busyBookingId.set(booking.id);
    this.actionError.set('');
    this.bookingService.downloadVoucher(booking.id).subscribe({
      next: blob => {
        this.actionMessage.set('Voucher download started.');
        this.saveDocument(blob, `voucher-${booking.booking_ref}.pdf`);
      },
      error: () => {
        this.actionError.set('We could not download the voucher right now. Please try again.');
      },
    });
  }

  private saveDocument(blob: Blob, filename: string): void {
    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(downloadUrl);
  }
}
