import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { ReviewService } from './review.service';
import { environment } from '../../../environments/environment';
import { ReviewCreate, ReviewListResponse, ReviewResponse } from '../models/review.model';

const mockReview: ReviewResponse = {
  id: 1,
  user_id: 42,
  room_id: 7,
  booking_id: 100,
  rating: 5,
  cleanliness_rating: 5,
  service_rating: 4,
  value_rating: 5,
  location_rating: 4,
  title: 'Amazing stay!',
  body: 'Would highly recommend.',
  is_verified: true,
  host_reply: null,
  host_replied_at: null,
  reviewer_name: 'Jane Doe',
  created_at: '2024-03-01T12:00:00Z',
};

const mockList: ReviewListResponse = {
  reviews: [mockReview],
  total: 1,
  average_rating: 5.0,
  rating_breakdown: { '5': 1, '4': 0, '3': 0, '2': 0, '1': 0 },
};

describe('ReviewService', () => {
  let service: ReviewService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ReviewService],
    });
    service = TestBed.inject(ReviewService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ─── getRoomReviews ───────────────────────────────────────────────────────

  it('getRoomReviews should call GET /reviews/rooms/:id with page params', () => {
    service.getRoomReviews(7, 1, 10).subscribe(res => {
      expect(res.total).toBe(1);
      expect(res.reviews[0].rating).toBe(5);
    });

    const req = http.expectOne(r =>
      r.url === `${environment.apiUrl}/reviews/rooms/7` &&
      r.params.get('page') === '1' &&
      r.params.get('per_page') === '10'
    );
    expect(req.request.method).toBe('GET');
    req.flush(mockList);
  });

  it('getRoomReviews should use default page=1 perPage=10', () => {
    service.getRoomReviews(7).subscribe();
    const req = http.expectOne(r => r.url.includes('/reviews/rooms/7'));
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('per_page')).toBe('10');
    req.flush(mockList);
  });

  // ─── createReview ─────────────────────────────────────────────────────────

  it('createReview should POST to /reviews', () => {
    const payload: ReviewCreate = {
      room_id: 7,
      booking_id: 100,
      rating: 5,
      title: 'Great',
      body: 'Loved it',
    };

    service.createReview(payload).subscribe(r => {
      expect(r.id).toBe(1);
      expect(r.is_verified).toBe(true);
    });

    const req = http.expectOne(`${environment.apiUrl}/reviews`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(mockReview);
  });

  // ─── hostReply ────────────────────────────────────────────────────────────

  it('hostReply should POST to /reviews/:id/host-reply', () => {
    const replied: ReviewResponse = { ...mockReview, host_reply: 'Thank you!' };
    service.hostReply(1, { reply: 'Thank you!' }).subscribe(r => {
      expect(r.host_reply).toBe('Thank you!');
    });

    const req = http.expectOne(`${environment.apiUrl}/reviews/1/host-reply`);
    expect(req.request.method).toBe('POST');
    req.flush(replied);
  });

  // ─── deleteReview ─────────────────────────────────────────────────────────

  it('deleteReview should DELETE /reviews/:id', () => {
    service.deleteReview(1).subscribe();

    const req = http.expectOne(`${environment.apiUrl}/reviews/1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
