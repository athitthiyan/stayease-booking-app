/**
 * ═══════════════════════════════════════════════════════════════════════
 *  STAYVORA — Shared Booking Filter Service
 *  Single source of truth for booking filtering, tab counts, and
 *  status classification across ALL portals.
 * ═══════════════════════════════════════════════════════════════════════
 */
import { Injectable } from '@angular/core';
import { Booking } from '../models/booking.model';

// ── Canonical status enum shared across all apps ─────────────────────
export enum BookingTab {
  UPCOMING = 'upcoming',
  PAST = 'past',
  CANCELLED = 'cancelled',
}

export enum AdminBookingTab {
  UPCOMING = 'upcoming',
  PAST = 'past',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
  REFUNDED = 'refunded',
}

export enum PartnerBookingTab {
  ACTIVE = 'active',
  PAST = 'past',
  CANCELLED = 'cancelled',
}

export interface BookingTabDef<T extends string = string> {
  key: T;
  label: string;
  icon: string;
}

// ── Tab definitions ──────────────────────────────────────────────────
export const CUSTOMER_TABS: BookingTabDef<BookingTab>[] = [
  { key: BookingTab.UPCOMING, label: 'Upcoming', icon: '📅' },
  { key: BookingTab.PAST, label: 'Past', icon: '✓' },
  { key: BookingTab.CANCELLED, label: 'Cancelled', icon: '✕' },
];

export const ADMIN_TABS: BookingTabDef<AdminBookingTab>[] = [
  { key: AdminBookingTab.UPCOMING, label: 'Upcoming', icon: '📅' },
  { key: AdminBookingTab.PAST, label: 'Past', icon: '✓' },
  { key: AdminBookingTab.CANCELLED, label: 'Cancelled', icon: '✕' },
  { key: AdminBookingTab.EXPIRED, label: 'Expired', icon: '⏱' },
  { key: AdminBookingTab.REFUNDED, label: 'Refunded', icon: '↩' },
];

export const PARTNER_TABS: BookingTabDef<PartnerBookingTab>[] = [
  { key: PartnerBookingTab.ACTIVE, label: 'Active', icon: '🟢' },
  { key: PartnerBookingTab.PAST, label: 'Past', icon: '✓' },
  { key: PartnerBookingTab.CANCELLED, label: 'Cancelled', icon: '✕' },
];

// ── Status mapping (backend → display) ───────────────────────────────
export const BOOKING_STATUS_MAP: Record<string, { label: string; color: string; bgColor: string }> = {
  pending:    { label: 'Pending',    color: '#fbbf24', bgColor: 'rgba(251,191,36,0.15)' },
  processing: { label: 'Processing', color: '#60a5fa', bgColor: 'rgba(96,165,250,0.15)' },
  confirmed:  { label: 'Confirmed',  color: '#4ade80', bgColor: 'rgba(34,197,94,0.15)' },
  cancelled:  { label: 'Cancelled',  color: '#f87171', bgColor: 'rgba(239,68,68,0.15)' },
  completed:  { label: 'Completed',  color: '#818cf8', bgColor: 'rgba(99,102,241,0.15)' },
  expired:    { label: 'Expired',    color: '#9ca3af', bgColor: 'rgba(107,114,128,0.15)' },
};

export const PAYMENT_STATUS_MAP: Record<string, { label: string; color: string; bgColor: string }> = {
  pending:   { label: 'Pending',   color: '#fbbf24', bgColor: 'rgba(251,191,36,0.15)' },
  processing:{ label: 'Processing', color: '#60a5fa', bgColor: 'rgba(96,165,250,0.15)' },
  paid:      { label: 'Paid',      color: '#4ade80', bgColor: 'rgba(34,197,94,0.15)' },
  failed:    { label: 'Failed',    color: '#f87171', bgColor: 'rgba(239,68,68,0.15)' },
  refunded:  { label: 'Refunded',  color: '#a78bfa', bgColor: 'rgba(167,139,250,0.15)' },
  expired:   { label: 'Expired',   color: '#9ca3af', bgColor: 'rgba(107,114,128,0.15)' },
};

@Injectable({ providedIn: 'root' })
export class BookingFilterService {

  // ── Core Filter Logic (single source for ALL apps) ────────────────

