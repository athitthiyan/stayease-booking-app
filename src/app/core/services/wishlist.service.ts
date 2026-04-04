import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  WishlistResponse,
  WishlistStatusResponse,
  WishlistToggleResponse,
} from '../models/wishlist.model';

@Injectable({ providedIn: 'root' })
export class WishlistService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/wishlist`;

  /** Local set of saved room IDs for instant UI feedback */
  savedRoomIds = signal<Set<number>>(new Set());

  loadStatus(): Observable<WishlistStatusResponse> {
    return this.http.get<WishlistStatusResponse>(`${this.base}/status`).pipe(
      tap(res => this.savedRoomIds.set(new Set(res.room_ids)))
    );
  }

  getWishlist(): Observable<WishlistResponse> {
    return this.http.get<WishlistResponse>(this.base);
  }

  toggle(roomId: number): Observable<WishlistToggleResponse> {
    return this.http
      .post<WishlistToggleResponse>(`${this.base}/${roomId}`, {})
      .pipe(
        tap(res => {
          const current = new Set(this.savedRoomIds());
          if (res.saved) {
            current.add(roomId);
          } else {
            current.delete(roomId);
          }
          this.savedRoomIds.set(current);
        })
      );
  }

  remove(roomId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${roomId}`).pipe(
      tap(() => {
        const current = new Set(this.savedRoomIds());
        current.delete(roomId);
        this.savedRoomIds.set(current);
      })
    );
  }

  isSaved(roomId: number): boolean {
    return this.savedRoomIds().has(roomId);
  }
}
