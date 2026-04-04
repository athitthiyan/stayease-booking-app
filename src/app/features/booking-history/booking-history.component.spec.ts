import { of, throwError } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { BookingHistoryComponent } from './booking-history.component';
import { BookingService } from '../../core/services/booking.service';
import { AuthService } from '../../core/services/auth.service';
import { WishlistService } from '../../core/services/wishlist.service';

describe('BookingHistoryComponent', () => {
  const bookingService = {
    getMyBookings: jest.fn(),
  };
  const authService = {
    isLoggedIn: false,
    currentUser: null,
    logout: jest.fn(),
  };
  const wishlistService = {
    isSaved: jest.fn(() => false),
  };

  const response = {
    total: 4,
    upcoming: 1,
    past: 2,
    cancelled: 1,
    bookings: [
      { id: 1, booking_ref: 'BK1', status: 'confirmed', payment_status: 'paid', check_in: '2030-01-01', check_out: '2030-01-03', nights: 2, guests: 2, total_amount: 200, room: {} },
      { id: 2, booking_ref: 'BK2', status: 'completed', payment_status: 'paid', check_in: '2020-01-01', check_out: '2020-01-03', nights: 2, guests: 2, total_amount: 200, room: {} },
      { id: 3, booking_ref: 'BK3', status: 'confirmed', payment_status: 'paid', check_in: '2020-01-01', check_out: '2020-01-02', nights: 1, guests: 1, total_amount: 100, room: {} },
      { id: 4, booking_ref: 'BK4', status: 'cancelled', payment_status: 'failed', check_in: '2020-02-01', check_out: '2020-02-02', nights: 1, guests: 1, total_amount: 100, room: {} },
    ],
  } as any;

  beforeEach(async () => {
    bookingService.getMyBookings.mockReset();

    await TestBed.configureTestingModule({
      imports: [BookingHistoryComponent],
      providers: [
        provideRouter([]),
        { provide: BookingService, useValue: bookingService },
        { provide: AuthService, useValue: authService },
        { provide: WishlistService, useValue: wishlistService },
      ],
    }).compileComponents();
  });

  it('loads bookings on init', () => {
    bookingService.getMyBookings.mockReturnValue(of(response));

    const fixture = TestBed.createComponent(BookingHistoryComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    expect(component.data()).toEqual(response);
    expect(component.loading()).toBe(false);
    expect(component.errorMsg()).toBe('');
  });

  it('handles load failure', () => {
    bookingService.getMyBookings.mockReturnValue(throwError(() => new Error('boom')));

    const fixture = TestBed.createComponent(BookingHistoryComponent);
    const component = fixture.componentInstance;
    component.load();

    expect(component.errorMsg()).toBe('Unable to load bookings. Please try again.');
    expect(component.loading()).toBe(false);
  });

  it('filters bookings by tab', () => {
    bookingService.getMyBookings.mockReturnValue(of(response));

    const fixture = TestBed.createComponent(BookingHistoryComponent);
    const component = fixture.componentInstance;
    component.load();

    expect(component.filteredBookings()).toHaveLength(4);

    component.setTab('upcoming');
    expect(component.filteredBookings().map(b => b.id)).toEqual([1]);

    component.setTab('past');
    expect(component.filteredBookings().map(b => b.id)).toEqual([2, 3]);

    component.setTab('cancelled');
    expect(component.filteredBookings().map(b => b.id)).toEqual([4]);
  });

  it('returns tab counts and formats dates', () => {
    const fixture = TestBed.createComponent(BookingHistoryComponent);
    const component = fixture.componentInstance;
    component.data.set(response);

    expect(component.tabCount('all')).toBe(4);
    expect(component.tabCount('upcoming')).toBe(1);
    expect(component.tabCount('past')).toBe(2);
    expect(component.tabCount('cancelled')).toBe(1);
    expect(component.formatDate('2026-04-01T00:00:00.000Z')).toContain('2026');
  });

  it('returns empty results and zero tab counts when data is missing', () => {
    const fixture = TestBed.createComponent(BookingHistoryComponent);
    const component = fixture.componentInstance;

    expect(component.filteredBookings()).toEqual([]);
    expect(component.tabCount('all')).toBe(0);
    expect(component.tabCount('upcoming')).toBe(0);
    expect(component.tabCount('past')).toBe(0);
    expect(component.tabCount('cancelled')).toBe(0);
  });
});
