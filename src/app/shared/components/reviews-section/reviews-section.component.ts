import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReviewService } from '../../../core/services/review.service';
import { ReviewListResponse, ReviewResponse } from '../../../core/models/review.model';

@Component({
  selector: 'app-reviews-section',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="reviews-section">
      <div class="reviews-header">
        <h2>
          Guest Reviews
          @if (data()) {
            <span class="avg-badge">⭐ {{ data()!.average_rating | number: '1.1-1' }}</span>
          }
        </h2>
        @if (data()) {
          <p class="reviews-count">{{ data()!.total }} {{ data()!.total === 1 ? 'review' : 'reviews' }}</p>
        }
      </div>

      @if (data() && data()!.total > 0) {
        <!-- Rating bar breakdown -->
        <div class="rating-bars">
          @for (star of [5, 4, 3, 2, 1]; track star) {
            <div class="rating-bar-row">
              <span class="star-label">{{ star }}★</span>
              <div class="bar-track">
                <div
                  class="bar-fill"
                  [style.width.%]="barWidth(star)"
                ></div>
              </div>
              <span class="bar-count">{{ data()!.rating_breakdown[star] || 0 }}</span>
            </div>
          }
        </div>
      }

      @if (loading()) {
        <div class="reviews-loading">
          <div class="spinner"></div>
          <p>Loading reviews…</p>
        </div>
      } @else if (errorMsg()) {
        <p class="reviews-error">{{ errorMsg() }}</p>
      } @else if (!data() || data()!.total === 0) {
        <div class="reviews-empty">
          <span>💬</span>
          <p>No reviews yet — be the first to share your experience!</p>
        </div>
      } @else {
        <div class="reviews-list">
          @for (review of data()!.reviews; track review.id) {
            <article class="review-card">
              <div class="review-top">
                <div class="reviewer-avatar">{{ initials(review) }}</div>
                <div class="reviewer-info">
                  <strong>{{ review.reviewer_name }}</strong>
                  <span class="review-date">{{ formatDate(review.created_at) }}</span>
                </div>
                <div class="review-stars">
                  @for (s of starArray(review.rating); track s) {
                    <span [class]="s === 'full' ? 'star-full' : 'star-empty'">★</span>
                  }
                </div>
              </div>

              @if (review.title) {
                <p class="review-title">{{ review.title }}</p>
              }

              @if (review.body) {
                <p class="review-body">{{ review.body }}</p>
              }

              @if (review.is_verified) {
                <span class="verified-badge">✅ Verified stay</span>
              }

              @if (review.host_reply) {
                <div class="host-reply">
                  <span class="host-reply-label">🏨 Host replied:</span>
                  <p>{{ review.host_reply }}</p>
                </div>
              }
            </article>
          }
        </div>

        @if (data()!.total > (data()?.reviews?.length ?? 0)) {
          <button
            class="btn btn--ghost btn--sm load-more"
            (click)="loadMore()"
            [disabled]="loadingMore()"
          >
            @if (loadingMore()) { Loading… } @else { Load more reviews }
          </button>
        }
      }
    </section>
  `,
  styles: [`
    .reviews-section {
      display: flex;
      flex-direction: column;
      gap: var(--space-xl);
    }

    .reviews-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .reviews-header h2 {
      font-size: 1.2rem;
      font-weight: 600;
      margin: 0;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .avg-badge {
      background: var(--gradient-gold);
      color: #000;
      font-size: 13px;
      font-weight: 700;
      padding: 3px 10px;
      border-radius: 99px;
    }

    .reviews-count {
      color: var(--color-text-muted);
      font-size: 14px;
      margin: 0;
    }

    .rating-bars {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .rating-bar-row {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .star-label {
      font-size: 13px;
      color: var(--color-text-muted);
      width: 20px;
      text-align: right;
    }

    .bar-track {
      flex: 1;
      height: 6px;
      background: var(--color-border);
      border-radius: 99px;
      overflow: hidden;
    }

    .bar-fill {
      height: 100%;
      background: var(--gradient-gold);
      border-radius: 99px;
      transition: width 0.4s ease;
    }

    .bar-count {
      font-size: 12px;
      color: var(--color-text-muted);
      width: 24px;
    }

    .reviews-loading, .reviews-empty {
      display: flex;
      align-items: center;
      gap: var(--space-md);
      padding: var(--space-xl) 0;
      color: var(--color-text-muted);
      font-size: 14px;
    }

    .reviews-empty span { font-size: 1.5rem; }

    .spinner {
      width: 24px;
      height: 24px;
      border: 2px solid var(--color-border);
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    .reviews-error { color: #f87171; font-size: 14px; }

    .reviews-list {
      display: flex;
      flex-direction: column;
      gap: var(--space-lg);
    }

    .review-card {
      padding: var(--space-lg);
      background: var(--color-bg);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-xl);
      display: flex;
      flex-direction: column;
      gap: var(--space-md);
    }

    .review-top {
      display: flex;
      align-items: center;
      gap: var(--space-md);
    }

    .reviewer-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: var(--gradient-gold);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 700;
      color: #000;
      flex-shrink: 0;
    }

    .reviewer-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .reviewer-info strong { font-size: 14px; }
    .review-date { font-size: 12px; color: var(--color-text-muted); }

    .review-stars {
      display: flex;
      gap: 2px;
    }

    .star-full { color: var(--color-primary); }
    .star-empty { color: var(--color-border); }

    .review-title { font-weight: 600; font-size: 14px; margin: 0; }
    .review-body { font-size: 14px; color: var(--color-text-muted); margin: 0; line-height: 1.6; }

    .verified-badge {
      font-size: 12px;
      color: #4ade80;
    }

    .host-reply {
      background: rgba(var(--color-primary-rgb, 212, 175, 55), 0.05);
      border-left: 3px solid var(--color-primary);
      padding: var(--space-md) var(--space-lg);
      border-radius: 0 var(--radius-md) var(--radius-md) 0;
    }

    .host-reply-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--color-primary);
    }

    .host-reply p { font-size: 13px; color: var(--color-text-muted); margin: 6px 0 0; }

    .load-more { width: 100%; justify-content: center; }
  `],
})
export class ReviewsSectionComponent implements OnChanges {
  @Input({ required: true }) roomId!: number;

  private reviewService = inject(ReviewService);

  data = signal<ReviewListResponse | null>(null);
  loading = signal(true);
  loadingMore = signal(false);
  errorMsg = signal('');
  currentPage = 1;
  readonly perPage = 5;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['roomId']?.currentValue) {
      this.currentPage = 1;
      this.loadReviews();
    }
  }

  private loadReviews(): void {
    this.loading.set(true);
    this.errorMsg.set('');

    this.reviewService.getRoomReviews(this.roomId, 1, this.perPage).subscribe({
      next: res => {
        this.data.set(res);
        this.loading.set(false);
      },
      error: () => {
        this.errorMsg.set('Unable to load reviews.');
        this.loading.set(false);
      },
    });
  }

  loadMore(): void {
    this.loadingMore.set(true);
    const nextPage = this.currentPage + 1;

    this.reviewService.getRoomReviews(this.roomId, nextPage, this.perPage).subscribe({
      next: res => {
        this.data.update(prev =>
          prev
            ? { ...prev, reviews: [...prev.reviews, ...res.reviews] }
            : res
        );
        this.currentPage = nextPage;
        this.loadingMore.set(false);
      },
      error: () => this.loadingMore.set(false),
    });
  }

  barWidth(star: number): number {
    const total = this.data()?.total ?? 0;
    if (total === 0) return 0;
    const count = this.data()?.rating_breakdown[star] ?? 0;
    return Math.round((count / total) * 100);
  }

  initials(review: ReviewResponse): string {
    return review.reviewer_name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  starArray(rating: number): ('full' | 'empty')[] {
    return Array.from({ length: 5 }, (_, i) =>
      i < rating ? 'full' : 'empty'
    );
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    });
  }
}
