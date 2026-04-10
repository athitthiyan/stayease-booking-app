import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { Room, RoomListResponse, RoomSearchParams } from '../models/room.model';
import { RoomService } from './room.service';

export interface ValidatedDateRange {
  checkIn: string;
  checkOut: string;
}

@Injectable({ providedIn: 'root' })
export class AvailabilityService {
  private readonly http = inject(HttpClient);
  private readonly roomService = inject(RoomService);
  private readonly roomsBase = `${environment.apiUrl}/rooms`;
  private readonly datePattern = /^\d{4}-\d{2}-\d{2}$/;

  hasDateRange(checkIn?: string | null, checkOut?: string | null): boolean {
    return !!checkIn && !!checkOut;
  }

  isValidDate(date: string): boolean {
    if (!this.datePattern.test(date)) {
      return false;
    }

    const [year, month, day] = date.split('-').map(Number);
    const parsed = new Date(year, month - 1, day);
    return !Number.isNaN(parsed.getTime())
      && parsed.getFullYear() === year
      && parsed.getMonth() === month - 1
      && parsed.getDate() === day;
  }

  validateDateRange(checkIn?: string | null, checkOut?: string | null): ValidatedDateRange | null {
    if (!this.hasDateRange(checkIn, checkOut)) {
      return null;
    }

    if (!checkIn || !checkOut || !this.isValidDate(checkIn) || !this.isValidDate(checkOut)) {
      return null;
    }

    if (new Date(`${checkOut}T00:00:00`) <= new Date(`${checkIn}T00:00:00`)) {
      return null;
    }

    return { checkIn, checkOut };
  }

  checkRoomAvailability(roomId: number, fromDate: string, toDate: string): Observable<boolean> {
    const validated = this.validateDateRange(fromDate, toDate);
    if (!validated) {
      return of(false);
    }

    const params = new HttpParams()
      .set('from_date', validated.checkIn)
      .set('to_date', validated.checkOut);

    return this.http
      .get<{ unavailable_dates: string[]; held_dates: string[] }>(`${this.roomsBase}/${roomId}/unavailable-dates`, { params })
      .pipe(
        map(response => response.unavailable_dates.length === 0 && response.held_dates.length === 0),
        catchError(() => of(false)),
      );
  }

  getRoomsForSearch(params: RoomSearchParams): Observable<RoomListResponse> {
    const validated = this.validateDateRange(params.check_in, params.check_out);
    if (this.hasDateRange(params.check_in, params.check_out) && !validated) {
      return of(this.emptyResponse(params));
    }

    const requestParams = validated
      ? { ...params, check_in: validated.checkIn, check_out: validated.checkOut }
      : { ...params, check_in: undefined, check_out: undefined };

    return this.roomService.getRooms(requestParams).pipe(
      map(response => {
        const rooms = response.rooms
          .filter((room: Room) => room.availability !== false)
          .map((room: Room) => ({
          ...room,
          availabilityState: 'available' as const,
          }));

        return {
          ...response,
          rooms,
          total: rooms.length,
        };
      }),
      catchError(() => of(this.emptyResponse(requestParams))),
    );
  }

  getFeaturedRooms(limit: number, checkIn?: string | null, checkOut?: string | null): Observable<Room[]> {
    const validated = this.validateDateRange(checkIn, checkOut);
    if (this.hasDateRange(checkIn, checkOut) && !validated) {
      return of([]);
    }

    if (!validated) {
      return this.roomService.getFeaturedRooms(limit).pipe(
        map(rooms => rooms.map((room: Room) => ({ ...room, availabilityState: 'available' as const }))),
        catchError(() => of([])),
      );
    }

    return this.roomService.getRooms({
      featured: true,
      check_in: validated.checkIn,
      check_out: validated.checkOut,
      page: 1,
      per_page: limit,
    }).pipe(
      map(response => response.rooms.map((room: Room) => ({ ...room, availabilityState: 'available' as const }))),
      catchError(() => of([])),
    );
  }

  private emptyResponse(params: RoomSearchParams): RoomListResponse {
    return {
      rooms: [],
      total: 0,
      page: params.page || 1,
      per_page: params.per_page || 12,
    };
  }
}
