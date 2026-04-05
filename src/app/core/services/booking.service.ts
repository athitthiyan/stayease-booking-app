import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  Booking,
  BookingListResponse,
  CreateBookingRequest,
  MyBookingsResponse,
  UnavailableDatesResponse,
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

  getMyBookings(): Observable<MyBookingsResponse> {
    return this.http.get<MyBookingsResponse>(`${environment.apiUrl}/auth/me/bookings`);
  }

  /**
   * Fetch unavailable and held dates for a room within a date window.
   * Used by the room-detail date picker to disable / warn on conflicting dates.
   */
  getUnavailableDates(
    roomId: number,
    fromDate: string,
    toDate: string,
  ): Observable<UnavailableDatesResponse> {
    const params = new HttpParams()
      .set('from_date', fromDate)
      .set('to_date', toDate);
    return this.http.get<UnavailableDatesResponse>(
      `${environment.apiUrl}/rooms/${roomId}/unavailable-dates`,
      { params },
    );
  }

  /**
   * Look up an existing PENDING booking for the same room / dates / email
   * whose hold has not yet expired.  Returns `null` when none is found.
   */
  findResumableBooking(
    roomId: number,
    checkIn: string,
    checkOut: string,
    email: string,
  ): Observable<Booking | null> {
    const params = new HttpParams()
      .set('room_id', roomId)
      .set('check_in', checkIn)
      .set('check_out', checkOut)
      .set('email', email);
    return this.http
      .get<Booking>(`${environment.apiUrl}/bookings/resumable`, { params })
      .pipe(catchError(() => of(null)));
  }

  /**
   * Re-lock inventory and extend the hold window for a booking whose hold
   * has expired.  Requires the original booking email for authorisation.
   */
  extendHold(bookingId: number, email: string): Observable<Booking> {
    return this.http.post<Booking>(
      `${environment.apiUrl}/bookings/${bookingId}/extend-hold`,
      { email },
    );
  }

  /**
   * Fetch availability for a specific month (used for calendar UI).
   * Returns the same shape as getUnavailableDates but filtered to a calendar month.
   */
  getMonthAvailability(roomId: number, yearMonth: string): Observable<UnavailableDatesResponse> {
    // yearMonth format: "2026-05"
    const [year, month] = yearMonth.split('-').map(Number);
    const fromDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const lastDay = new Date(year, month, 0).getDate();
    const toDate = new Date(year, month - 1, lastDay).toISOString().split('T')[0];
    return this.getUnavailableDates(roomId, fromDate, toDate);
  }
}
