import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { BookingService } from './booking.service';
import { ActiveHold, Booking } from '../models/booking.model';
import {
  ActiveHoldSyncReason,
  activeHoldCacheKeys,
  isActiveReservationVisible,
  resolveActiveHoldSyncReason,
} from './active-booking-visibility';

/** Regex to match /checkout/<bookingId> routes */
const CHECKOUT_ROUTE_RE = /^\/checkout\/(\d+)/;

const ACTIVE_BOOKING_SYNC_KEY = 'se_active_booking_sync';
const ACTIVE_HOLD_POLL_MS = 30_000;
const ACTIVE_HOLD_REFRESH_DEBOUNCE_MS = 200;
const TOAST_DURATION_MS = 4_000;

type SyncReason = ActiveHoldSyncReason;

@Injectable({ providedIn: 'root' })
export class ActiveBookingService {
  private readonly authService = inject(AuthService);
  private readonly bookingService = inject(BookingService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly activeHold = signal<ActiveHold | null>(null);
  readonly remainingSeconds = signal(0);
  readonly loading = signal(false);
  readonly loadError = signal('');
  readonly toastMessage = signal('');
  private readonly currentUrl = signal(this.router.url);
  readonly shouldShowActiveReservation = computed(() => {
    const hold = this.activeHold();
    if (!isActiveReservationVisible(hold) || this.remainingSeconds() <= 0) {
      return false;
    }
    // Hide the CTA bar when the user is already on the held booking's checkout page
    const match = CHECKOUT_ROUTE_RE.exec(this.currentUrl());
    if (match && hold && Number(match[1]) === hold.booking_id) {
      return false;
    }
    return true;
  });
  readonly canContinue = computed(() => this.shouldShowActiveReservation());

  private countdownHandle: ReturnType<typeof setInterval> | null = null;
  private pollHandle: ReturnType<typeof setInterval> | null = null;
  private toastHandle: ReturnType<typeof setTimeout> | null = null;
  private refreshHandle: ReturnType<typeof setTimeout> | null = null;
  private suppressedConfirmedBookingId: number | null = null;
  private stateVersion = 0;
  private lastRefreshAt = 0;
  private queuedSilentRefresh = true;

  constructor() {
    this.authService.currentUser$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(user => {
        if (user) {
          this.scheduleRefresh(false, true);
          this.startPolling();
          this.broadcastSync('login');
          return;
        }

        this.clearState();
        this.suppressedConfirmedBookingId = null;
        this.broadcastSync('logout');
      });

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(event => {
        this.currentUrl.set(event.urlAfterRedirects || event.url);
        if (this.authService.isLoggedIn) {
          this.scheduleRefresh(true);
        }
      });

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', this.handleStorageSync);
      window.addEventListener('focus', this.handleWindowFocus);
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }

    this.destroyRef.onDestroy(() => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', this.handleStorageSync);
        window.removeEventListener('focus', this.handleWindowFocus);
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
      }
      this.stopCountdown();
      this.stopPolling();
      if (this.refreshHandle !== null) {
        clearTimeout(this.refreshHandle);
        this.refreshHandle = null;
      }
      this.clearToast();
    });
  }

  retryLoad(): void {
    this.scheduleRefresh(false, true);
  }

  markBookingConfirmed(booking: Booking): void {
    if (booking.payment_status !== 'paid' && booking.status !== 'confirmed') {
      return;
    }

    this.suppressedConfirmedBookingId = booking.id;
    this.clearActiveBookingCache();
    if (this.activeHold()?.booking_id === booking.id) {
      this.clearState(false);
    }
    this.broadcastSync('confirmed');
  }

  continueBooking(): void {
    const hold = this.activeHold();
    if (!hold) {
      return;
    }

    this.bookingService.getBooking(hold.booking_id).subscribe({
      next: booking => this.resumeBooking(booking),
      error: () => {
        this.clearState();
        this.showToast('This booking is no longer available.');
        this.refreshActiveHold(false);
      },
    });
  }

  cancelActiveBooking(): void {
    const hold = this.activeHold();
    if (!hold) {
      return;
    }

    this.clearState(false);
    this.clearActiveBookingCache();
    this.broadcastSync('cancelled');

    this.bookingService.cancelBooking(hold.booking_id).subscribe({
      next: () => {
        this.showToast('Booking cancelled successfully.');
      },
      error: () => {
        this.showToast('Unable to cancel your active booking right now.');
        this.scheduleRefresh(false, true);
      },
    });
  }

  private scheduleRefresh(silent: boolean, immediate = false): void {
    if (!this.authService.isLoggedIn) {
      this.clearState(false);
      return;
    }

    this.queuedSilentRefresh = this.queuedSilentRefresh && silent;
    if (this.refreshHandle !== null) {
      clearTimeout(this.refreshHandle);
      this.refreshHandle = null;
    }

    const elapsed = Date.now() - this.lastRefreshAt;
    const delay = immediate ? 0 : Math.max(0, ACTIVE_HOLD_REFRESH_DEBOUNCE_MS - elapsed);
    if (delay === 0) {
      const nextSilent = this.queuedSilentRefresh;
      this.queuedSilentRefresh = true;
      this.refreshActiveHold(nextSilent);
      return;
    }

    this.refreshHandle = setTimeout(() => {
      this.refreshHandle = null;
      const nextSilent = this.queuedSilentRefresh;
      this.queuedSilentRefresh = true;
      this.refreshActiveHold(nextSilent);
    }, delay);
  }

  private refreshActiveHold(silent: boolean): void {
    this.loading.set(!silent);
    this.lastRefreshAt = Date.now();
    const requestVersion = this.stateVersion;
    this.bookingService.getActiveHold().subscribe({
      next: hold => {
        if (requestVersion !== this.stateVersion) {
          return;
        }

        this.loading.set(false);
        this.loadError.set('');
        this.reconcileHoldState(hold);
      },
      error: () => {
        if (requestVersion !== this.stateVersion) {
          return;
        }

        this.loading.set(false);
        this.loadError.set('Unable to retrieve active booking.');
      },
    });
  }

  private reconcileHoldState(nextHold: ActiveHold | null): void {
    const previousHold = this.activeHold();

    if (!nextHold) {
      if (previousHold) {
        this.resolveClosedHold(previousHold);
      }
      this.clearState(false);
      return;
    }

    if (!isActiveReservationVisible(nextHold)) {
      this.clearState(false);
      this.broadcastSync(resolveActiveHoldSyncReason(nextHold));
      return;
    }

    if (this.suppressedConfirmedBookingId === nextHold.booking_id) {
      this.clearState(false);
      return;
    }

    if (
      this.suppressedConfirmedBookingId !== null &&
      this.suppressedConfirmedBookingId !== nextHold.booking_id
    ) {
      this.suppressedConfirmedBookingId = null;
    }

    this.activeHold.set(nextHold);
    this.startCountdown(nextHold.expires_at);
  }

  private resolveClosedHold(previousHold: ActiveHold): void {
    this.bookingService.getBooking(previousHold.booking_id).subscribe({
      next: booking => this.handleResolvedBooking(previousHold, booking),
      error: () => {
        this.showToast('Booking hold expired.');
      },
    });
  }

  private handleResolvedBooking(previousHold: ActiveHold, booking: Booking): void {
    if (booking.payment_status === 'paid' || booking.status === 'confirmed') {
      this.showToast('Booking confirmed in another tab.');
      if (this.router.url.startsWith(`/checkout/${previousHold.booking_id}`)) {
        this.router.navigate(['/booking-confirmation'], {
          queryParams: { ref: booking.booking_ref },
        });
      }
      this.broadcastSync('confirmed');
      return;
    }

    if (booking.status === 'cancelled') {
      this.showToast('Booking was cancelled.');
      return;
    }

    this.showToast('Booking hold expired.');
  }

  private resumeBooking(booking: Booking): void {
    if (
      !booking.room ||
      booking.status === 'cancelled' ||
      booking.status === 'expired' ||
      booking.status === 'confirmed' ||
      booking.payment_status === 'paid'
    ) {
      this.clearState();
      this.showToast('This booking is no longer available.');
      return;
    }

    // Clear any stale checkout state from a different room/booking so the
    // checkout component's ngOnInit will fetch fresh data from the API
    // instead of hydrating from a mismatched cached state.
    this.bookingService.clearCheckoutState();
    sessionStorage.removeItem('pending_booking');

    // Store the held booking so checkout can restore it immediately
    sessionStorage.setItem('pending_booking', JSON.stringify(booking));
    this.bookingService.setCheckoutState({
      room: booking.room,
      checkIn: booking.check_in.slice(0, 10),
      checkOut: booking.check_out.slice(0, 10),
      guests: booking.guests,
      adults: booking.adults || booking.guests,
      children: booking.children || 0,
      infants: booking.infants || 0,
    });
    this.router.navigate(['/checkout', booking.id]);
  }

  private startCountdown(expiresAt: string): void {
    this.stopCountdown();
    const expiryTimestamp = new Date(expiresAt).getTime();
    const tick = () => {
      const seconds = Math.max(0, Math.ceil((expiryTimestamp - Date.now()) / 1000));
      this.remainingSeconds.set(seconds);

      if (seconds === 0) {
        this.stopCountdown();
        this.clearState(false);
        this.clearActiveBookingCache();
        this.showToast('Booking hold expired.');
        this.broadcastSync('expired');
        this.scheduleRefresh(true);
      }
    };

    tick();
    this.countdownHandle = setInterval(tick, 1000);
  }

  private stopCountdown(): void {
    if (this.countdownHandle !== null) {
      clearInterval(this.countdownHandle);
      this.countdownHandle = null;
    }
  }

  private startPolling(): void {
    if (this.pollHandle !== null) {
      return;
    }

    this.pollHandle = setInterval(() => {
      this.scheduleRefresh(true);
    }, ACTIVE_HOLD_POLL_MS);
  }

  private stopPolling(): void {
    if (this.pollHandle !== null) {
      clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
  }

  private clearState(clearToast = true): void {
    this.stateVersion += 1;
    this.activeHold.set(null);
    this.remainingSeconds.set(0);
    this.loadError.set('');
    this.clearActiveBookingCache();
    this.stopCountdown();
    if (!this.authService.isLoggedIn) {
      this.stopPolling();
    }
    if (clearToast) {
      this.clearToast();
    }
  }

  private clearActiveBookingCache(): void {
    /* istanbul ignore if -- SSR guard, window always defined in browser */
    if (typeof window === 'undefined') {
      return;
    }

    for (const key of activeHoldCacheKeys) {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    }
  }

  private clearToast(): void {
    if (this.toastHandle !== null) {
      clearTimeout(this.toastHandle);
      this.toastHandle = null;
    }
    if (this.refreshHandle !== null) {
      clearTimeout(this.refreshHandle);
      this.refreshHandle = null;
    }
    this.toastMessage.set('');
  }

  private showToast(message: string): void {
    this.clearToast();
    this.toastMessage.set(message);
    this.toastHandle = setTimeout(() => {
      this.toastMessage.set('');
      this.toastHandle = null;
    }, TOAST_DURATION_MS);
  }

  private broadcastSync(reason: SyncReason): void {
    /* istanbul ignore if -- SSR guard, window always defined in browser */
    if (typeof window === 'undefined') {
      return;
    }

    localStorage.setItem(
      ACTIVE_BOOKING_SYNC_KEY,
      JSON.stringify({ reason, at: Date.now() }),
    );
  }

  private readonly handleStorageSync = (event: StorageEvent): void => {
    if (event.key === ACTIVE_BOOKING_SYNC_KEY) {
      this.scheduleRefresh(true);
      return;
    }

    if (event.key === 'se_user') {
      if (event.newValue) {
        this.scheduleRefresh(true);
        this.startPolling();
      } else {
        this.clearState();
        this.suppressedConfirmedBookingId = null;
      }
    }
  };

  private readonly handleWindowFocus = (): void => {
    if (this.authService.isLoggedIn) {
      this.scheduleRefresh(true);
    }
  };

  private readonly handleVisibilityChange = (): void => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible' && this.authService.isLoggedIn) {
      this.scheduleRefresh(true);
    }
  };
}