  /** Customer app: Upcoming = confirmed + not yet checked out */
  filterUpcoming(bookings: Booking[]): Booking[] {
    const now = new Date();
    return bookings.filter(b =>
      (b.status === 'confirmed' || b.status === 'pending' || b.status === 'processing') &&
      new Date(b.check_out) >= now
    );
  }

  /** Customer app: Past = completed or confirmed with past check_out */
  filterPast(bookings: Booking[]): Booking[] {
    const now = new Date();
    return bookings.filter(b =>
      b.status === 'completed' ||
      (b.status === 'confirmed' && new Date(b.check_out) < now)
    );
  }

  /** Customer app: Cancelled */
  filterCancelled(bookings: Booking[]): Booking[] {
    return bookings.filter(b => b.status === 'cancelled');
  }

  /** Admin: Expired */
  filterExpired(bookings: Booking[]): Booking[] {
    return bookings.filter(b => b.status === 'expired');
  }

  /** Admin: Refunded */
  filterRefunded(bookings: Booking[]): Booking[] {
    return bookings.filter(b => b.payment_status === 'refunded');
  }

  /** Partner: Active = confirmed + upcoming check_out */
  filterActive(bookings: Booking[]): Booking[] {
    const now = new Date();
    return bookings.filter(b =>
      b.status === 'confirmed' && new Date(b.check_out) >= now
    );
  }

  // ── Unified filter dispatcher ─────────────────────────────────────

  filterByTab(bookings: Booking[], tab: string): Booking[] {
    switch (tab) {
      case 'upcoming': return this.filterUpcoming(bookings);
      case 'past':     return this.filterPast(bookings);
      case 'cancelled': return this.filterCancelled(bookings);
      case 'expired':  return this.filterExpired(bookings);
      case 'refunded': return this.filterRefunded(bookings);
      case 'active':   return this.filterActive(bookings);
      default:         return bookings;
    }
  }

  // ── Count helpers ─────────────────────────────────────────────────

  getCounts(bookings: Booking[]): Record<string, number> {
    return {
      upcoming:  this.filterUpcoming(bookings).length,
      past:      this.filterPast(bookings).length,
      cancelled: this.filterCancelled(bookings).length,
      expired:   this.filterExpired(bookings).length,
      refunded:  this.filterRefunded(bookings).length,
      active:    this.filterActive(bookings).length,
    };
  }

  // ── Status badge helpers ──────────────────────────────────────────

  getStatusStyle(status: string): { label: string; color: string; bgColor: string } {
    return BOOKING_STATUS_MAP[status] || { label: status, color: '#9ca3af', bgColor: 'rgba(107,114,128,0.1)' };
  }

  getPaymentStyle(status: string): { label: string; color: string; bgColor: string } {
    return PAYMENT_STATUS_MAP[status] || { label: status, color: '#9ca3af', bgColor: 'rgba(107,114,128,0.1)' };
  }

  // ── Timeline Steps ────────────────────────────────────────────────

  getBookingTimeline(booking: Booking): { label: string; done: boolean; current: boolean; date?: string }[] {
    const now = new Date();
    const checkIn = new Date(booking.check_in);
    const checkOut = new Date(booking.check_out);

    if (booking.status === 'cancelled') {
      return [
        { label: 'Booked', done: true, current: false },
        { label: 'Cancelled', done: true, current: true },
      ];
    }

    if (booking.status === 'expired') {
      return [
        { label: 'Booked', done: true, current: false },
        { label: 'Expired', done: true, current: true },
      ];
    }

    return [
      { label: 'Booked', done: true, current: false },
      {
        label: 'Confirmed',
        done: booking.status === 'confirmed' || booking.status === 'completed',
        current: booking.status === 'confirmed' && now < checkIn,
      },
      {
        label: 'Checked In',
        done: (booking.status === 'confirmed' && now >= checkIn && now < checkOut) || booking.status === 'completed',
        current: booking.status === 'confirmed' && now >= checkIn && now < checkOut,
      },
      {
        label: 'Completed',
        done: booking.status === 'completed' || (booking.status === 'confirmed' && now >= checkOut),
        current: booking.status === 'completed',
      },
    ];
  }
}
