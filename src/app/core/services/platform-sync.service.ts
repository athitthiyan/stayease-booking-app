/**
 * ═══════════════════════════════════════════════════════════════════════
 *  STAYVORA — Platform Sync Service
 *  Event-driven cross-app synchronization via WebSocket / polling fallback.
 *  Every partner or admin action triggers immediate UI refresh across
 *  customer app, admin portal, and partner portal.
 * ═══════════════════════════════════════════════════════════════════════
 */
import { Injectable, signal, OnDestroy } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Subject, interval, Subscription } from 'rxjs';
import { takeUntil, filter } from 'rxjs/operators';

// ── Event Types ──────────────────────────────────────────────────────
export type PlatformEventType =
  | 'room-updated'
  | 'price-updated'
  | 'availability-updated'
  | 'booking-created'
  | 'booking-confirmed'
  | 'booking-cancelled'
  | 'booking-expired'
  | 'payment-completed'
  | 'refund-initiated'
  | 'refund-completed'
  | 'inventory-updated'
  | 'payout-settled';

export interface PlatformEvent {
  type: PlatformEventType;
  payload: Record<string, unknown>;
  timestamp: string;
  source: 'customer' | 'partner' | 'admin' | 'system';
}

// ── Event Flow Architecture ─────────────────────────────────────────
//
//  PARTNER UPDATE → API SAVE → EVENT EMIT → CACHE INVALIDATION
//     → CUSTOMER APP REFRESH → ADMIN DASHBOARD REFRESH
//
//  Uses WebSocket when available, falls back to polling every 15s
// ═════════════════════════════════════════════════════════════════════

@Injectable({ providedIn: 'root' })
export class PlatformSyncService implements OnDestroy {
  private destroy$ = new Subject<void>();
  private events$ = new Subject<PlatformEvent>();
  private ws: WebSocket | null = null;
  private pollingSubscription: Subscription | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  // Reactive signals for UI consumption
  connected = signal(false);
  lastEvent = signal<PlatformEvent | null>(null);

  // Observable stream for subscribers
  readonly onEvent$ = this.events$.asObservable();

  /** Subscribe to specific event types */
  on(type: PlatformEventType) {
    return this.events$.pipe(
      filter(e => e.type === type),
    );
  }

  /** Subscribe to multiple event types */
  onAny(...types: PlatformEventType[]) {
    return this.events$.pipe(
      filter(e => types.includes(e.type)),
    );
  }

  /** Initialize connection — call once at app bootstrap */
  connect(): void {
    this.tryWebSocket();
  }

  /** Emit a local event (for intra-app communication) */
  emit(event: PlatformEvent): void {
    this.events$.next(event);
    this.lastEvent.set(event);
  }

  /** Notify that rooms/inventory data should be refreshed */
  invalidateRoomCache(): void {
    this.emit({
      type: 'room-updated',
      payload: { action: 'cache-invalidate' },
      timestamp: new Date().toISOString(),
      source: 'system',
    });
  }

  /** Notify that booking data should be refreshed */
  invalidateBookingCache(): void {
    this.emit({
      type: 'booking-created',
      payload: { action: 'cache-invalidate' },
      timestamp: new Date().toISOString(),
      source: 'system',
    });
  }

  // ── WebSocket Connection ──────────────────────────────────────────

  private tryWebSocket(): void {
    let token = '';
    try {
      token = localStorage.getItem('access_token') || '';
    } catch {
      // localStorage may not be available in SSR or private browsing mode
    }
    const wsUrl = environment.apiUrl
      .replace('https://', 'wss://')
      .replace('http://', 'ws://') + '/ws/events?token=' + token;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.connected.set(true);
        this.reconnectAttempts = 0;
        this.stopPolling();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as PlatformEvent;
          this.events$.next(data);
          this.lastEvent.set(data);
        } catch { /* ignore malformed */ }
      };

      this.ws.onclose = () => {
        this.connected.set(false);
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.connected.set(false);
        this.ws?.close();
        this.startPollingFallback();
      };
    } catch {
      // WebSocket not available, fallback to polling
      this.startPollingFallback();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.startPollingFallback();
      return;
    }
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    setTimeout(() => this.tryWebSocket(), delay);
  }

  // ── Polling Fallback ──────────────────────────────────────────────

  private startPollingFallback(): void {
    if (this.pollingSubscription) return;
    this.pollingSubscription = interval(15000).pipe(
      takeUntil(this.destroy$),
    ).subscribe(() => {
      // Emit a generic refresh event so components can reload data
      this.emit({
        type: 'room-updated',
        payload: { action: 'poll-refresh' },
        timestamp: new Date().toISOString(),
        source: 'system',
      });
    });
  }

  private stopPolling(): void {
    this.pollingSubscription?.unsubscribe();
    this.pollingSubscription = null;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.ws?.close();
    this.stopPolling();
  }
}
