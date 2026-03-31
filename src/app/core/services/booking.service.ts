import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  Booking,
  BookingListResponse,
  CreateBookingRequest,
} from '../models/booking.model';
import { Room } from '../models/room.model';

export interface CheckoutState {
  room: Room | null;
  checkIn: string;
  checkOut: string;
  guests: number;
}

@Injectable({ providedIn: 'root' })
export class BookingService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/bookings`;

  // In-memory checkout state (passed between booking and payment app)
  private _checkoutState$ = new BehaviorSubject<CheckoutState | null>(null);
  checkoutState$ = this._checkoutState$.asObservable();

  setCheckoutState(state: CheckoutState): void {
    this._checkoutState$.next(state);
    // Also persist to sessionStorage for page refreshes
    sessionStorage.setItem('checkout_state', JSON.stringify(state));
  }

  getCheckoutState(): CheckoutState | null {
    const stored = sessionStorage.getItem('checkout_state');
    if (stored) {
      const state = JSON.parse(stored) as CheckoutState;
      this._checkoutState$.next(state);
      return state;
    }
    return this._checkoutState$.value;
  }

  createBooking(data: CreateBookingRequest): Observable<Booking> {
    return this.http.post<Booking>(this.base, data);
  }

  getBookingByRef(ref: string): Observable<Booking> {
    return this.http.get<Booking>(`${this.base}/ref/${ref}`);
  }

  getBookingHistory(email: string): Observable<BookingListResponse> {
    return this.http.get<BookingListResponse>(`${this.base}/history`, {
      params: new HttpParams().set('email', email),
    });
  }

  cancelBooking(id: number): Observable<Booking> {
    return this.http.patch<Booking>(`${this.base}/${id}/cancel`, {});
  }
}
