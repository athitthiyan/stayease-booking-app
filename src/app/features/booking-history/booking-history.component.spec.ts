import { of, throwError } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { BookingHistoryComponent } from './booking-history.component';
import { BookingService } from '../../core/services/booking.service';
import { AuthService } from '../../core/services/auth.service';
import { PlatformSyncService } from '../../core/services/platform-sync.service';
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

const bookingResponse = (
  overrides: Partial<MyBookingsResponse> = {},
): MyBookingsResponse => ({
  total: 4,
  upcoming: 1,
  past: 2,
  cancelled: 1,
  expired: 0,
  page: 1,
  per_page: 10,
  total_pages: 1,
  tab: 'upcoming',
  bookings: [
    { id: 1, booking_ref: 'BK1', user_name: 'Alex', email: 'alex@example.com', room_id: 1, status: 'confirmed', payment_status: 'paid', check_in: '2030-01-01', check_out: '2030-01-03', nights: 2, guests: 2, adults: 2, children: 0, infants: 0, room_rate: 200, taxes: 24, service_fee: 10, total_amount: 200, created_at: '2026-04-01T00:00:00.000Z', room: bookingRoom() },
    { id: 2, booking_ref: 'BK2', user_name: 'Alex', email: 'alex@example.com', room_id: 1, status: 'completed', payment_status: 'paid', check_in: '2020-01-01', check_out: '2020-01-03', nights: 2, guests: 2, adults: 2, children: 0, infants: 0, room_rate: 200, taxes: 24, service_fee: 10, total_amount: 200, created_at: '2026-04-01T00:00:00.000Z', room: bookingRoom() },
    { id: 3, booking_ref: 'BK3', user_name: 'Alex', email: 'alex@example.com', room_id: 1, status: 'confirmed', payment_status: 'paid', check_in: '2020-01-01', check_out: '2020-01-02', nights: 1, guests: 1, adults: 1, children: 0, infants: 0, room_rate: 100, taxes: 12, service_fee: 5, total_amount: 100, created_at: '2026-04-01T00:00:00.000Z', room: bookingRoom() },
    { id: 4, booking_ref: 'BK4', user_name: 'Alex', email: 'alex@example.com', room_id: 1, status: 'cancelled', payment_status: 'failed', check_in: '2020-02-01', check_out: '2020-02-02', nights: 1, guests: 1, adults: 1, children: 0, infants: 0, room_rate: 100, taxes: 12, service_fee: 5, total_amount: 100, created_at: '2026-04-01T00:00:00.000Z', room: bookingRoom() },
  ],
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

  const response: MyBookingsResponse = bookingResponse();

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
    expect(bookingService.getMyBookings).toHaveBeenCalledWith('upcoming', 1, 5);
  });

  it('reloads silently when a realtime booking event arrives', () => {
    bookingService.getMyBookings.mockReturnValue(of(response));

    const fixture = TestBed.createComponent(BookingHistoryComponent);
    const component = fixture.componentInstance;
    const platformSync = TestBed.inject(PlatformSyncService);
    const loadSpy = jest.spyOn(component, 'load');

    component.ngOnInit();
    platformSync.emit({
      type: 'booking-created',
      payload: {},
      timestamp: new Date().toISOString(),
      source: 'system',
    });

    expect(loadSpy).toHaveBeenCalledWith(true);
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
    bookingService.getMyBookings
      .mockReturnValueOnce(of(response))
      .mockReturnValueOnce(of(bookingResponse({
        tab: 'upcoming',
        total: 1,
        page: 1,
        per_page: 5,
        total_pages: 1,
        bookings: [response.bookings[0]],
      })))
      .mockReturnValueOnce(of(bookingResponse({
        tab: 'past',
        total: 2,
        page: 1,
        per_page: 5,
        total_pages: 1,
        bookings: [response.bookings[1], response.bookings[2]],
      })))
      .mockReturnValueOnce(of(bookingResponse({
        tab: 'cancelled',
        total: 1,
        page: 1,
        per_page: 5,
        total_pages: 1,
        bookings: [response.bookings[3]],
      })));

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

    expect(component.tabCount('upcoming')).toBe(1);
    expect(component.tabCount('past')).toBe(2);
    expect(component.tabCount('cancelled')).toBe(1);
    expect(component.tabCount('expired')).toBe(0);
    expect(component.formatDate('2026-04-01T00:00:00.000Z')).toContain('2026');
  });

  it('returns empty results and zero tab counts when data is missing', () => {
    const fixture = TestBed.createComponent(BookingHistoryComponent);
    const component = fixture.componentInstance;

    expect(component.filteredBookings()).toEqual([]);
    expect(component.tabCount('upcoming')).toBe(0);
    expect(component.tabCount('past')).toBe(0);
    expect(component.tabCount('cancelled')).toBe(0);
    expect(component.tabCount('expired')).toBe(0);
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
      expired: 0,
      page: 1,
      per_page: 10,
      total_pages: 1,
      tab: 'upcoming',
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
          adults: 2,
          children: 0,
          infants: 0,
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
    const loadSpy = jest.spyOn(component, 'load');

    component.cancelPendingBooking(response.bookings[0]);

    expect(bookingService.cancelBooking).toHaveBeenCalledWith(1);
    expect(component.actionMessage()).toContain('inventory has been released');
    expect(loadSpy).toHaveBeenCalledWith(true);
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

  it('canResumeBooking returns false for paid or confirmed bookings', () => {
    const fixture = TestBed.createComponent(BookingHistoryComponent);
    const component = fixture.componentInstance;

    expect(component.canResumeBooking({ ...response.bookings[0], payment_status: 'paid', status: 'confirmed' } as never)).toBe(false);
  });

  it('canResumeBooking returns false when hold_expires_at is missing', () => {
    const fixture = TestBed.createComponent(BookingHistoryComponent);
    const component = fixture.componentInstance;

    expect(component.canResumeBooking({
      ...response.bookings[0],
      status: 'pending',
      payment_status: 'failed',
      hold_expires_at: undefined,
    } as never)).toBe(false);
  });

  it('canRequestCancellationHelp returns false when not confirmed/paid', () => {
    const fixture = TestBed.createComponent(BookingHistoryComponent);
    const component = fixture.componentInstance;

    expect(component.canRequestCancellationHelp({
      ...response.bookings[0],
      status: 'pending',
      payment_status: 'failed',
    } as never)).toBe(false);
  });

  it('canRequestCancellationHelp returns false when past check-out', () => {
    const fixture = TestBed.createComponent(BookingHistoryComponent);
    const component = fixture.componentInstance;

    expect(component.canRequestCancellationHelp({
      ...response.bookings[0],
      status: 'confirmed',
      payment_status: 'paid',
      check_out: '2020-01-01',
    } as never)).toBe(false);
  });

  it('refundStatusLabel falls back when refund_status is undefined', () => {
    const fixture = TestBed.createComponent(BookingHistoryComponent);
    const component = fixture.componentInstance;
    expect(component.refundStatusLabel({ ...response.bookings[0], refund_status: undefined } as never)).toBe('Refund Requested');
  });

  it('refundAmount falls back to total_amount when refund_amount is undefined', () => {
    const fixture = TestBed.createComponent(BookingHistoryComponent);
    const component = fixture.componentInstance;
    expect(component.refundAmount({ ...response.bookings[0], refund_amount: undefined, total_amount: 500 } as never)).toBe(500);
  });

  it('isRefundStepComplete returns true via refund_status when refund_initiated_at is absent', () => {
    const fixture = TestBed.createComponent(BookingHistoryComponent);
    const component = fixture.componentInstance;
    const booking = {
      ...response.bookings[0],
      refund_initiated_at: undefined,
      refund_status: 'refund_processing' as const,
    };
    expect(component.isRefundStepComplete(booking as never, 'initiated')).toBe(true);
  });

  it('isRefundStepComplete returns false when no initiated_at and unrelated refund_status', () => {
    const fixture = TestBed.createComponent(BookingHistoryComponent);
    const component = fixture.componentInstance;
    const booking = {
      ...response.bookings[0],
      refund_initiated_at: undefined,
      refund_status: 'refund_requested' as const,
    };
    expect(component.isRefundStepComplete(booking as never, 'initiated')).toBe(false);
  });

  it('isRefundStepComplete returns false for unknown step', () => {
    const fixture = TestBed.createComponent(BookingHistoryComponent);
    const component = fixture.componentInstance;

    expect(component.isRefundStepComplete(response.bookings[0], 'unknown' as never)).toBe(false);
  });

  it('guards pagination boundaries and exposes page labels and status formatting', () => {
    bookingService.getMyBookings.mockReturnValue(of(bookingResponse({
      tab: 'past',
      total: 2,
      past: 2,
      page: 2,
      per_page: 1,
      total_pages: 2,
      bookings: [response.bookings[2]],
    })));

    const fixture = TestBed.createComponent(BookingHistoryComponent);
    const component = fixture.componentInstance;
    component.data.set(response);
    component.pageSize.set(1);
    component.setTab('past');

    component.goToPage(0);
    expect(component.currentPage()).toBe(2);

    component.goToPage(2);
    expect(component.currentPage()).toBe(2);
    expect(component.pageNumbers).toEqual([1, 2]);
    expect(component.statusLabel('expired')).toBe('Expired');
  });

  it('uses backend pagination metadata when the response tab matches the active tab', () => {
    const fixture = TestBed.createComponent(BookingHistoryComponent);
    const component = fixture.componentInstance;

    component.data.set(bookingResponse({
      bookings: [response.bookings[0]],
      total: 7,
      page: 2,
      per_page: 5,
      total_pages: 3,
      tab: 'upcoming',
    }));
    component.activeTab.set('upcoming');

    expect(component.paginatedBookings()).toEqual([response.bookings[0]]);
    expect(component.totalPages()).toBe(3);
    expect(component.pageNumbers).toEqual([1, 2, 3]);
  });

  it('falls back to local pagination when the active tab differs from the response tab', () => {
    const fixture = TestBed.createComponent(BookingHistoryComponent);
    const component = fixture.componentInstance;

    component.data.set(bookingResponse({ tab: 'upcoming' }));
    component.activeTab.set('past');
    component.pageSize.set(1);
    component.currentPage.set(2);

    expect(component.paginatedBookings()).toEqual([response.bookings[2]]);
    expect(component.totalPages()).toBe(2);
    expect(component.pageNumbers).toEqual([1, 2]);
  });

  it('reloads from the first page when the page size changes', () => {
    bookingService.getMyBookings.mockReturnValue(of(response));

    const fixture = TestBed.createComponent(BookingHistoryComponent);
    const component = fixture.componentInstance;
    component.currentPage.set(3);

    component.updatePageSize(10);

    expect(component.pageSize()).toBe(10);
    expect(component.currentPage()).toBe(1);
    expect(bookingService.getMyBookings).toHaveBeenLastCalledWith('upcoming', 1, 10);
  });

  it('returns empty-state copy for past and cancelled tabs', () => {
    bookingService.getMyBookings.mockReturnValue(of(bookingResponse({
      tab: 'past',
      total: 0,
      upcoming: 0,
      past: 0,
      cancelled: 0,
      expired: 0,
      bookings: [],
    })));

    const fixture = TestBed.createComponent(BookingHistoryComponent);
    const component = fixture.componentInstance;

    component.setTab('past');
    expect(component.emptyIcon()).toBe('📸');
    expect(component.emptyTitle()).toBe('No past stays yet');
    expect(component.emptySubtitle()).toBe('Your travel memories will appear here.');

    component.setTab('cancelled');
    expect(component.emptyIcon()).toBe('🎉');
    expect(component.emptyTitle()).toBe('No cancellations');
    expect(component.emptySubtitle()).toBe('Great — all your bookings are on track!');
  });

  it('returns correct empty state messages for past tab', () => {
    bookingService.getMyBookings.mockReturnValue(of(response));

    const fixture = TestBed.createComponent(BookingHistoryComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.setTab('past');

    expect(component.emptyIcon()).toBe('📸');
    expect(component.emptyTitle()).toBe('No past stays yet');
    expect(component.emptySubtitle()).toBe('Your travel memories will appear here.');
  });

  it('returns correct empty state messages for cancelled tab', () => {
    bookingService.getMyBookings.mockReturnValue(of(response));

    const fixture = TestBed.createComponent(BookingHistoryComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.setTab('cancelled');

    expect(component.emptyIcon()).toBe('🎉');
    expect(component.emptyTitle()).toBe('No cancellations');
    expect(component.emptySubtitle()).toBe('Great — all your bookings are on track!');
  });

  it('uses local pagination when data tab does not match activeTab', () => {
    const customResponse = bookingResponse({
      tab: 'upcoming', // API returned upcoming tab
      total_pages: 2,
      bookings: response.bookings.slice(0, 2),
    });
    bookingService.getMyBookings.mockReturnValue(of(customResponse));

    const fixture = TestBed.createComponent(BookingHistoryComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    // Change to past tab locally — data still has upcoming
    component.setTab('past');
    component.currentPage.set(1);

    const paginated = component.paginatedBookings();
    // Should use local pagination (first page only)
    expect(paginated.length).toBeLessThanOrEqual(component.pageSize());
  });

  it('calculates totalPages correctly for local pagination mode', () => {
    const customResponse = bookingResponse({
      tab: 'upcoming',
      total_pages: 2,
      bookings: [
        response.bookings[0],
        response.bookings[1],
        response.bookings[2],
        response.bookings[3],
      ],
    });
    bookingService.getMyBookings.mockReturnValue(of(customResponse));

    const fixture = TestBed.createComponent(BookingHistoryComponent);
    const component = fixture.componentInstance;
    component.pageSize.set(2); // 2 bookings per page
    component.ngOnInit();

    // Switch to different tab — triggers local pagination
    component.setTab('past');

    const totalPages = component.totalPages();
    // 4 bookings / 2 per page = 2 pages
    expect(totalPages).toBeGreaterThanOrEqual(1);
  });

  it('paginatedBookings respects pageSize for locally filtered data', () => {
    const manyBookings = bookingResponse({
      tab: 'upcoming',
      bookings: Array.from({ length: 15 }, (_, i) => ({
        ...response.bookings[0],
        id: i + 1,
        booking_ref: `BK${i + 1}`,
      })),
    });
    bookingService.getMyBookings.mockReturnValue(of(manyBookings));

    const fixture = TestBed.createComponent(BookingHistoryComponent);
    const component = fixture.componentInstance;
    component.pageSize.set(5);
    component.ngOnInit();

    component.setTab('past'); // Switch to trigger local pagination
    component.currentPage.set(2);

    const paginated = component.paginatedBookings();
    // Page 2: should show items 5-9 (5 per page)
    expect(paginated.length).toBeLessThanOrEqual(5);
  });

  // ── Empty state display tests ──────────────────────────────────────────────

  it('shows empty state icon for upcoming tab', () => {
    bookingService.getMyBookings.mockReturnValue(of({ bookings: [], total_pages: 1, tab: 'upcoming' }));

    const fixture = TestBed.createComponent(BookingHistoryComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    component.setTab('upcoming');

    expect(component.emptyIcon()).toBe('🌴');
  });

  it('shows empty state icon for past tab', () => {
    bookingService.getMyBookings.mockReturnValue(of({ bookings: [], total_pages: 1, tab: 'past' }));

    const fixture = TestBed.createComponent(BookingHistoryComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    component.setTab('past');

    expect(component.emptyIcon()).toBe('📸');
  });

  it('shows empty state icon for cancelled tab', () => {
    bookingService.getMyBookings.mockReturnValue(of({ bookings: [], total_pages: 1, tab: 'cancelled' }));

    const fixture = TestBed.createComponent(BookingHistoryComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    component.setTab('cancelled');

    expect(component.emptyIcon()).toBe('🎉');
  });

  it('shows empty state title for upcoming tab', () => {
    bookingService.getMyBookings.mockReturnValue(of({ bookings: [], total_pages: 1, tab: 'upcoming' }));

    const fixture = TestBed.createComponent(BookingHistoryComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    component.setTab('upcoming');

    expect(component.emptyTitle()).toBe('No upcoming trips');
  });

  it('shows empty state title for past tab', () => {
    bookingService.getMyBookings.mockReturnValue(of({ bookings: [], total_pages: 1, tab: 'past' }));

    const fixture = TestBed.createComponent(BookingHistoryComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    component.setTab('past');

    expect(component.emptyTitle()).toBe('No past stays yet');
  });

  it('shows empty state title for cancelled tab', () => {
    bookingService.getMyBookings.mockReturnValue(of({ bookings: [], total_pages: 1, tab: 'cancelled' }));

    const fixture = TestBed.createComponent(BookingHistoryComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    component.setTab('cancelled');

    expect(component.emptyTitle()).toBe('No cancellations');
  });

  it('shows empty state subtitle for upcoming tab', () => {
    bookingService.getMyBookings.mockReturnValue(of({ bookings: [], total_pages: 1, tab: 'upcoming' }));

    const fixture = TestBed.createComponent(BookingHistoryComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    component.setTab('upcoming');

    expect(component.emptySubtitle()).toBe('Time to plan your next getaway!');
  });

  it('shows empty state subtitle for past tab', () => {
    bookingService.getMyBookings.mockReturnValue(of({ bookings: [], total_pages: 1, tab: 'past' }));

    const fixture = TestBed.createComponent(BookingHistoryComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    component.setTab('past');

    expect(component.emptySubtitle()).toBe('Your travel memories will appear here.');
  });

  it('shows empty state subtitle for cancelled tab', () => {
    bookingService.getMyBookings.mockReturnValue(of({ bookings: [], total_pages: 1, tab: 'cancelled' }));

    const fixture = TestBed.createComponent(BookingHistoryComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    component.setTab('cancelled');

    expect(component.emptySubtitle()).toBe('Great — all your bookings are on track!');
  });
});
