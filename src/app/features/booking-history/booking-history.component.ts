import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { BookingService } from '../../core/services/booking.service';
import { Booking, MyBookingsResponse } from '../../core/models/booking.model';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';
import {
  ROOM_IMAGE_PLACEHOLDER,
  applyRoomImageFallback,
  normalizeRoomImageUrl,
} from '../../shared/utils/image-fallback';
import { BookingFilterService } from '../../core/services/booking-filter.service';
import { PlatformSyncService } from '../../core/services/platform-sync.service';

type TabKey = 'upcoming' | 'past' | 'cancelled' | 'expired';

@Component({
  selector: 'app-booking-history',
  standalone: true,
  imports: [CommonModule, RouterLink, NavbarComponent, FormsModule],
  template: `
    <app-navbar />

    <main class="bookings-page container">
      <!-- Header -->
      <div class="bookings-hero">
        <h1 class="bookings-hero__title">My Bookings</h1>
        @if (data()) {
          <div class="bookings-hero__stats">
            <div class="stat-pill stat-pill--upcoming">
              <span class="stat-pill__count">{{ data()!.upcoming }}</span>
              <span class="stat-pill__label">Upcoming</span>
            </div>
            <div class="stat-pill stat-pill--past">
              <span class="stat-pill__count">{{ data()!.past }}</span>
              <span class="stat-pill__label">Past</span>
            </div>
            <div class="stat-pill stat-pill--cancelled">
              <span class="stat-pill__count">{{ data()!.cancelled }}</span>
              <span class="stat-pill__label">Cancelled</span>
            </div>
            @if (tabCount('expired') > 0) {
              <div class="stat-pill stat-pill--expired">
                <span class="stat-pill__count">{{ tabCount('expired') }}</span>
                <span class="stat-pill__label">Expired</span>
              </div>
            }
          </div>
        }
      </div>

      <!-- Tabs (no more "All") -->
      <nav class="tabs" role="tablist">
        @for (tab of tabs; track tab.key) {
          <button
            role="tab"
            class="tab"
            [class.tab--active]="activeTab() === tab.key"
            [attr.aria-selected]="activeTab() === tab.key"
            (click)="setTab(tab.key)"
          >
            <span class="tab__icon">{{ tab.icon }}</span>
            {{ tab.label }}
            @if (tabCount(tab.key) > 0) {
              <span class="tab__badge">{{ tabCount(tab.key) }}</span>
            }
          </button>
        }
      </nav>

      <!-- Loading -->
      @if (loading()) {
        <div class="state-center">
          <div class="spinner"></div>
          <p>Loading your bookings…</p>
        </div>
      }

      <!-- Error -->
      @if (!loading() && errorMsg()) {
        <div class="state-center state-center--error">
          <span class="state-icon">⚠</span>
          <p>{{ errorMsg() }}</p>
          <button class="btn btn--ghost btn--sm" (click)="load()">Try again</button>
        </div>
      }

      <!-- Empty per-tab -->
      @if (!loading() && !errorMsg() && filteredBookings().length === 0) {
        <div class="state-center">
          <span class="state-icon">{{ emptyIcon() }}</span>
          <h3>{{ emptyTitle() }}</h3>
          <p class="state-subtitle">{{ emptySubtitle() }}</p>
          <a routerLink="/search" class="btn btn--primary btn--sm">Explore stays</a>
        </div>
      }

      <!-- Bookings list -->
      @if (!loading() && !errorMsg() && filteredBookings().length > 0) {
        <div class="bookings-list">
          @for (booking of paginatedBookings(); track booking.id) {
            <article class="bk-card" [class.bk-card--featured]="booking.status === 'confirmed'">
              <!-- Image -->
              @if (booking.room?.image_url) {
                <div class="bk-card__visual">
                  <img
                    class="bk-card__img"
                    [src]="resolveRoomImage(booking.room!.image_url)"
                    [alt]="booking.room!.hotel_name"
                    loading="lazy"
                    (error)="onImageError($event)"
                  />
                  <div class="bk-card__overlay">
                    <span class="bk-card__status" [class]="'bk-status--' + booking.status">
                      {{ statusLabel(booking.status) }}
                    </span>
                  </div>
                </div>
              }

              <div class="bk-card__body">
                <!-- Top row -->
                <div class="bk-card__top">
                  <div>
                    <h3 class="bk-card__hotel">{{ booking.room?.hotel_name ?? 'Hotel' }}</h3>
                    <p class="bk-card__location">{{ booking.room?.location }}</p>
                  </div>
                  <span class="bk-card__payment" [class]="'bk-pay--' + booking.payment_status">
                    {{ booking.payment_status }}
                  </span>
                </div>

                <!-- Stay details -->
                <div class="bk-card__details">
                  <div class="bk-detail">
                    <span class="bk-detail__label">Check-in</span>
                    <span class="bk-detail__value">{{ formatDate(booking.check_in) }}</span>
                  </div>
                  <div class="bk-detail">
                    <span class="bk-detail__label">Check-out</span>
                    <span class="bk-detail__value">{{ formatDate(booking.check_out) }}</span>
                  </div>
                  <div class="bk-detail">
                    <span class="bk-detail__label">Nights</span>
                    <span class="bk-detail__value">{{ booking.nights }}</span>
                  </div>
                  <div class="bk-detail">
                    <span class="bk-detail__label">Guests</span>
                    <span class="bk-detail__value">{{ booking.guests }}</span>
                  </div>
                </div>

                <!-- Status Timeline -->
                <div class="status-timeline">
                  @for (step of getTimelineSteps(booking); track step.label) {
                    <div class="tl-step" [class.tl-step--done]="step.done" [class.tl-step--current]="step.current">
                      <div class="tl-step__dot"></div>
                      <div class="tl-step__info">
                        <span class="tl-step__label">{{ step.label }}</span>
                        @if (step.date) {
                          <span class="tl-step__date">{{ step.date }}</span>
                        }
                      </div>
                    </div>
                  }
                </div>

                <!-- Footer -->
                <div class="bk-card__footer">
                  <div class="bk-card__ref">Ref: <strong>{{ booking.booking_ref }}</strong></div>
                  <div class="bk-card__total">₹{{ booking.total_amount | number:'1.2-2' }}</div>
                </div>

                <!-- Refund Timeline (if applicable) -->
                @if (hasRefundTimeline(booking)) {
                  <div class="refund-block">
                    <div class="refund-block__header">
                      <strong>Refund Progress</strong>
                      <span class="refund-block__status">{{ refundStatusLabel(booking) }}</span>
                    </div>
                    <div class="refund-block__meta">
                      <span>Amount: {{ refundAmount(booking) | currency }}</span>
                      @if (booking.refund_expected_settlement_at && booking.refund_status !== 'refund_success') {
                        <span>Expected: {{ formatDateTime(booking.refund_expected_settlement_at) }}</span>
                      }
                      @if (booking.refund_gateway_reference) {
                        <span>Ref: {{ booking.refund_gateway_reference }}</span>
                      }
                    </div>
                    <div class="refund-block__steps">
                      <div class="refund-step" [class.refund-step--done]="!!booking.refund_requested_at">
                        <div class="refund-step__dot"></div>
                        <span>Requested</span>
                        @if (booking.refund_requested_at) { <span class="refund-step__date">{{ formatDateTime(booking.refund_requested_at) }}</span> }
                      </div>
                      <div class="refund-step" [class.refund-step--done]="isRefundStepComplete(booking, 'initiated')">
                        <div class="refund-step__dot"></div>
                        <span>Processing</span>
                        @if (booking.refund_initiated_at) { <span class="refund-step__date">{{ formatDateTime(booking.refund_initiated_at) }}</span> }
                      </div>
                      <div class="refund-step" [class.refund-step--done]="booking.refund_status === 'refund_success'">
                        <div class="refund-step__dot"></div>
                        <span>Completed</span>
                        @if (booking.refund_completed_at) { <span class="refund-step__date">{{ formatDateTime(booking.refund_completed_at) }}</span> }
                      </div>
                    </div>
                    @if (booking.refund_status === 'refund_failed') {
                      <p class="refund-block__issue">Refund failed: {{ booking.refund_failed_reason || 'Please contact support.' }}</p>
                    }
                    @if (booking.refund_status === 'refund_reversed') {
                      <p class="refund-block__issue">Refund reversed: {{ booking.refund_failed_reason || 'Manual correction applied.' }}</p>
                    }
                  </div>
                }

                <!-- Feedback -->
                @if (actionMessage() && busyBookingId() === booking.id) {
                  <p class="bk-feedback bk-feedback--success">{{ actionMessage() }}</p>
                }
                @if (actionError() && busyBookingId() === booking.id) {
                  <p class="bk-feedback bk-feedback--error">{{ actionError() }}</p>
                }

                <!-- Actions -->
                <div class="bk-card__actions">
                  @if (canResumeBooking(booking)) {
                    <a class="btn btn--primary btn--sm" [routerLink]="['/checkout', booking.id]">Continue Payment</a>
                    <button type="button" class="btn btn--ghost btn--sm" [disabled]="busyBookingId() === booking.id" (click)="cancelPendingBooking(booking)">Cancel Hold</button>
                  } @else if (canRequestCancellationHelp(booking)) {
                    <button type="button" class="btn btn--primary btn--sm" [disabled]="busyBookingId() === booking.id" (click)="requestCancellationHelp(booking)">Cancellation Help</button>
                    <a class="btn btn--ghost btn--sm" routerLink="/cancellation-policy">View Policy</a>
                  }

                  @if (canDownloadDocuments(booking)) {
                    <button type="button" class="btn btn--ghost btn--sm" [disabled]="busyBookingId() === booking.id" (click)="downloadInvoice(booking)">Invoice</button>
                    <button type="button" class="btn btn--ghost btn--sm" [disabled]="busyBookingId() === booking.id" (click)="downloadVoucher(booking)">Voucher</button>
                  }
                </div>
              </div>
            </article>
          }
        </div>

        <!-- Pagination -->
        @if (totalPages() > 1) {
          <nav class="pagination" aria-label="Booking list pagination">
            <button
              class="pagination__btn"
              [disabled]="currentPage() === 1"
              (click)="goToPage(currentPage() - 1)"
              aria-label="Previous page"
            >‹ Prev</button>

            @for (p of pageNumbers; track p) {
              <button
                class="pagination__num"
                [class.pagination__num--active]="p === currentPage()"
                (click)="goToPage(p)"
                [attr.aria-current]="p === currentPage() ? 'page' : null"
              >{{ p }}</button>
            }

            <button
              class="pagination__btn"
              [disabled]="currentPage() === totalPages()"
              (click)="goToPage(currentPage() + 1)"
              aria-label="Next page"
            >Next ›</button>

            <select class="pagination__size" [ngModel]="pageSize()" (ngModelChange)="updatePageSize($event)">
              <option [ngValue]="5">5 / page</option>
              <option [ngValue]="10">10 / page</option>
              <option [ngValue]="20">20 / page</option>
            </select>
          </nav>
        }
      }
    </main>
  `,
  styles: [`
    /* ═══ Bookings Page — Premium Hospitality UX ═══ */

    .bookings-page {
      padding-top: 120px;
      padding-bottom: var(--space-4xl);
      min-height: 100vh;
      max-width: 960px;
      margin: 0 auto;
    }

    /* ── Hero ── */
    .bookings-hero {
      margin-bottom: var(--space-xl);
    }

    .bookings-hero__title {
      font-family: var(--font-serif);
      font-size: 2rem;
      font-weight: 700;
      margin: 0 0 16px;
    }

    .bookings-hero__stats {
      display: flex;
      gap: 12px;
    }

    .stat-pill {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 12px 20px;
      border-radius: var(--radius-lg);
      border: 1px solid var(--color-border);
      background: rgba(255,255,255,0.02);
      min-width: 90px;
      transition: border-color var(--transition-fast);
    }
    .stat-pill:hover { border-color: var(--color-primary); }
    .stat-pill__count { font-size: 1.4rem; font-weight: 700; }
    .stat-pill__label { font-size: .68rem; text-transform: uppercase; letter-spacing: .08em; color: var(--color-text-muted); margin-top: 2px; }
    .stat-pill--upcoming .stat-pill__count { color: #4ade80; }
    .stat-pill--past .stat-pill__count { color: #818cf8; }
    .stat-pill--cancelled .stat-pill__count { color: #f87171; }
    .stat-pill--expired .stat-pill__count { color: #9ca3af; }

    /* ── Tabs ── */
    .tabs {
      display: flex;
      gap: 4px;
      margin-bottom: var(--space-xl);
      border-bottom: 1px solid var(--color-border);
    }

    .tab {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 20px;
      background: none;
      color: var(--color-text-muted);
      font-size: 14px;
      font-weight: 500;
      border: none;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
      transition: all var(--transition-fast);
      cursor: pointer;
    }

    .tab:hover { color: var(--color-text); }

    .tab--active {
      color: var(--color-primary);
      border-bottom-color: var(--color-primary);
    }

    .tab__icon { font-size: 1rem; }
    .tab__badge {
      background: var(--color-primary);
      color: #000;
      font-size: 11px;
      font-weight: 700;
      padding: 1px 7px;
      border-radius: 99px;
    }

    /* ── States ── */
    .state-center {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--space-md);
      padding: 80px 20px;
      color: var(--color-text-muted);
      text-align: center;
    }

    .state-icon { font-size: 3rem; }
    .state-center h3 { font-size: 1.2rem; color: var(--color-text); margin: 0; }
    .state-subtitle { font-size: .85rem; color: var(--color-text-muted); margin: 0; }

    .spinner {
      width: 36px; height: 36px;
      border: 3px solid var(--color-border);
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Booking Cards ── */
    .bookings-list {
      display: flex;
      flex-direction: column;
      gap: var(--space-lg);
    }

    .bk-card {
      display: flex;
      background: rgba(255,255,255,0.02);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-xl);
      overflow: hidden;
      transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
    }

    .bk-card:hover {
      border-color: rgba(214,184,107,0.3);
      box-shadow: 0 4px 24px rgba(0,0,0,0.2);
    }

    .bk-card--featured {
      border-color: rgba(214,184,107,0.15);
    }

    .bk-card__visual {
      position: relative;
      width: 200px;
      flex-shrink: 0;
    }

    .bk-card__img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .bk-card__overlay {
      position: absolute;
      top: 10px;
      left: 10px;
    }

    .bk-card__status {
      font-size: .65rem;
      font-weight: 700;
      padding: 4px 12px;
      border-radius: var(--radius-full);
      text-transform: uppercase;
      letter-spacing: .06em;
      backdrop-filter: blur(8px);
    }

    .bk-status--confirmed { background: rgba(34,197,94,0.2); color: #4ade80; border: 1px solid rgba(34,197,94,0.3); }
    .bk-status--pending   { background: rgba(251,191,36,0.2); color: #fbbf24; border: 1px solid rgba(251,191,36,0.3); }
    .bk-status--cancelled { background: rgba(239,68,68,0.2);  color: #f87171; border: 1px solid rgba(239,68,68,0.3); }
    .bk-status--completed { background: rgba(99,102,241,0.2); color: #818cf8; border: 1px solid rgba(99,102,241,0.3); }
    .bk-status--expired   { background: rgba(107,114,128,0.2); color: #9ca3af; border: 1px solid rgba(107,114,128,0.3); }

    .bk-card__body {
      flex: 1;
      padding: var(--space-lg);
      display: flex;
      flex-direction: column;
      gap: var(--space-md);
      min-width: 0;
    }

    .bk-card__top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: var(--space-md);
    }

    .bk-card__hotel {
      font-family: var(--font-serif);
      font-size: 1.1rem;
      font-weight: 600;
      margin: 0 0 2px;
    }

    .bk-card__location { color: var(--color-text-muted); font-size: .78rem; margin: 0; }

    .bk-card__payment {
      font-size: .62rem;
      font-weight: 600;
      padding: 3px 10px;
      border-radius: 99px;
      text-transform: capitalize;
      flex-shrink: 0;
    }

    .bk-pay--paid     { background: rgba(34,197,94,0.15); color: #4ade80; }
    .bk-pay--pending  { background: rgba(251,191,36,0.15); color: #fbbf24; }
    .bk-pay--failed   { background: rgba(239,68,68,0.15);  color: #f87171; }
    .bk-pay--refunded { background: rgba(99,102,241,0.15); color: #818cf8; }

    /* ── Details Grid ── */
    .bk-card__details {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: var(--space-md);
    }

    .bk-detail { display: flex; flex-direction: column; gap: 2px; }
    .bk-detail__label {
      font-size: .62rem;
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: .06em;
      font-weight: 600;
    }
    .bk-detail__value { font-size: .85rem; font-weight: 500; }

    /* ── Status Timeline ── */
    .status-timeline {
      display: flex;
      align-items: flex-start;
      gap: 0;
      position: relative;
      padding: 8px 0;
    }

    .tl-step {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      position: relative;
      text-align: center;

      &::before {
        content: '';
        position: absolute;
        top: 7px;
        left: -50%;
        right: 50%;
        height: 2px;
        background: var(--color-border);
        z-index: 0;
      }

      &:first-child::before { display: none; }
    }

    .tl-step--done::before { background: var(--color-primary); }
    .tl-step--current::before { background: linear-gradient(90deg, var(--color-primary), var(--color-border)); }

    .tl-step__dot {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: var(--color-border);
      border: 2px solid var(--color-bg, #0b1622);
      z-index: 1;
      transition: all var(--transition-fast);
    }

    .tl-step--done .tl-step__dot {
      background: var(--color-primary);
      box-shadow: 0 0 8px rgba(214,184,107,0.4);
    }

    .tl-step--current .tl-step__dot {
      background: var(--color-primary);
      box-shadow: 0 0 12px rgba(214,184,107,0.6);
      animation: pulse-dot 2s ease-in-out infinite;
    }

    @keyframes pulse-dot {
      0%, 100% { box-shadow: 0 0 8px rgba(214,184,107,0.4); }
      50% { box-shadow: 0 0 16px rgba(214,184,107,0.7); }
    }

    .tl-step__info {
      display: flex;
      flex-direction: column;
      margin-top: 6px;
    }

    .tl-step__label {
      font-size: .65rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: .05em;
      color: var(--color-text-muted);
    }

    .tl-step--done .tl-step__label { color: var(--color-text); }
    .tl-step--current .tl-step__label { color: var(--color-primary); }

    .tl-step__date {
      font-size: .58rem;
      color: var(--color-text-subtle);
      margin-top: 1px;
    }

    /* ── Footer ── */
    .bk-card__footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: var(--space-sm);
      border-top: 1px solid var(--color-border);
    }

    .bk-card__ref { font-size: .75rem; color: var(--color-text-muted); }
    .bk-card__total { font-size: 1.1rem; font-weight: 700; color: var(--color-primary-light); }

    /* ── Actions ── */
    .bk-card__actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }

    /* ── Refund Block ── */
    .refund-block {
      border: 1px solid rgba(129, 140, 248, 0.2);
      border-radius: var(--radius-lg);
      padding: 14px;
      background: rgba(99, 102, 241, 0.05);
    }

    .refund-block__header {
      display: flex; justify-content: space-between; align-items: center;
      font-size: .82rem;
    }
    .refund-block__status { font-size: .72rem; text-transform: capitalize; color: #c4b5fd; }

    .refund-block__meta {
      display: flex; gap: 16px; flex-wrap: wrap; margin-top: 6px;
      font-size: .7rem; color: var(--color-text-muted);
    }

    .refund-block__steps {
      display: flex;
      align-items: center;
      gap: 0;
      margin-top: 12px;
      position: relative;
    }

    .refund-step {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      font-size: .68rem;
      color: var(--color-text-muted);
      position: relative;

      &::before {
        content: '';
        position: absolute;
        top: 5px;
        left: -50%;
        right: 50%;
        height: 2px;
        background: var(--color-border);
      }

      &:first-child::before { display: none; }
    }

    .refund-step--done { color: #bfdbfe; font-weight: 600; }
    .refund-step--done::before { background: #818cf8; }

    .refund-step__dot {
      width: 10px; height: 10px; border-radius: 50%;
      background: var(--color-border);
      z-index: 1;
    }

    .refund-step--done .refund-step__dot { background: #818cf8; box-shadow: 0 0 6px rgba(129,140,248,0.4); }
    .refund-step__date { font-size: .58rem; color: var(--color-text-subtle); }

    .refund-block__issue { margin: 10px 0 0; color: #fda4af; font-size: .75rem; }

    /* ── Feedback ── */
    .bk-feedback { margin: 0; font-size: .78rem; }
    .bk-feedback--success { color: #4ade80; }
    .bk-feedback--error { color: #f87171; }

    /* ── Responsive ── */
    @media (max-width: 768px) {
      .bookings-hero__stats { gap: 8px; }
      .stat-pill { min-width: 70px; padding: 10px 14px; }
      .stat-pill__count { font-size: 1.1rem; }

      .bk-card { flex-direction: column; }
      .bk-card__visual { width: 100%; height: 180px; }
      .bk-card__details { grid-template-columns: repeat(2, 1fr); }

      .status-timeline { flex-wrap: wrap; gap: 4px; }
    }

    @media (max-width: 480px) {
      .bookings-hero__title { font-size: 1.5rem; }
      .bookings-hero__stats { flex-wrap: wrap; }
      .tabs { overflow-x: auto; gap: 0; }
      .tab { padding: 10px 14px; font-size: 13px; white-space: nowrap; }
    }

    /* ── Pagination ── */
    .pagination {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      margin-top: var(--space-xl);
      flex-wrap: wrap;
    }

    .pagination__btn {
      padding: 8px 16px;
      background: none;
      color: var(--color-text-muted);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md, 8px);
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .pagination__btn:hover:not(:disabled) { border-color: var(--color-primary); color: var(--color-primary); }
    .pagination__btn:disabled { opacity: 0.3; cursor: not-allowed; }

    .pagination__num {
      width: 36px; height: 36px;
      display: flex; align-items: center; justify-content: center;
      background: none;
      color: var(--color-text-muted);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md, 8px);
      font-size: 13px; font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .pagination__num:hover { border-color: var(--color-primary); color: var(--color-primary); }
    .pagination__num--active {
      background: var(--color-primary);
      color: #000;
      border-color: var(--color-primary);
      font-weight: 700;
    }

    .pagination__size {
      margin-left: 12px;
      padding: 6px 12px;
      background: var(--gradient-card, rgba(255,255,255,0.03));
      color: var(--color-text-muted);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md, 8px);
      font-size: 12px;
      cursor: pointer;
    }
  `],
})
export class BookingHistoryComponent implements OnInit, OnDestroy {
  private bookingService = inject(BookingService);
  private bookingFilter = inject(BookingFilterService);
  private platformSync = inject(PlatformSyncService);
  private destroy$ = new Subject<void>();
  protected readonly placeholderImg = ROOM_IMAGE_PLACEHOLDER;

