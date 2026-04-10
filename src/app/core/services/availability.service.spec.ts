import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';

import { AvailabilityService } from './availability.service';
import { RoomService } from './room.service';
import { environment } from '../../../environments/environment';

describe('AvailabilityService', () => {
  let service: AvailabilityService;
  let httpMock: HttpTestingController;

  const roomService = {
    getRooms: jest.fn(),
    getFeaturedRooms: jest.fn(),
  };

  beforeEach(() => {
    roomService.getRooms.mockReset();
    roomService.getFeaturedRooms.mockReset();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RoomService, useValue: roomService },
      ],
    });

    service = TestBed.inject(AvailabilityService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    jest.restoreAllMocks();
  });

  it('validates well-formed date ranges and rejects malformed ones', () => {
    expect(service.isValidDate('2026-04-09')).toBe(true);
    expect(service.isValidDate('2026-4-9')).toBe(false);
    expect(service.validateDateRange('2026-04-09', '2026-04-11')).toEqual({
      checkIn: '2026-04-09',
      checkOut: '2026-04-11',
    });
    expect(service.validateDateRange('2026-04-09', '2026-04-09')).toBeNull();
    expect(service.validateDateRange('bad-date', '2026-04-11')).toBeNull();
  });

  it('checks a room endpoint for unavailable and held dates', () => {
    let result: boolean | undefined;
    service.checkRoomAvailability(5, '2026-04-09', '2026-04-11').subscribe(value => {
      result = value;
    });

    const req = httpMock.expectOne(request =>
      request.url === `${environment.apiUrl}/rooms/5/unavailable-dates`
      && request.params.get('from_date') === '2026-04-09'
      && request.params.get('to_date') === '2026-04-11',
    );
    expect(req.request.method).toBe('GET');
    req.flush({ unavailable_dates: [], held_dates: [] });

    expect(result).toBe(true);
  });

  it('returns false for invalid ranges and failed availability checks', () => {
    service.checkRoomAvailability(3, '2026-04-10', '2026-04-10').subscribe(value => {
      expect(value).toBe(false);
    });

    service.checkRoomAvailability(7, '2026-04-10', '2026-04-12').subscribe(value => {
      expect(value).toBe(false);
    });
    const req = httpMock.expectOne(request =>
      request.url === `${environment.apiUrl}/rooms/7/unavailable-dates`
      && request.params.get('from_date') === '2026-04-10'
      && request.params.get('to_date') === '2026-04-12',
    );
    req.flush('boom', { status: 500, statusText: 'Server Error' });
  });

  it('uses date-aware room search when a valid range exists and filters stale unavailable rooms', () => {
    roomService.getRooms.mockReturnValue(of({
      rooms: [
        { id: 1, availability: true, hotel_name: 'Ready' },
        { id: 2, availability: false, hotel_name: 'Hidden' },
      ],
      total: 2,
      page: 1,
      per_page: 12,
    }));

    service.getRoomsForSearch({ city: 'Paris', check_in: '2026-04-09', check_out: '2026-04-12', page: 1, per_page: 12 })
      .subscribe(response => {
        expect(response.rooms).toHaveLength(1);
        expect(response.rooms[0].availabilityState).toBe('available');
        expect(response.total).toBe(1);
      });

    expect(roomService.getRooms).toHaveBeenCalledWith(expect.objectContaining({
      city: 'Paris',
      check_in: '2026-04-09',
      check_out: '2026-04-12',
    }));
  });

  it('returns safe empty responses for invalid ranges and room API failures', () => {
    service.getRoomsForSearch({ check_in: '2026-04-12', check_out: '2026-04-12', page: 2, per_page: 9 })
      .subscribe(response => {
        expect(response).toEqual({ rooms: [], total: 0, page: 2, per_page: 9 });
      });

    roomService.getRooms.mockReturnValue(throwError(() => new Error('fail')));
    service.getRoomsForSearch({ city: 'Paris', page: 1, per_page: 12 }).subscribe(response => {
      expect(response).toEqual({ rooms: [], total: 0, page: 1, per_page: 12 });
    });
  });

  it('loads featured rooms through the bulk room search when dates are present and falls back safely', () => {
    roomService.getRooms.mockReturnValue(of({
      rooms: [{ id: 9, availability: true, hotel_name: 'Featured' }],
      total: 1,
      page: 1,
      per_page: 6,
    }));

    service.getFeaturedRooms(6, '2026-04-09', '2026-04-11').subscribe(rooms => {
      expect(rooms).toEqual([expect.objectContaining({ id: 9, availabilityState: 'available' })]);
    });
    expect(roomService.getRooms).toHaveBeenCalledWith(expect.objectContaining({
      featured: true,
      check_in: '2026-04-09',
      check_out: '2026-04-11',
    }));

    roomService.getFeaturedRooms.mockReturnValue(of([{ id: 2, hotel_name: 'Fallback' }]));
    service.getFeaturedRooms(4).subscribe(rooms => {
      expect(rooms).toEqual([expect.objectContaining({ id: 2, availabilityState: 'available' })]);
    });

    service.getFeaturedRooms(4, 'bad', 'range').subscribe(rooms => {
      expect(rooms).toEqual([]);
    });
  });

  it('returns empty array when getFeaturedRooms fails without date validation', () => {
    roomService.getFeaturedRooms.mockReturnValue(throwError(() => new Error('API failed')));

    service.getFeaturedRooms(6).subscribe(rooms => {
      expect(rooms).toEqual([]);
    });
  });

  it('returns empty array when getRooms fails with date validation', () => {
    roomService.getRooms.mockReturnValue(throwError(() => new Error('API failed')));

    service.getFeaturedRooms(6, '2026-04-09', '2026-04-11').subscribe(rooms => {
      expect(rooms).toEqual([]);
    });
  });

  it('returns empty array when date range is provided but invalid', () => {
    service.getFeaturedRooms(5, '2026-04-09', '2026-04-09').subscribe(rooms => {
      expect(rooms).toEqual([]);
    });

    expect(roomService.getRooms).not.toHaveBeenCalled();
    expect(roomService.getFeaturedRooms).not.toHaveBeenCalled();
  });

  it('uses getFeaturedRooms when no date validation needed', () => {
    roomService.getFeaturedRooms.mockReturnValue(of([
      { id: 10, hotel_name: 'Prime Hotel', availability: true },
      { id: 11, hotel_name: 'Luxury Inn', availability: true },
    ]));

    service.getFeaturedRooms(2).subscribe(rooms => {
      expect(rooms).toHaveLength(2);
      expect(rooms[0]).toMatchObject({ id: 10, availabilityState: 'available' });
      expect(rooms[1]).toMatchObject({ id: 11, availabilityState: 'available' });
    });

    expect(roomService.getFeaturedRooms).toHaveBeenCalledWith(2);
    expect(roomService.getRooms).not.toHaveBeenCalled();
  });

  it('uses getRooms with featured flag and dates when valid date range provided', () => {
    roomService.getRooms.mockReturnValue(of({
      rooms: [
        { id: 8, hotel_name: 'Featured Deluxe', availability: true },
      ],
      total: 1,
      page: 1,
      per_page: 10,
    }));

    service.getFeaturedRooms(10, '2026-04-15', '2026-04-18').subscribe(rooms => {
      expect(rooms).toHaveLength(1);
      expect(rooms[0]).toMatchObject({ id: 8, availabilityState: 'available' });
    });

    expect(roomService.getRooms).toHaveBeenCalledWith(expect.objectContaining({
      featured: true,
      check_in: '2026-04-15',
      check_out: '2026-04-18',
      page: 1,
      per_page: 10,
    }));
  });

  it('returns empty array when getFeaturedRooms API call fails', () => {
    roomService.getFeaturedRooms.mockReturnValue(throwError(() => new Error('Network error')));

    service.getFeaturedRooms(8).subscribe(rooms => {
      expect(rooms).toEqual([]);
    });
  });

  it('handles invalid check-in date in getFeaturedRooms', () => {
    service.getFeaturedRooms(5, 'invalid-date', '2026-04-11').subscribe(rooms => {
      expect(rooms).toEqual([]);
    });

    expect(roomService.getFeaturedRooms).not.toHaveBeenCalled();
    expect(roomService.getRooms).not.toHaveBeenCalled();
  });

  it('handles invalid check-out date in getFeaturedRooms', () => {
    service.getFeaturedRooms(5, '2026-04-09', 'not-a-date').subscribe(rooms => {
      expect(rooms).toEqual([]);
    });

    expect(roomService.getFeaturedRooms).not.toHaveBeenCalled();
    expect(roomService.getRooms).not.toHaveBeenCalled();
  });

  it('handles check-out before check-in in getFeaturedRooms', () => {
    service.getFeaturedRooms(5, '2026-04-15', '2026-04-10').subscribe(rooms => {
      expect(rooms).toEqual([]);
    });

    expect(roomService.getRooms).not.toHaveBeenCalled();
  });
});
