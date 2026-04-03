import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import { RoomService } from './room.service';
import { environment } from '../../../environments/environment';

describe('RoomService', () => {
  let service: RoomService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(RoomService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('fetches rooms with filtered params only', () => {
    service
      .getRooms({ city: 'Paris', guests: 2, room_type: '', max_price: undefined } as any)
      .subscribe();

    const req = httpMock.expectOne(
      request =>
        request.url === `${environment.apiUrl}/rooms` &&
        request.params.get('city') === 'Paris' &&
        request.params.get('guests') === '2' &&
        !request.params.has('room_type') &&
        !request.params.has('max_price')
    );
    expect(req.request.method).toBe('GET');
    req.flush({ rooms: [], total: 0, page: 1, per_page: 9 });
  });

  it('fetches featured rooms and room details', () => {
    service.getFeaturedRooms(3).subscribe();
    const featuredReq = httpMock.expectOne(
      `${environment.apiUrl}/rooms/featured?limit=3`
    );
    expect(featuredReq.request.method).toBe('GET');
    featuredReq.flush([]);

    service.getRoom(8).subscribe();
    const roomReq = httpMock.expectOne(`${environment.apiUrl}/rooms/8`);
    expect(roomReq.request.method).toBe('GET');
    roomReq.flush({});
  });
});
