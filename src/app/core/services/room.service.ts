import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Room, RoomListResponse, RoomSearchParams } from '../models/room.model';

@Injectable({ providedIn: 'root' })
export class RoomService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/rooms`;

  getRooms(params?: RoomSearchParams): Observable<RoomListResponse> {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          httpParams = httpParams.set(k, String(v));
        }
      });
    }
    return this.http.get<RoomListResponse>(this.base, { params: httpParams });
  }

  getFeaturedRooms(limit = 6): Observable<Room[]> {
    return this.http.get<Room[]>(`${this.base}/featured`, {
      params: new HttpParams().set('limit', limit),
    });
  }

  getRoom(id: number): Observable<Room> {
    return this.http.get<Room>(`${this.base}/${id}`);
  }
}
