import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { WishlistService } from './wishlist.service';
import { environment } from '../../../environments/environment';
import { WishlistResponse, WishlistStatusResponse, WishlistToggleResponse } from '../models/wishlist.model';

const mockStatus: WishlistStatusResponse = { room_ids: [1, 3, 5] };

const mockWishlist: WishlistResponse = {
  items: [
    { id: 10, room_id: 1, room: null, created_at: '2024-01-01T00:00:00Z' },
  ],
  total: 1,
};

describe('WishlistService', () => {
  let service: WishlistService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [WishlistService],
    });
    service = TestBed.inject(WishlistService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('initial savedRoomIds should be empty', () => {
    expect(service.savedRoomIds().size).toBe(0);
  });

  // ─── loadStatus ───────────────────────────────────────────────────────────

  it('loadStatus should populate savedRoomIds signal', () => {
    service.loadStatus().subscribe(res => {
      expect(res.room_ids).toEqual([1, 3, 5]);
    });

    http.expectOne(`${environment.apiUrl}/wishlist/status`).flush(mockStatus);

    expect(service.savedRoomIds().size).toBe(3);
    expect(service.isSaved(1)).toBe(true);
    expect(service.isSaved(2)).toBe(false);
    expect(service.isSaved(5)).toBe(true);
  });

  // ─── getWishlist ──────────────────────────────────────────────────────────

  it('getWishlist should return wishlist items', () => {
    service.getWishlist().subscribe(res => {
      expect(res.total).toBe(1);
      expect(res.items.length).toBe(1);
    });

    http.expectOne(`${environment.apiUrl}/wishlist`).flush(mockWishlist);
  });

  // ─── toggle ───────────────────────────────────────────────────────────────

  it('toggle should add room to savedRoomIds when saved=true', () => {
    const toggleRes: WishlistToggleResponse = { saved: true, message: 'Added to wishlist' };
    service.toggle(7).subscribe();
    http.expectOne(`${environment.apiUrl}/wishlist/7`).flush(toggleRes);
    expect(service.isSaved(7)).toBe(true);
  });

  it('toggle should remove room from savedRoomIds when saved=false', () => {
    // Pre-populate
    service.loadStatus().subscribe();
    http.expectOne(`${environment.apiUrl}/wishlist/status`).flush(mockStatus);

    const toggleRes: WishlistToggleResponse = { saved: false, message: 'Removed from wishlist' };
    service.toggle(1).subscribe();
    http.expectOne(`${environment.apiUrl}/wishlist/1`).flush(toggleRes);

    expect(service.isSaved(1)).toBe(false);
  });

  // ─── remove ───────────────────────────────────────────────────────────────

  it('remove should delete room from savedRoomIds', () => {
    service.loadStatus().subscribe();
    http.expectOne(`${environment.apiUrl}/wishlist/status`).flush(mockStatus);

    service.remove(3).subscribe();
    http.expectOne(`${environment.apiUrl}/wishlist/3`).flush(null);

    expect(service.isSaved(3)).toBe(false);
    expect(service.isSaved(1)).toBe(true); // others unaffected
  });

  // ─── isSaved ─────────────────────────────────────────────────────────────

  it('isSaved returns false when service is fresh', () => {
    expect(service.isSaved(99)).toBe(false);
  });
});
