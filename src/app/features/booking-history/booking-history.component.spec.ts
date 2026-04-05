import { of, throwError } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { BookingHistoryComponent } from './booking-history.component';
import { BookingService } from '../../core/services/booking.service';
import { AuthService } from '../../core/services/auth.service';
import { WishlistService } from '../../core/services/wishlist.service';
import { MyBookingsResponse } from '../../core/models/booking.model';
import { Room } from '../../core/models/room.model';
import { ROOM_IMAGE_PLACEHOLDER } from '../../shared/utils/image-fallback';

const bookingRoom = (overrides: Partial<Room> = {}): Room => ({
  id: 1,
  hotel_name: 'Azure Stay',
  room_type: 'suite',
  price: 200,
  availability: true,
  rating: 4.5,
  review_count: 10,
  location: 'NYC',
  beds: 1,
  bathrooms: 1,
  max_guests: 2,
  is_featured: false,
  created_at: '2026-04-01T00:00:00.000Z',
  ...overrides,
});

describe('BookingHistoryComponent', () => {
  const bookingService = {
    getMyBookings: jest.fn(),
    cancelBooking: jest.fn(),
    requestBookingSupport: jest.fn(),
    downloadInvoice: jest.fn(),
    downloadVoucher: jest.fn(),
  };
  const authService = {
    isLoggedIn: false,
    currentUser: null,
    logout: jest.fn(),
  };
  const wishlistService = {
    isSaved: jest.fn(() => false),
  };

  const response: MyBookingsResponse = {
    total: 4,
    upcoming: 1,
    past: 2,
    cancelled: 1,
    bookings: [
      { id: 1, booking_ref: 'BK1', user_name: 'Alex', email: 'alex@example.com', room_id: 1, status: 'confirmed', payment_status: 'paid', check_in: '2030-01-01', check_out: '2030-01-03', nights: 2, guests: 2, room_rate: 200, taxes: 24, service_fee: 10, total_amount: 200, created_at: '2026-04-01T00:00:00.000Z', room: bookingRoom() },
      { id: 2, booking_ref: 'BK2', user_name: 'Alex', email: 'alex@example.com', room_id: 1, status: 'completed', payment_status: 'paid', check_in: '2020-01-01', check_out: '2020-01-03', nights: 2, guests: 2, room_rate: 200, taxes: 24, service_fee: 10, total_amount: 200, created_at: '2026-04-01T00:00:00.000Z', room: bookingRoom() },
      { id: 3, booking_ref: 'BK3', user_name: 'Alex', email: 'alex@example.com', room_id: 1, status: 'confirmed', payment_status: 'paid', check_in: '2020-01-01', check_out: '2020-01-02', nights: 1, guests: 1, room_rate: 100, taxes: 12, service_fee: 5, total_amount: 100, created_at: '2026-04-01T00:00:00.000Z', room: bookingRoom() },
      { id: 4, booking_ref: 'BK4', user_name: 'Alex', email: 'alex@example.com', room_id: 1, status: 'cancelled', payment_status: 'failed', check_in: '2020-02-01', check_out: '2020-02-02', nights: 1, guests: 1, room_rate: 100, taxes: 12, service_fee: 5, total_amount: 100, created_at: '2026-04-01T00:00:00.000Z', room: bookingRoom() },
    ],
  };

  beforeEach(async () => {
    bookingService.getMyBookings.mockReset();
    bookingService.cancelBooking.mockReset();
    bookingService.requestBookingSupport.mockReset();
    bookingService.downloadInvoice.mockReset();
    bookingService.downloadVoucher.mockReset();

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

  it('falls back to the placeholder image for broken booking artwork', () => {
    const fixture = TestBed.createComponent(BookingHistoryComponent);
    const component = fixture.componentInstance;
    const image = document.createElement('img');
    image.src = 'https://example.com/broken-booking.jpg';

    expect(component.resolveRoomImage('invalid-room-image')).toBe(ROOM_IMAGE_PLACEHOLDER);

    component.onImageError({ target: image } as unknown as Event);

    expect(image.src).toBe(ROOM_IMAGE_PLACEHOLDER);
  });

  it('shows resume actions for active unpaid holds', () => {
    const futureHold: MyBookingsResponse = {
      total: 1,
      upcoming: 0,
      past: 0,
      cancelled: 0,
      bookings: [
        {
          id: 12,
          booking_ref: 'BK12',
          user_name: 'Alex',
          email: 'alex@example.com',
          room_id: 1,
          status: 'pending',
          payment_status: 'failed',
          hold_expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
          check_in: '2030-01-01T00:00:00.000Z',
          check_out: '2030-01-02T00:00:00.000Z',
          nights: 1,
          guests: 2,
          room_rate: 100,
          taxes: 12,
          service_fee: 5,
          total_amount: 117,
          created_at: '2026-04-01T00:00:00.000Z',
          room: bookingRoom(),
        },
      ],
    };
    bookingService.getMyBookings.mockReturnValue(of(futureHold));

    const fixture = TestBed.createComponent(BookingHistoryComponent);
    fixture.componentInstance.load();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Continue Payment');
    expect(fixture.nativeElement.textContent).toContain('Cancel Hold');
  });

  it('cancels a pending hold and reloads bookings', () => {
    bookingService.getMyBookings.mockReturnValue(of(response));
    bookingService.cancelBooking.mockReturnValue(of({ id: 1, status: 'cancelled' }));

    const fixture = TestBed.createComponent(BookingHistoryComponent);
    const component = fixture.componentInstance;

    component.cancelPendingBooking(response.bookings[0]);

    expect(bookingService.cancelBooking).toHaveBeenCalledWith(1);
    expect(component.actionMessage()).toContain('inventory has been released');
  });

  it('requests cancellation help for upcoming paid bookings', () => {
    bookingService.requestBookingSupport.mockReturnValue(
      of({ message: 'Support request submitted. Our team will contact you shortly.' }),
    );

    const fixture = TestBed.createComponent(BookingHistoryComponent);
    const component = fixture.componentInstance;

    component.requestCancellationHelp(response.bookings[0]);

    expect(bookingService.requestBookingSupport).toHaveBeenCalledWith(
      1,
      'cancellation_help',
      expect.stringContaining('BK1'),
    );
    expect(component.actionMessage()).toContain('Support request submitted');
  });

  it('reports action errors when cancel or support escalation fails', () => {
    bookingService.cancelBooking.mockReturnValue(throwError(() => new Error('boom')));
    bookingService.requestBookingSupport.mockReturnValue(throwError(() => new Error('boom')));

    const fixture = TestBed.createComponent(BookingHistoryComponent);
    const component = fixture.componentInstance;

    component.cancelPendingBooking(response.bookings[0]);
    expect(component.actionError()).toContain('could not cancel');

    component.requestCancellationHelp(response.bookings[0]);
    expect(component.actionError()).toContain('could not send your support request');
  });

  it('downloads invoice and voucher for paid bookings', () => {
    bookingService.downloadInvoice.mockReturnValue(of(new Blob(['invoice'])));
    bookingService.downloadVoucher.mockReturnValue(of(new Blob(['voucher'])));
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: jest.fn(() => 'blob:test'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: jest.fn(),
    });
    const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    const fixture = TestBed.createComponent(BookingHistoryComponent);
    const component = fixture.componentInstance;

    expect(component.canDownloadDocuments(response.bookings[0])).toBe(true);
    component.downloadInvoice(response.bookings[0]);
    component.downloadVoucher(response.bookings[0]);

    expect(bookingService.downloadInvoice).toHaveBeenCalledWith(1);
    expect(bookingService.downloadVoucher).toHaveBeenCalledWith(1);
    expect(clickSpy).toHaveBeenCalledTimes(2);

    clickSpy.mockRestore();
  });

  it('renders refund timeline helpers for refunded bookings', () => {
    const fixture = TestBed.createComponent(BookingHistoryComponent);
    const component = fixture.componentInstance;
    const refundedBooking = {
      ...response.bookings[0],
      payment_status: 'refunded' as const,
      refund_status: 'refund_processing' as const,
      refund_amount: 180,
      refund_requested_at: '2026-04-01T00:00:00.000Z',
      refund_initiated_at: '2026-04-02T00:00:00.000Z',
      refund_expected_settlement_at: '2026-04-05T00:00:00.000Z',
      refund_gateway_reference: 'RFND-001',
    };

    expect(component.hasRefundTimeline(refundedBooking)).toBe(true);
    expect(component.refundStatusLabel(refundedBooking)).toBe('Refund Processing');
    expect(component.refundAmount(refundedBooking)).toBe(180);
    expect(component.isRefundStepComplete(refundedBooking, 'initiated')).toBe(true);
    expect(component.formatDateTime(refundedBooking.refund_requested_at!)).toContain('2026');
  });

  it('reports document download failures', () => {
    bookingService.downloadInvoice.mockReturnValue(throwError(() => new Error('boom')));
    bookingService.downloadVoucher.mockReturnValue(throwError(() => new Error('boom')));

    const fixture = TestBed.createComponent(BookingHistoryComponent);
    const component = fixture.componentInstance;

    component.downloadInvoice(response.bookings[0]);
    expect(component.actionError()).toContain('could not download the invoice');

    component.downloadVoucher(response.bookings[0]);
    expect(component.actionError()).toContain('could not download the voucher');
  });
});
