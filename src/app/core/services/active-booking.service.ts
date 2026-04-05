import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { BookingService } from './booking.service';
import { ActiveHold, Booking } from '../models/booking.model';

const ACTIVE_BOOKING_SYNC_KEY = 'se_active_booking_sync';
const ACTIVE_HOLD_POLL_MS = 30_000;
const TOAST_DURATION_MS = 4_000;

type SyncReason = 'refresh' | 'cancelled' | 'expired' | 'confirmed' | 'login' | 'logout';

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
  readonly canContinue = computed(() => !!this.activeHold() && this.remainingSeconds() > 0);

  private countdownHandle: ReturnType<typeof setInterval> | null = null;
  private pollHandle: ReturnType<typeof setInterval> | null = null;
  private toastHandle: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.authService.currentUser$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(user => {
        if (user) {
          this.refreshActiveHold(false);
          this.startPolling();
          this.broadcastSync('login');
          return;
        }

        this.clearState();
        this.broadcastSync('logout');
      });

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        if (this.authService.isLoggedIn) {
          this.refreshActiveHold(true);
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
      this.clearToast();
    });
  }

  retryLoad(): void {
    this.refreshActiveHold(false);
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

    this.bookingService.cancelBooking(hold.booking_id).subscribe({
      next: () => {
        this.clearState();
        this.showToast('Booking cancelled successfully.');
        this.broadcastSync('cancelled');
      },
      error: () => {
        this.showToast('Unable to cancel your active booking right now.');
      },
    });
  }

  private refreshActiveHold(silent: boolean): void {
    if (!this.authService.isLoggedIn) {
      this.clearState();
      return;
    }

    this.loading.set(!silent);
    this.bookingService.getActiveHold().subscribe({
      next: hold => {
        this.loading.set(false);
        this.loadError.set('');
        this.reconcileHoldState(hold);
      },
      error: () => {
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
      booking.payment_status === 'paid'
    ) {
      this.clearState();
      this.showToast('This booking is no longer available.');
      return;
    }

    sessionStorage.setItem('pending_booking', JSON.stringify(booking));
    this.bookingService.setCheckoutState({
      room: booking.room,
      checkIn: booking.check_in.slice(0, 10),
      checkOut: booking.check_out.slice(0, 10),
      guests: booking.guests,
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
        this.showToast('Booking hold expired.');
        this.broadcastSync('expired');
        this.refreshActiveHold(true);
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
      this.refreshActiveHold(true);
    }, ACTIVE_HOLD_POLL_MS);
  }

  private stopPolling(): void {
    if (this.pollHandle !== null) {
      clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
  }

  private clearState(clearToast = true): void {
    this.activeHold.set(null);
    this.remainingSeconds.set(0);
    this.loadError.set('');
    this.stopCountdown();
    if (!this.authService.isLoggedIn) {
      this.stopPolling();
    }
    if (clearToast) {
      this.clearToast();
    }
  }

  private clearToast(): void {
    if (this.toastHandle !== null) {
      clearTimeout(this.toastHandle);
      this.toastHandle = null;
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
      this.refreshActiveHold(true);
      return;
    }

    if (event.key === 'se_user') {
      if (event.newValue) {
        this.refreshActiveHold(true);
        this.startPolling();
      } else {
        this.clearState();
      }
    }
  };

  private readonly handleWindowFocus = (): void => {
    if (this.authService.isLoggedIn) {
      this.refreshActiveHold(true);
    }
  };

  private readonly handleVisibilityChange = (): void => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible' && this.authService.isLoggedIn) {
      this.refreshActiveHold(true);
    }
  };
}