  data = signal<MyBookingsResponse | null>(null);
  loading = signal(true);
  errorMsg = signal('');
  activeTab = signal<TabKey>('upcoming');
  actionMessage = signal('');
  actionError = signal('');
  busyBookingId = signal<number | null>(null);

  readonly tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: 'upcoming', label: 'Upcoming', icon: '📅' },
    { key: 'past', label: 'Past', icon: '✓' },
    { key: 'cancelled', label: 'Cancelled', icon: '✕' },
    { key: 'expired', label: 'Expired', icon: '⏱' },
  ];

  // Pagination
  currentPage = signal(1);
  pageSize = signal(5);

  resolveRoomImage(imageUrl?: string): string {
    return normalizeRoomImageUrl(imageUrl) || this.placeholderImg;
  }

  onImageError(event: Event): void {
    applyRoomImageFallback(event);
  }

  ngOnInit(): void {
    this.load();
    this.initRealtimeSync();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Subscribe to booking/payment/refund WebSocket events for auto-refresh */
  private initRealtimeSync(): void {
    this.platformSync.connect();

    this.platformSync.onAny(
      'booking-created',
      'booking-confirmed',
      'booking-cancelled',
      'booking-expired',
      'payment-completed',
      'refund-initiated',
      'refund-completed',
    ).pipe(
      takeUntil(this.destroy$),
    ).subscribe(() => {
      // Silent reload — preserve any active action feedback
      this.load(true);
    });
  }

  load(preserveActionState = false): void {
    this.loading.set(true);
    this.errorMsg.set('');
    if (!preserveActionState) {
      this.actionMessage.set('');
      this.actionError.set('');
      this.busyBookingId.set(null);
    }

    this.bookingService.getMyBookings(this.activeTab(), this.currentPage(), this.pageSize()).subscribe({
      next: res => {
        this.data.set(res);
        this.currentPage.set(res.page);
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
    this.currentPage.set(1);
    this.load();
  }

  filteredBookings(): Booking[] {
    const bookings = this.data()?.bookings ?? [];
    if (this.data()?.tab === this.activeTab()) {
      return bookings;
    }
    return this.bookingFilter.filterByTab(bookings, this.activeTab());
  }

  tabCount(tab: TabKey): number {
    if (tab === 'upcoming') return this.data()?.upcoming ?? 0;
    if (tab === 'past') return this.data()?.past ?? 0;
    if (tab === 'expired') return this.data()?.expired ?? 0;
    return this.data()?.cancelled ?? 0;
  }

  // Pagination helpers
  paginatedBookings(): Booking[] {
    if (this.data()?.tab === this.activeTab()) {
      return this.filteredBookings();
    }
    const all = this.filteredBookings();
    const start = (this.currentPage() - 1) * this.pageSize();
    return all.slice(start, start + this.pageSize());
  }

  totalPages(): number {
    if (this.data()?.tab === this.activeTab()) {
      return this.data()?.total_pages ?? 1;
    }
    return Math.ceil(this.filteredBookings().length / this.pageSize());
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
      this.load(true);
    }
  }

  updatePageSize(size: number): void {
    this.pageSize.set(Number(size));
    this.currentPage.set(1);
    this.load();
  }

  get pageNumbers(): number[] {
    const total = this.totalPages();
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  statusLabel(status: string): string {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  // ── Status Timeline Steps (uses shared BookingFilterService) ────────
  getTimelineSteps(booking: Booking): { label: string; done: boolean; current: boolean; date?: string }[] {
    return this.bookingFilter.getBookingTimeline(booking);
  }

  // ── Empty States per Tab ──────────────────────────────────────────────
  emptyIcon(): string {
    const tab = this.activeTab();
    if (tab === 'upcoming') return '🌴';
    if (tab === 'past') return '📸';
    return '🎉';
  }

  emptyTitle(): string {
    const tab = this.activeTab();
    if (tab === 'upcoming') return 'No upcoming trips';
    if (tab === 'past') return 'No past stays yet';
    return 'No cancellations';
  }

  emptySubtitle(): string {
    const tab = this.activeTab();
    if (tab === 'upcoming') return 'Time to plan your next getaway!';
    if (tab === 'past') return 'Your travel memories will appear here.';
    return 'Great — all your bookings are on track!';
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  canResumeBooking(booking: Booking): boolean {
    if (booking.payment_status === 'paid' || booking.status === 'confirmed') return false;
    if (!booking.hold_expires_at) return false;
    return new Date(booking.hold_expires_at).getTime() > Date.now();
  }

  canRequestCancellationHelp(booking: Booking): boolean {
    if (booking.status !== 'confirmed' || booking.payment_status !== 'paid') return false;
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
      .replace(/\b\w/g, (character: string) => character.toUpperCase());
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
