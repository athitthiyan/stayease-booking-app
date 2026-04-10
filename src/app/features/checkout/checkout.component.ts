import { Component, DestroyRef, OnDestroy, OnInit, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BookingService, CheckoutState } from '../../core/services/booking.service';
import { ApiErrorDetail, ApiErrorResponse, Booking } from '../../core/models/booking.model';
import { environment } from '../../../environments/environment';
import { TAX_CONFIG } from '../../core/config/stayvora.config';
import {
  ROOM_IMAGE_PLACEHOLDER,
  applyRoomImageFallback,
  normalizeRoomImageUrl,
} from '../../shared/utils/image-fallback';
import { DateRangePickerComponent } from '../../shared/components/date-range-picker/date-range-picker.component';

@Component({
  selector: 'app-checkout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, FormsModule, DateRangePickerComponent],
  template: `
    <div class="checkout-page">
      <div class="container checkout-page__inner">

        <!-- Left: Form -->
        <div class="checkout-form">
          <nav class="breadcrumb">
            <a routerLink="/">Home</a> <span class="sep">›</span>
            <a routerLink="/search">Search</a> <span class="sep">›</span>
            @if (checkoutState()?.room) {
              <a [routerLink]="['/rooms', checkoutState()!.room!.id]">{{ checkoutState()!.room!.hotel_name }}</a> <span class="sep">›</span>
            }
            <span>Checkout</span>
          </nav>

          <h1 class="checkout-title">Complete Your <span>Booking</span></h1>

          <!-- ── Resumable-booking banner ── -->
          @if (resumableBooking()) {
            <div class="hold-banner hold-banner--resume">
              <span class="hold-banner__icon">🔄</span>
              <div>
                @if (isPaymentConfirmed(resumableBooking())) {
                  <strong>This booking is already confirmed.</strong>
                  <p>Booking {{ resumableBooking()!.booking_ref }} has already been paid and confirmed.</p>
                } @else {
                  <strong>You have an active reservation for these dates.</strong>
                  <p>Booking {{ resumableBooking()!.booking_ref }} is still held.
                    Complete payment to confirm it.
                  </p>
                }
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
          <!-- M-03: Using ngModel with template-driven form for simplicity.
               The checkout form manages guest information (name, email, phone, special requests)
               with two-way binding. This approach is appropriate for this simple data capture use case
               where minimal validation and no complex interdependencies are required. -->
          <section class="checkout-section">
            <h2>Guest Information</h2>
            <div class="form-row">
              <div class="form-group">
                <label for="checkout-name">Full Name *</label>
                <input
                  id="checkout-name"
                  type="text"
                  [(ngModel)]="form.user_name"
                  class="form-control"
                  [class.input--error]="nameError()"
                  placeholder="John Doe"
                  required
                  aria-describedby="checkout-name-error"
                />
                @if (nameError()) {
                  <p class="checkout-error" id="checkout-name-error" role="alert">{{ nameError() }}</p>
                }
              </div>
              <div class="form-group">
                <label for="checkout-email">Email Address *</label>
                <input
                  id="checkout-email"
                  type="email"
                  [(ngModel)]="form.email"
                  class="form-control"
                  [class.input--error]="emailError()"
                  placeholder="you@stayvora.co.in"
                  required
                  aria-describedby="checkout-email-error"
                />
                @if (emailError()) {
                  <p class="checkout-error" id="checkout-email-error" role="alert">{{ emailError() }}</p>
                }
              </div>
            </div>
            <div class="form-group" style="margin-top:16px">
              <label for="checkout-phone">Phone Number</label>
              <input
                id="checkout-phone"
                type="tel"
                [(ngModel)]="form.phone"
                class="form-control"
                [class.input--error]="phoneError()"
                placeholder="+1 (555) 000-0000"
                aria-describedby="checkout-phone-error"
              />
              @if (phoneError()) {
                <p class="checkout-error" id="checkout-phone-error" role="alert">{{ phoneError() }}</p>
              }
            </div>
            <div class="form-group" style="margin-top:16px">
              <label for="checkout-special-requests">Special Requests (Optional)</label>
              <textarea id="checkout-special-requests" [(ngModel)]="form.special_requests" class="form-control" rows="3" placeholder="Any special requirements or preferences..."></textarea>
            </div>
          </section>

          <!-- Stay Details with inline date editing -->
          <section class="checkout-section">
            <div class="stay-details-header">
              <h2>Stay Details</h2>
              @if (!editingDates() && !isPaymentConfirmed(resumableBooking())) {
                <button class="btn-edit-dates" (click)="startEditingDates()">Edit dates</button>
              }
            </div>

            @if (editingDates()) {
              <div class="inline-date-editor">
                <app-date-range-picker
                  [checkIn]="editCheckIn()"
                  [checkOut]="editCheckOut()"
                  (dateChange)="onInlineDateChange($event)"
                ></app-date-range-picker>
                <div class="inline-date-editor__actions">
                  <button class="btn btn--primary btn--sm" (click)="applyDateChange()" [disabled]="!editCheckIn() || !editCheckOut()">
                    Apply dates
                  </button>
                  <button class="btn btn--ghost btn--sm" (click)="cancelEditingDates()">
                    Cancel
                  </button>
                </div>
              </div>
            } @else {
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
                  <span class="stay-detail__value">{{ guestSummary() }}</span>
                </div>
              </div>
            }
          </section>

          <!-- Error banner -->
          @if (submitError()) {
            <div class="checkout-error">⚠️ {{ submitError() }}</div>
          }

          <!-- Conflict recovery banner -->
          @if (bookingConflict()) {
            <div class="checkout-conflict" role="alert">
              <div class="checkout-conflict__header">
                <span class="checkout-conflict__icon">⚠️</span>
                <strong>Room no longer available for selected dates.</strong>
              </div>
              <p>{{ conflictDateSummary() }}</p>
              <div class="checkout-conflict__actions">
                <button
                  class="btn btn--primary btn--sm checkout-conflict__retry"
                  (click)="retryAfterConflict()"
                  [disabled]="checkingAvailability()">
                  @if (checkingAvailability()) {
                    <span class="spinner-sm"></span> Checking…
                  } @else {
                    Check availability again
                  }
                </button>
                <button
                  class="btn btn--ghost btn--sm"
                  (click)="startEditingDates()">
                  Edit dates
                </button>
                @if (checkoutState()?.room?.id) {
                  <a class="btn btn--ghost btn--sm" [routerLink]="['/rooms', checkoutState()!.room!.id]">
                    Choose different room
                  </a>
                }
              </div>
            </div>
          }

          @if (toastMessage()) {
            <div class="checkout-toast" role="status" aria-live="polite">
              {{ toastMessage() }}
            </div>
          }

          <!-- Submit -->
          <div class="checkout-actions">
            <button class="btn btn--primary btn--lg"
              (click)="proceedToPayment()"
              [disabled]="submitting() || extendingHold() || isPaymentConfirmed(resumableBooking())">
              @if (submitting() || extendingHold()) {
                <span class="spinner-sm"></span> {{ extendingHold() ? 'Extending hold…' : 'Processing...' }}
              } @else if (isPaymentConfirmed(resumableBooking())) {
                Payment Confirmed
              } @else if (resumableBooking()) {
                Complete Payment →
              } @else {
                Proceed to Payment →
              }
            </button>
            @if (resumableBooking() && !isPaymentConfirmed(resumableBooking())) {
              <button
                class="btn btn--ghost btn--lg"
                (click)="cancelHold()"
                [disabled]="cancellingHold()"
                style="margin-top:8px">
                @if (cancellingHold()) {
                  Cancelling…
                } @else {
                  Cancel Booking
                }
              </button>
            }
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
                  [src]="resolveRoomImage(checkoutState()!.room!.image_url)"
                  [alt]="checkoutState()!.room!.hotel_name"
                  class="order-summary__img"
                  (error)="onImageError($event)"
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
                <span>₹{{ checkoutState()?.room?.price | number:'1.0-0' }}</span>
              </div>
              <div class="breakdown-row">
                <span>Nights</span>
                <span>× {{ nights() }}</span>
              </div>
              <div class="breakdown-row">
                <span>Subtotal</span>
                <span>₹{{ subtotal() | number:'1.0-0' }}</span>
              </div>
              <div class="breakdown-row">
                <span>Taxes (12%)</span>
                <span>₹{{ taxes() | number:'1.0-0' }}</span>
              </div>
              <div class="breakdown-row">
                <span>Service fee (5%)</span>
                <span>₹{{ serviceFee() | number:'1.0-0' }}</span>
              </div>
              <div class="divider"></div>
              <div class="breakdown-row breakdown-row--total">
                <span>Total</span>
                <span>₹{{ total() | number:'1.0-0' }}</span>
              </div>
            </div>

            <!-- Trust badges -->
            <div class="order-summary__trust">
              <div class="trust-badges-grid">
                <div class="trust-badge">
                  <span class="trust-badge__icon">🔒</span>
                  <div class="trust-badge__text">
                    <strong>256-bit SSL Encrypted</strong>
                    <span>Secure checkout</span>
                  </div>
                </div>
                <div class="trust-badge">
                  <span class="trust-badge__icon">💳</span>
                  <div class="trust-badge__text">
                    <strong>PCI DSS Compliant</strong>
                    <span>Razorpay secured</span>
                  </div>
                </div>
                <div class="trust-badge">
                  <span class="trust-badge__icon">✅</span>
                  <div class="trust-badge__text">
                    <strong>Free Cancellation</strong>
                    <span>Up to 48hrs before</span>
                  </div>
                </div>
                <div class="trust-badge">
                  <span class="trust-badge__icon">⭐</span>
                  <div class="trust-badge__text">
                    <strong>Best Price Guarantee</strong>
                    <span>Or we'll match it</span>
                  </div>
                </div>
              </div>
              <div class="trust-item trust-item--meta">
                <a routerLink="/cancellation-policy">Cancellation policy</a>
                <span>•</span>
                <a routerLink="/refund-policy">Refund policy</a>
              </div>
              <div class="trust-item trust-item--meta">
                Need help? <a href="mailto:support@stayvora.co.in">support&#64;stayvora.co.in</a>
              </div>
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
  nameError = signal('');
  emailError = signal('');
  phoneError = signal('');

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
  /** True while the cancel booking API call is in-flight. */
  cancellingHold = signal(false);
  /** True once booking creation fails due to a 409 availability conflict. */
  bookingConflict = signal(false);
  /** Lightweight local status toast for conflict refresh feedback. */
  toastMessage = signal('');
  /** Latest blocked dates returned from room availability refresh. */
  unavailableDates = signal<string[]>([]);
  /** Latest held dates returned from room availability refresh. */
  heldDates = signal<string[]>([]);
  /** True while the retry/check-availability API call is in-flight. */
  checkingAvailability = signal(false);

  // ── Inline date editing state ──────────────────────────────────────────────
  editingDates = signal(false);
  editCheckIn = signal('');
  editCheckOut = signal('');

  private countdownInterval: ReturnType<typeof setInterval> | null = null;
  private destroyRef = inject(DestroyRef);
  protected readonly placeholderImg = ROOM_IMAGE_PLACEHOLDER;

  guestSummary = computed(() => {
    const state = this.checkoutState();
    if (!state) return '';
    const parts: string[] = [];
    const a = state.adults || state.guests;
    const c = state.children || 0;
    const i = state.infants || 0;
    parts.push(`${a} Adult${a !== 1 ? 's' : ''}`);
    if (c > 0) parts.push(`${c} Child${c !== 1 ? 'ren' : ''}`);
    if (i > 0) parts.push(`${i} Infant${i !== 1 ? 's' : ''}`);
    return parts.join(', ');
  });

  conflictDateSummary = computed(() => {
    const blocked = this.unavailableDates().length;
    const held = this.heldDates().length;
    if (!blocked && !held) {
      return 'Live availability has been refreshed. Please pick different dates before trying again.';
    }
    if (blocked && held) {
      return `${blocked} blocked date${blocked !== 1 ? 's' : ''} and ${held} held date${held !== 1 ? 's' : ''} were found for this stay window.`;
    }
    if (blocked) {
      return `${blocked} blocked date${blocked !== 1 ? 's' : ''} were found for this stay window.`;
    }
    return `${held} held date${held !== 1 ? 's' : ''} were found for this stay window.`;
  });

  form = {
    user_name: '',
    email: '',
    phone: '',
    special_requests: '',
  };

  resolveRoomImage(imageUrl?: string): string {
    return normalizeRoomImageUrl(imageUrl) || this.placeholderImg;
  }

  onImageError(event: Event): void {
    applyRoomImageFallback(event);
  }

  private normalizeDateInput(value: string): string {
    return value.slice(0, 10);
  }

  private matchesCheckoutState(booking: Booking, state: CheckoutState): boolean {
    return (
      booking.room_id === state.room?.id &&
      this.normalizeDateInput(booking.check_in) === this.normalizeDateInput(state.checkIn) &&
      this.normalizeDateInput(booking.check_out) === this.normalizeDateInput(state.checkOut)
    );
  }

  private applyBookingToForm(booking: Booking): void {
    this.form.user_name = booking.user_name || this.form.user_name;
    this.form.email = booking.email || this.form.email;
    this.form.phone = booking.phone || '';
    this.form.special_requests = booking.special_requests || '';
  }

  isPaymentConfirmed(booking: Booking | null): boolean {
    return !!booking && (booking.payment_status === 'paid' || booking.status === 'confirmed');
  }

  // ── Dedicated state management methods ─────────────────────────────────────

  /** Set the conflict state with all related signals. */
  setConflictState(errorMessage: string, toast: string): void {
    this.bookingConflict.set(true);
    this.submitError.set(errorMessage);
    this.toastMessage.set(toast);
  }

  /** Clear the conflict state, re-enabling the checkout flow. */
  clearConflictState(): void {
    this.bookingConflict.set(false);
    this.submitError.set('');
    this.toastMessage.set('');
    this.unavailableDates.set([]);
    this.heldDates.set([]);
  }

  /** Reset all transient checkout error signals. */
  resetCheckoutErrors(): void {
    this.submitError.set('');
    this.toastMessage.set('');
    this.nameError.set('');
    this.emailError.set('');
    this.phoneError.set('');
  }

  /** Reset hold-related state. */
  resetHoldState(): void {
    this.stopCountdown();
    this.holdSecondsLeft.set(0);
    this.holdExpired.set(false);
    this.extendingHold.set(false);
  }

  // ── Inline date editing ────────────────────────────────────────────────────

  startEditingDates(): void {
    const state = this.checkoutState();
    if (!state) return;
    this.editCheckIn.set(state.checkIn);
    this.editCheckOut.set(state.checkOut);
    this.editingDates.set(true);
  }

  cancelEditingDates(): void {
    this.editingDates.set(false);
    this.editCheckIn.set('');
    this.editCheckOut.set('');
  }

  onInlineDateChange(event: { checkIn: string; checkOut: string }): void {
    this.editCheckIn.set(event.checkIn);
    this.editCheckOut.set(event.checkOut);
  }

  /** Apply the new dates from the inline editor and trigger recovery. */
  applyDateChange(): void {
    const newCheckIn = this.editCheckIn();
    const newCheckOut = this.editCheckOut();
    if (!newCheckIn || !newCheckOut) return;

    const state = this.checkoutState();
    if (!state) return;

    // Update checkout state with new dates
    const updatedState: CheckoutState = {
      ...state,
      checkIn: newCheckIn,
      checkOut: newCheckOut,
    };
    this.bookingService.setCheckoutState(updatedState);
    this.initializePricing(updatedState);

    // Clear conflict + errors (date change = recovery)
    this.clearConflictState();
    this.resetCheckoutErrors();

    // Clear any stale hold/resumable booking (dates changed, old booking invalid)
    this.clearTransientBookingState();

    this.editingDates.set(false);
    this.editCheckIn.set('');
    this.editCheckOut.set('');
  }

  // ── Retry after conflict ───────────────────────────────────────────────────

  /** Re-check availability for current dates. If clear, reset conflict state. */
  retryAfterConflict(): void {
    const state = this.checkoutState();
    const roomId = state?.room?.id;
    if (!state || !roomId) return;

    this.checkingAvailability.set(true);
    this.bookingService.getUnavailableDates(roomId, state.checkIn, state.checkOut)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
      next: response => {
        this.checkingAvailability.set(false);
        const hasOverlap = this.datesOverlap(
          state.checkIn,
          state.checkOut,
          response.unavailable_dates,
          response.held_dates,
        );
        if (hasOverlap) {
          // Still conflicted — update the displayed info
          this.unavailableDates.set(response.unavailable_dates);
          this.heldDates.set(response.held_dates);
          this.toastMessage.set('Dates are still unavailable. Try different dates.');
        } else {
          // Conflict cleared — dates are now free
          this.clearConflictState();
          this.toastMessage.set('Dates are now available! You can proceed.');
        }
      },
      error: () => {
        this.checkingAvailability.set(false);
        this.toastMessage.set('Could not check availability. Please try again.');
      },
    });
  }

  // ── Date overlap check (data-driven) ──────────────────────────────────────

  /** Check if the stay window overlaps with any unavailable/held dates. */
  datesOverlap(
    checkIn: string,
    checkOut: string,
    unavailable: string[],
    held: string[],
  ): boolean {
    const blockedSet = new Set([...unavailable, ...held]);
    if (blockedSet.size === 0) return false;

    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const current = new Date(start);

    while (current < end) {
      const dateStr = this.formatLocalDate(current);
      if (blockedSet.has(dateStr)) return true;
      current.setDate(current.getDate() + 1);
    }
    return false;
  }

  private formatLocalDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // ── Pricing ────────────────────────────────────────────────────────────────

  private initializePricing(state: CheckoutState): void {
    this.checkoutState.set(state);
    const nights = Math.floor(
      (new Date(state.checkOut).getTime() - new Date(state.checkIn).getTime()) / 86400000
    );
    this.nights.set(nights);
    const sub = (state.room?.price || 0) * nights;
    const tax = Math.round(sub * TAX_CONFIG.taxRate);
    const fee = Math.round(sub * TAX_CONFIG.serviceFeeRate);
    this.subtotal.set(sub);
    this.taxes.set(tax);
    this.serviceFee.set(fee);
    this.total.set(sub + tax + fee);
    // initializePricing is called for fresh state hydration — clear conflict
    this.bookingConflict.set(false);
    this.toastMessage.set('');
    this.unavailableDates.set([]);
    this.heldDates.set([]);
  }

  private restorePendingBooking(state: CheckoutState): void {
    const pendingRaw = sessionStorage.getItem('pending_booking');
    if (!pendingRaw) {
      return;
    }

    try {
      const pending: Booking = JSON.parse(pendingRaw);
      if (
        pending?.id &&
        pending.payment_status !== 'paid' &&
        pending.status !== 'confirmed' &&
        this.matchesCheckoutState(pending, state)
      ) {
        if (pending.hold_expires_at && new Date(pending.hold_expires_at).getTime() > Date.now()) {
          this.resumableBooking.set(pending);
          this.applyBookingToForm(pending);
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

  private hydrateCheckoutFromBooking(booking: Booking): void {
    if (!booking.room) {
      this.submitError.set('This booking is no longer available.');
      this.router.navigate(['/bookings']);
      return;
    }

    const restoredState: CheckoutState = {
      room: booking.room,
      checkIn: booking.check_in.slice(0, 10),
      checkOut: booking.check_out.slice(0, 10),
      guests: booking.guests,
      adults: booking.adults || booking.guests,
      children: booking.children || 0,
      infants: booking.infants || 0,
    };
    this.bookingService.setCheckoutState(restoredState);
    this.initializePricing(restoredState);
    this.resumableBooking.set(booking);
    this.applyBookingToForm(booking);
    if (this.isPaymentConfirmed(booking)) {
      sessionStorage.removeItem('pending_booking');
      this.stopCountdown();
      this.holdSecondsLeft.set(0);
      this.holdExpired.set(false);
      this.submitError.set('This booking has already been confirmed.');
      return;
    }
    sessionStorage.setItem('pending_booking', JSON.stringify(booking));
    if (booking.hold_expires_at) {
      this.startCountdown(booking.hold_expires_at);
    }
  }

  /** Track current booking ID so paramMap subscription can detect switches */
  private currentBookingId: number | null = null;

  ngOnInit(): void {
    // Subscribe to route param changes so that navigating from one checkout
    // to another (e.g. CTA "Continue Booking" while on a different room's
    // checkout) re-initializes the component with fresh data.
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const routeBookingId = this.parseRouteBookingId(params.get('id'));
        if (this.currentBookingId !== routeBookingId || this.currentBookingId === null) {
          this.resetForRouteChange();
          this.initializeCheckout(routeBookingId);
        }
      });
  }

  private initializeCheckout(routeBookingId: number | null): void {
    this.currentBookingId = routeBookingId;
    const state = this.bookingService.getCheckoutState();
    if (state) {
      this.initializePricing(state);
      this.restorePendingBooking(state);
    } else {
      if (routeBookingId === null) {
        this.router.navigate(['/search']);
        return;
      }

      this.bookingService.getBooking(routeBookingId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: booking => this.hydrateCheckoutFromBooking(booking),
          error: () => {
            this.submitError.set('This booking is no longer available.');
            this.router.navigate(['/bookings']);
          },
        });
    }

    // Detect return from login redirect: state is already restored from sessionStorage.
    const authRedirect = sessionStorage.getItem('booking_auth_redirect');
    if (authRedirect) {
      sessionStorage.removeItem('booking_auth_redirect');
    }
  }

  private parseRouteBookingId(rawId: string | null): number | null {
    const bookingId = Number(rawId);
    return Number.isFinite(bookingId) && bookingId > 0 ? bookingId : null;
  }

  private resetForRouteChange(): void {
    this.stopCountdown();
    this.resumableBooking.set(null);
    this.resetCheckoutErrors();
    this.clearConflictState();
    this.holdSecondsLeft.set(0);
    this.holdExpired.set(false);
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
    this.bookingService.extendHold(bookingId, email)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
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

  private validateGuestDetails(): boolean {
    const trimmedName = this.form.user_name.trim();
    const trimmedEmail = this.form.email.trim();
    const trimmedPhone = this.form.phone.trim();
    this.nameError.set('');
    this.emailError.set('');
    this.phoneError.set('');

    if (!trimmedName) {
      this.nameError.set('Please enter the guest name.');
    }

    if (!trimmedEmail) {
      this.emailError.set('Please enter the guest email.');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      this.emailError.set('Please enter a valid email address.');
    }

    if (trimmedPhone && !/^\+?[\d\s\-().]{7,20}$/.test(trimmedPhone)) {
      this.phoneError.set('Please enter a valid phone number.');
    }

    this.form.user_name = trimmedName;
    this.form.email = trimmedEmail;
    this.form.phone = trimmedPhone;
    return !this.nameError() && !this.emailError() && !this.phoneError();
  }

  // ── Error mapping ─────────────────────────────────────────────────────────

  private mapApiError(err: unknown): string {
    const detail = (err as { error?: ApiErrorResponse })?.error?.detail;
    if (detail && !Array.isArray(detail) && typeof detail === 'object' && 'code' in detail) {
      const errorDetail = detail as ApiErrorDetail;
      const messages: Record<string, string> = {
        BOOKING_CONFLICT: 'These dates are no longer available. Please go back and choose different dates.',
        HOLD_EXISTS: 'You already have an active reservation for these dates. Please complete or cancel it first.',
        ROOM_UNAVAILABLE: 'This room is no longer available for booking.',
        ROOM_NOT_FOUND: 'This room could not be found. Please go back and try again.',
        CHECK_IN_PAST: 'Check-in date must be in the future.',
        GUEST_CAPACITY_EXCEEDED: errorDetail.message || 'Guest count exceeds room capacity.',
        INVALID_DATE_RANGE: 'Check-out date must be after check-in date.',
        MINIMUM_STAY: 'Minimum stay is 1 night.',
        AUTH_REQUIRED: 'Please log in to continue with your booking.',
        STRIPE_DISABLED: 'Card payments are temporarily unavailable. Please use UPI or another method.',
      };
      return (errorDetail.code ? messages[errorDetail.code] : undefined)
        || errorDetail.message
        || 'Booking failed. Please try again.';
    }
    if (typeof detail === 'string') return detail;
    if ((err as { status?: number })?.status === 409) {
      return 'These dates are no longer available. Please go back and choose different dates.';
    }
    return 'Unable to create the booking right now. Please try again.';
  }

  // ── Cancel booking ────────────────────────────────────────────────────────

  private clearTransientBookingState(): void {
    sessionStorage.removeItem('pending_booking');
    sessionStorage.removeItem('booking_auth_redirect');
    this.resumableBooking.set(null);
    this.stopCountdown();
    this.holdSecondsLeft.set(0);
    this.holdExpired.set(false);
  }

  private refreshAvailabilityForConflict(): void {
    const state = this.checkoutState();
    const roomId = state?.room?.id;
    if (!state || !roomId) {
      this.unavailableDates.set([]);
      this.heldDates.set([]);
      return;
    }

    this.bookingService.getUnavailableDates(roomId, state.checkIn, state.checkOut)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
      next: response => {
        this.unavailableDates.set(response.unavailable_dates);
        this.heldDates.set(response.held_dates);
      },
      error: () => {
        this.unavailableDates.set([]);
        this.heldDates.set([]);
      },
    });
  }

  private handleBookingConflict(err: unknown): void {
    this.setConflictState(this.mapApiError(err), 'Selected dates are no longer available.');
    this.clearTransientBookingState();
    this.refreshAvailabilityForConflict();
  }

  cancelHold(): void {
    const booking = this.resumableBooking();
    if (!booking || this.cancellingHold()) return;
    this.cancellingHold.set(true);
    this.bookingService.cancelBooking(booking.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
      next: () => {
        this.cancellingHold.set(false);
        this.resumableBooking.set(null);
        this.holdSecondsLeft.set(0);
        this.holdExpired.set(false);
        this.stopCountdown();
        this.submitError.set('');
        // Navigate back to room detail
        const state = this.checkoutState();
        if (state?.room?.id) {
          this.router.navigate(['/rooms', state.room.id]);
        } else {
          this.router.navigate(['/search']);
        }
      },
      error: () => {
        this.cancellingHold.set(false);
        this.submitError.set('Could not cancel the booking. Please try again.');
      },
    });
  }

  // ── Main flow (data-driven, not signal-blocked) ───────────────────────────

  proceedToPayment() {
    // Data-driven conflict check: verify current dates against latest availability
    // instead of permanently blocking on stale bookingConflict signal
    if (this.bookingConflict()) {
      // If conflict is still active, re-check availability live
      const state = this.checkoutState();
      const roomId = state?.room?.id;
      if (state && roomId) {
        this.checkingAvailability.set(true);
        this.bookingService.getUnavailableDates(roomId, state.checkIn, state.checkOut)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
          next: response => {
            this.checkingAvailability.set(false);
            const hasOverlap = this.datesOverlap(
              state.checkIn,
              state.checkOut,
              response.unavailable_dates,
              response.held_dates,
            );
            if (hasOverlap) {
              this.unavailableDates.set(response.unavailable_dates);
              this.heldDates.set(response.held_dates);
              this.toastMessage.set('Dates are still unavailable. Edit dates or try again later.');
            } else {
              // Conflict cleared! Reset and proceed normally.
              this.clearConflictState();
              this.proceedToPayment();
            }
          },
          error: () => {
            this.checkingAvailability.set(false);
            this.toastMessage.set('Could not verify availability. Please try again.');
          },
        });
      }
      return;
    }

    if (this.isPaymentConfirmed(this.resumableBooking())) {
      this.submitError.set('This booking has already been confirmed.');
      return;
    }

    if (!this.validateGuestDetails()) {
      return;
    }

    // ① Prevent duplicate clicks — set immediately before any async work
    if (this.submitting()) return;
    this.submitting.set(true);
    this.submitError.set('');
    this.toastMessage.set('');

    const state = this.checkoutState()!;

    // ② Check for a resumable booking (same room/dates/email, non-expired hold)
    this.bookingService
      .findResumableBooking(
        state.room!.id,
        new Date(state.checkIn).toISOString(),
        new Date(state.checkOut).toISOString(),
        this.form.email,
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: existing => {
          if (existing) {
            // ── Resume path: reuse the existing booking ──────────────────
            this.resumableBooking.set(existing);
            if (this.isPaymentConfirmed(existing)) {
              sessionStorage.removeItem('pending_booking');
              this.stopCountdown();
              this.holdSecondsLeft.set(0);
              this.holdExpired.set(false);
              this.submitError.set('This booking has already been confirmed.');
              this.submitting.set(false);
              return;
            }
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
              adults: state.adults || state.guests,
              children: state.children || 0,
              infants: state.infants || 0,
              special_requests: this.form.special_requests,
            })
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: booking => {
                this.bookingConflict.set(false);
                this.resumableBooking.set(booking);
                if (booking.hold_expires_at) {
                  this.startCountdown(booking.hold_expires_at);
                }
                this.redirectToPayment(booking);
              },
              error: err => {
                if ((err as { status?: number })?.status === 409) {
                  this.handleBookingConflict(err);
                } else {
                  this.submitError.set(this.mapApiError(err));
                }
                this.submitting.set(false);
              },
            });
          }
        },
        // findResumableBooking catches 404 and returns null — this branch handles
        // genuine network/server errors from the resumable lookup itself
        error: () => {
          this.submitError.set('Unable to check existing bookings. Please try again.');
          this.submitting.set(false);
        },
      });
  }
}
