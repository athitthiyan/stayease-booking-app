import { Injectable, signal, computed, effect } from '@angular/core';

export interface BookingSearchState {
  destination: string;
  checkIn: string;      // YYYY-MM-DD
  checkOut: string;     // YYYY-MM-DD
  adults: number;
  children: number;
  infants: number;
  rooms: number;
  promoCode: string;
  // Filters
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  amenities?: string;
  roomType?: string;
  sortBy?: string;
}

@Injectable({ providedIn: 'root' })
export class BookingSearchStore {
  private readonly STORAGE_KEY = 'sv_booking_search_state';
  private readonly PENDING_CHECKOUT_KEY = 'sv_pending_checkout_draft';
  private readonly REDIRECT_KEY = 'sv_redirect_after_login';

  // Core state signal
  private _state = signal<BookingSearchState>(this.loadFromSession());

  // Public readonly state
  readonly state = this._state.asReadonly();

  // Computed values
  readonly destination = computed(() => this._state().destination);
  readonly checkIn = computed(() => this._state().checkIn);
  readonly checkOut = computed(() => this._state().checkOut);
  readonly adults = computed(() => this._state().adults);
  readonly children = computed(() => this._state().children);
  readonly infants = computed(() => this._state().infants);
  readonly totalGuests = computed(() => this._state().adults + this._state().children);
  readonly nights = computed(() => {
    const { checkIn, checkOut } = this._state();
    if (!checkIn || !checkOut) return 0;
    const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
    return Math.max(0, Math.ceil(diff / 86400000));
  });
  readonly isValid = computed(() => {
    const s = this._state();
    return s.destination.length > 0 && s.checkIn.length > 0 && s.checkOut.length > 0 && this.nights() > 0;
  });
  readonly dateRangeText = computed(() => {
    const { checkIn, checkOut } = this._state();
    if (!checkIn || !checkOut) return '';
    const ci = new Date(checkIn + 'T00:00:00');
    const co = new Date(checkOut + 'T00:00:00');
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${fmt(ci)} → ${fmt(co)} • ${this.nights()} night${this.nights() !== 1 ? 's' : ''}`;
  });
  readonly guestSummary = computed(() => {
    const s = this._state();
    const parts: string[] = [];
    parts.push(`${s.adults} Adult${s.adults !== 1 ? 's' : ''}`);
    if (s.children > 0) parts.push(`${s.children} Child${s.children !== 1 ? 'ren' : ''}`);
    if (s.infants > 0) parts.push(`${s.infants} Infant${s.infants !== 1 ? 's' : ''}`);
    return parts.join(', ');
  });

  // Validation
  readonly validationError = computed(() => {
    const s = this._state();
    if (!s.checkIn || !s.checkOut) return '';
    const ci = new Date(s.checkIn + 'T00:00:00');
    const co = new Date(s.checkOut + 'T00:00:00');
    const today = new Date();
    today.setHours(0,0,0,0);
    if (ci < today) return 'Check-in date cannot be in the past';
    if (co <= ci) return 'Check-out must be after check-in';
    return '';
  });

  constructor() {
    // Auto-persist to sessionStorage on every state change
    effect(() => {
      const current = this._state();
      try {
        sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(current));
      } catch { /* storage full or unavailable */ }
    });
  }

  // --- Update methods ---

  updateDestination(destination: string): void {
    this._state.update(s => ({ ...s, destination }));
  }

  updateDates(checkIn: string, checkOut: string): void {
    this._state.update(s => ({ ...s, checkIn, checkOut }));
  }

  updateCheckIn(checkIn: string): void {
    this._state.update(s => {
      // If check-out is before or equal to new check-in, auto-advance check-out by 1 day
      let checkOut = s.checkOut;
      if (checkIn && (!checkOut || checkOut <= checkIn)) {
        const next = new Date(checkIn + 'T00:00:00');
        next.setDate(next.getDate() + 1);
        const yyyy = next.getFullYear();
        const mm = String(next.getMonth() + 1).padStart(2, '0');
        const dd = String(next.getDate()).padStart(2, '0');
        checkOut = `${yyyy}-${mm}-${dd}`;
      }
      return { ...s, checkIn, checkOut };
    });
  }

  updateCheckOut(checkOut: string): void {
    this._state.update(s => ({ ...s, checkOut }));
  }

  updateGuests(adults: number, children: number, infants: number): void {
    const clampedAdults = Math.max(1, adults);
    const clampedChildren = Math.max(0, children);
    const clampedInfants = Math.max(0, Math.min(infants, clampedAdults));
    this._state.update(s => ({ ...s, adults: clampedAdults, children: clampedChildren, infants: clampedInfants }));
  }

  updateFilters(filters: Partial<BookingSearchState>): void {
    this._state.update(s => ({ ...s, ...filters }));
  }

  patchState(partial: Partial<BookingSearchState>): void {
    this._state.update(s => ({ ...s, ...partial }));
  }

  reset(): void {
    this._state.set(this.defaultState());
    sessionStorage.removeItem(this.STORAGE_KEY);
  }

  // --- Redirect intent ---

  setRedirectIntent(url: string): void {
    sessionStorage.setItem(this.REDIRECT_KEY, url);
  }

  getAndClearRedirectIntent(): string | null {
    const url = sessionStorage.getItem(this.REDIRECT_KEY);
    if (url) sessionStorage.removeItem(this.REDIRECT_KEY);
    return url;
  }

  // --- Pending checkout draft ---

  savePendingCheckout(data: Record<string, unknown>): void {
    sessionStorage.setItem(this.PENDING_CHECKOUT_KEY, JSON.stringify(data));
  }

  getPendingCheckout(): Record<string, unknown> | null {
    const raw = sessionStorage.getItem(this.PENDING_CHECKOUT_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  clearPendingCheckout(): void {
    sessionStorage.removeItem(this.PENDING_CHECKOUT_KEY);
  }

  // --- Query params ↔ State ---

  toQueryParams(): Record<string, string> {
    const s = this._state();
    const params: Record<string, string> = {};
    if (s.destination) params['destination'] = s.destination;
    // Also support legacy 'city' param
    if (s.destination) params['city'] = s.destination;
    if (s.checkIn)     params['check_in'] = s.checkIn;
    if (s.checkOut)    params['check_out'] = s.checkOut;
    if (s.adults)      params['adults'] = String(s.adults);
    if (s.children)    params['children'] = String(s.children);
    if (s.infants)     params['infants'] = String(s.infants);
    if (s.minPrice != null) params['min_price'] = String(s.minPrice);
    if (s.maxPrice != null) params['max_price'] = String(s.maxPrice);
    if (s.minRating != null) params['min_rating'] = String(s.minRating);
    if (s.amenities)   params['amenities'] = s.amenities;
    if (s.roomType)    params['room_type'] = s.roomType;
    if (s.sortBy)      params['sort_by'] = s.sortBy;
    if (s.promoCode)   params['promo'] = s.promoCode;
    return params;
  }

  fromQueryParams(params: Record<string, string>): void {
    this._state.update(s => ({
      ...s,
      destination: params['destination'] || params['city'] || s.destination,
      checkIn: params['check_in'] || s.checkIn,
      checkOut: params['check_out'] || s.checkOut,
      adults: params['adults'] ? +params['adults'] : s.adults,
      children: params['children'] ? +params['children'] : s.children,
      infants: params['infants'] ? +params['infants'] : s.infants,
      minPrice: params['min_price'] ? +params['min_price'] : s.minPrice,
      maxPrice: params['max_price'] ? +params['max_price'] : s.maxPrice,
      minRating: params['min_rating'] ? +params['min_rating'] : s.minRating,
      amenities: params['amenities'] || s.amenities,
      roomType: params['room_type'] || s.roomType,
      sortBy: params['sort_by'] || s.sortBy,
      promoCode: params['promo'] || s.promoCode,
    }));
  }

  // --- Has recent search (for recovery banner) ---

  hasRecentSearch(): boolean {
    const s = this._state();
    return s.destination.length > 0 && s.checkIn.length > 0;
  }

  // --- Private helpers ---

  private loadFromSession(): BookingSearchState {
    try {
      const raw = sessionStorage.getItem(this.STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return { ...this.defaultState(), ...parsed };
      }
    } catch { /* corrupted data */ }
    return this.defaultState();
  }

  private defaultState(): BookingSearchState {
    return {
      destination: '',
      checkIn: '',
      checkOut: '',
      adults: 2,
      children: 0,
      infants: 0,
      rooms: 1,
      promoCode: '',
    };
  }
}
