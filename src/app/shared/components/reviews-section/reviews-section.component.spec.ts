import { of, throwError } from 'rxjs';
import { SimpleChange } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ReviewsSectionComponent } from './reviews-section.component';
import { ReviewService } from '../../../core/services/review.service';

describe('ReviewsSectionComponent', () => {
  const reviewService = {
    getRoomReviews: jest.fn(),
  };

  const pageOne = {
    total: 6,
    average_rating: 4.5,
    rating_breakdown: { 5: 4, 4: 1, 3: 1, 2: 0, 1: 0 } as Record<number, number>,
    reviews: [
      {
        id: 1,
        user_id: 1,
        room_id: 10,
        booking_id: 100,
        reviewer_name: 'Alex Doe',
        rating: 4,
        cleanliness_rating: 4,
        service_rating: 4,
        value_rating: 4,
        location_rating: 4,
        created_at: '2026-04-01T00:00:00.000Z',
        title: 'Great stay',
        body: 'Very nice.',
        is_verified: true,
        host_reply: 'Thanks!',
        host_replied_at: null,
      },
    ],
  };

  beforeEach(async () => {
    reviewService.getRoomReviews.mockReset();

    await TestBed.configureTestingModule({
      imports: [ReviewsSectionComponent],
      providers: [{ provide: ReviewService, useValue: reviewService }],
    }).compileComponents();
  });

  it('loads reviews when roomId changes', () => {
    reviewService.getRoomReviews.mockReturnValue(of(pageOne));

    const fixture = TestBed.createComponent(ReviewsSectionComponent);
    const component = fixture.componentInstance;
    component.roomId = 10;

    component.ngOnChanges({
      roomId: new SimpleChange(undefined, 10, true),
    });

    expect(reviewService.getRoomReviews).toHaveBeenCalledWith(10, 1, 5);
    expect(component.data()).toEqual(pageOne);
    expect(component.loading()).toBe(false);
    expect(component.errorMsg()).toBe('');
  });

  it('renders the verified badge for verified reviews', () => {
    reviewService.getRoomReviews.mockReturnValue(of(pageOne));

    const fixture = TestBed.createComponent(ReviewsSectionComponent);
    const component = fixture.componentInstance;
    component.roomId = 10;

    component.ngOnChanges({
      roomId: new SimpleChange(undefined, 10, true),
    });
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Verified stay');
  });

  it('hides the verified badge for unverified reviews', () => {
    reviewService.getRoomReviews.mockReturnValue(
      of({
        ...pageOne,
        reviews: [{ ...pageOne.reviews[0], is_verified: false }],
      }),
    );

    const fixture = TestBed.createComponent(ReviewsSectionComponent);
    const component = fixture.componentInstance;
    component.roomId = 10;

    component.ngOnChanges({
      roomId: new SimpleChange(undefined, 10, true),
    });
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).not.toContain('Verified stay');
  });

  it('does not reload when roomId has no current value', () => {
    reviewService.getRoomReviews.mockReturnValue(of(pageOne));

    const fixture = TestBed.createComponent(ReviewsSectionComponent);
    const component = fixture.componentInstance;
    component.roomId = 10;

    component.ngOnChanges({
      roomId: new SimpleChange(10, 0, false),
    });

    expect(reviewService.getRoomReviews).not.toHaveBeenCalled();
  });

  it('handles review load failure', () => {
    reviewService.getRoomReviews.mockReturnValue(throwError(() => new Error('boom')));

    const fixture = TestBed.createComponent(ReviewsSectionComponent);
    const component = fixture.componentInstance;
    component.roomId = 11;

    component.ngOnChanges({
      roomId: new SimpleChange(undefined, 11, true),
    });

    expect(component.errorMsg()).toBe('Unable to load reviews.');
    expect(component.loading()).toBe(false);
  });

  it('loads more reviews and appends them', () => {
    reviewService.getRoomReviews
      .mockReturnValueOnce(of(pageOne))
      .mockReturnValueOnce(
        of({
          ...pageOne,
          reviews: [
            {
              id: 2,
              user_id: 2,
              room_id: 10,
              booking_id: 101,
              reviewer_name: 'Jamie Smith',
              rating: 5,
              cleanliness_rating: 5,
              service_rating: 5,
              value_rating: 5,
              location_rating: 5,
              created_at: '2026-04-02T00:00:00.000Z',
              host_replied_at: null,
            },
          ],
        })
      );

    const fixture = TestBed.createComponent(ReviewsSectionComponent);
    const component = fixture.componentInstance;
    component.roomId = 10;

    component.ngOnChanges({
      roomId: new SimpleChange(undefined, 10, true),
    });
    component.loadMore();

    expect(component.data()?.reviews.length).toBe(2);
    expect(component.loadingMore()).toBe(false);
  });

  it('stops loadMore spinner on error', () => {
    reviewService.getRoomReviews
      .mockReturnValueOnce(of(pageOne))
      .mockReturnValueOnce(throwError(() => new Error('boom')));

    const fixture = TestBed.createComponent(ReviewsSectionComponent);
    const component = fixture.componentInstance;
    component.roomId = 10;

    component.ngOnChanges({
      roomId: new SimpleChange(undefined, 10, true),
    });
    component.loadMore();

    expect(component.loadingMore()).toBe(false);
  });

  it('replaces data when loadMore succeeds without previous data', () => {
    reviewService.getRoomReviews.mockReturnValue(
      of({
        ...pageOne,
        reviews: [pageOne.reviews[0]],
      }),
    );

    const fixture = TestBed.createComponent(ReviewsSectionComponent);
    const component = fixture.componentInstance;
    component.roomId = 10;

    component.loadMore();

    expect(component.data()?.reviews.length).toBe(1);
    expect(component.currentPage).toBe(2);
    expect(component.loadingMore()).toBe(false);
  });

  it('calculates helper values', () => {
    const fixture = TestBed.createComponent(ReviewsSectionComponent);
    const component = fixture.componentInstance;
    component.data.set(pageOne);

    expect(component.barWidth(5)).toBe(67);
    expect(component.barWidth(1)).toBe(0);
    expect(component.initials(pageOne.reviews[0] as any)).toBe('AD');
    expect(component.starArray(3)).toEqual(['full', 'full', 'full', 'empty', 'empty']);
    expect(component.formatDate('2026-04-01T00:00:00.000Z')).toContain('2026');
  });

  it('returns zero bar width when the requested star count is missing', () => {
    const fixture = TestBed.createComponent(ReviewsSectionComponent);
    const component = fixture.componentInstance;
    component.data.set({
      ...pageOne,
      rating_breakdown: { 5: 4, 4: 1, 3: 1, 1: 0 } as Record<number, number>,
    });

    expect(component.barWidth(2)).toBe(0);
  });
});
