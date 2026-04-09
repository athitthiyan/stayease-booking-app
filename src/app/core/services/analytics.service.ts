/**
 * Stayvora Analytics Service
 * ==========================
 * Lightweight event tracking with pluggable backends.
 * Supports: Google Analytics 4 (gtag), custom backend, console (dev).
 *
 * Usage:
 *   inject(AnalyticsService).track('room_viewed', { room_id: 123 });
 */
import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { environment } from '../../../environments/environment';

// Extend Window for gtag
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, unknown>;
  timestamp?: string;
}

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private router = inject(Router);
  private initialized = false;
  private queue: AnalyticsEvent[] = [];

  /**
   * Initialize analytics — call once in app bootstrap.
   * Loads GA4 script if measurement ID is configured.
   */
  init(): void {
    if (this.initialized) return;
    this.initialized = true;

    const measurementId = (environment as Record<string, unknown>)['gaMeasurementId'] as string | undefined;

    if (measurementId) {
      this.loadGA4(measurementId);
    }

    // Track page views on route changes
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(event => {
        this.track('page_view', {
          page_path: event.urlAfterRedirects,
          page_title: document.title,
        });
      });

    // Flush any queued events
    for (const evt of this.queue) {
      this.dispatch(evt);
    }
    this.queue = [];
  }

  /**
   * Track a custom event.
   */
  track(name: string, properties?: Record<string, unknown>): void {
    const event: AnalyticsEvent = {
      name,
      properties: { ...properties },
      timestamp: new Date().toISOString(),
    };

    if (!this.initialized) {
      this.queue.push(event);
      return;
    }

    this.dispatch(event);
  }

  /**
   * Track e-commerce events (standard GA4 schema).
   */
  trackSearch(query: string, filters: Record<string, unknown>, resultCount: number): void {
    this.track('search', { search_term: query, ...filters, results_count: resultCount });
  }

  trackRoomView(roomId: number, hotelName: string, price: number): void {
    this.track('view_item', {
      item_id: roomId,
      item_name: hotelName,
      price,
      currency: 'INR',
    });
  }

  trackAddToCart(roomId: number, hotelName: string, price: number, nights: number): void {
    this.track('add_to_cart', {
      item_id: roomId,
      item_name: hotelName,
      price,
      quantity: nights,
      currency: 'INR',
    });
  }

  trackBeginCheckout(bookingRef: string, total: number): void {
    this.track('begin_checkout', {
      booking_ref: bookingRef,
      value: total,
      currency: 'INR',
    });
  }

  trackPurchase(bookingRef: string, total: number, paymentMethod: string): void {
    this.track('purchase', {
      transaction_id: bookingRef,
      value: total,
      currency: 'INR',
      payment_type: paymentMethod,
    });
  }

  trackSignup(method: string): void {
    this.track('sign_up', { method });
  }

  trackLogin(method: string): void {
    this.track('login', { method });
  }

  // ─── Private ────────────────────────────────────────────────────────────

  private dispatch(event: AnalyticsEvent): void {
    // GA4
    if (window.gtag) {
      if (event.name === 'page_view') {
        window.gtag('event', 'page_view', event.properties);
      } else {
        window.gtag('event', event.name, event.properties);
      }
    }

    // Console logging in development
    if (!(environment as Record<string, unknown>)['production']) {
      console.debug(`[Analytics] ${event.name}`, event.properties);
    }
  }

  private loadGA4(measurementId: string): void {
    // Skip if already loaded
    if (document.querySelector(`script[src*="gtag/js?id=${measurementId}"]`)) {
      return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer!.push(args);
    };
    window.gtag('js', new Date());
    window.gtag('config', measurementId, {
      send_page_view: false, // We handle page views manually
    });
  }
}
