import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  HostReplyRequest,
  ReviewCreate,
  ReviewListResponse,
  ReviewResponse,
} from '../models/review.model';

@Injectable({ providedIn: 'root' })
export class ReviewService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/reviews`;

  getRoomReviews(
    roomId: number,
    page = 1,
    perPage = 10
  ): Observable<ReviewListResponse> {
    const params = new HttpParams()
      .set('page', page)
      .set('per_page', perPage);
    return this.http.get<ReviewListResponse>(`${this.base}/rooms/${roomId}`, { params });
  }

  createReview(payload: ReviewCreate): Observable<ReviewResponse> {
    return this.http.post<ReviewResponse>(this.base, payload);
  }

  hostReply(reviewId: number, payload: HostReplyRequest): Observable<ReviewResponse> {
    return this.http.post<ReviewResponse>(`${this.base}/${reviewId}/host-reply`, payload);
  }

  deleteReview(reviewId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${reviewId}`);
  }
}
