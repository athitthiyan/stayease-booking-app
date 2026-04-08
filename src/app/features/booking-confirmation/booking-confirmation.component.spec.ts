import { of, throwError } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';

import { BookingConfirmationComponent } from './booking-confirmation.component';
import { ActiveBookingService } from '../../core/services/active-booking.service';
import { BookingService } from '../../core/services/booking.service';

describe('BookingConfirmationComponent', () => {
  it('loads booking details by reference', async () => {
    const activeBookingService = {
      markBookingConfirmed: jest.fn(),
    };
    const bookingService = {
      getBookingByRef: jest.fn().mockReturnValue(
        of({
          id: 99,
          booking_ref: 'BK123',
          room: { hotel_name: 'The Grand Azure', location: 'New York' },
          check_in: '2026-04-10T00:00:00Z',
          check_out: '2026-04-12T00:00:00Z',
          guests: 2,
          adults: 2,
          children: 0,
          infants: 0,
          total_amount: 450,
          status: 'confirmed',
          payment_status: 'paid',
        })
      ),
      downloadInvoice: jest.fn().mockReturnValue(of(new Blob(['invoice']))),
      downloadVoucher: jest.fn().mockReturnValue(of(new Blob(['voucher']))),
    };

    await TestBed.configureTestingModule({
      imports: [BookingConfirmationComponent],
      providers: [
        provideRouter([]),
        { provide: ActiveBookingService, useValue: activeBookingService },
        { provide: BookingService, useValue: bookingService },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: (key: string) => ({ ref: 'BK123' } as Record<string, string>)[key] ?? null,
              },
            },
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(BookingConfirmationComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    expect(bookingService.getBookingByRef).toHaveBeenCalledWith('BK123');
    expect(activeBookingService.markBookingConfirmed).toHaveBeenCalledWith(
      expect.objectContaining({ booking_ref: 'BK123', payment_status: 'paid' }),
    );
    expect(component.bookingRef).toBe('BK123');
    expect(component.booking?.payment_status).toBe('paid');
    expect(component.loading).toBe(false);
  });

  it('downloads invoice and voucher for the confirmed booking', async () => {
    const activeBookingService = {
      markBookingConfirmed: jest.fn(),
    };
    const bookingService = {
      getBookingByRef: jest.fn().mockReturnValue(
        of({
          id: 77,
          booking_ref: 'BK777',
          room: { hotel_name: 'The Grand Azure', location: 'New York' },
          check_in: '2026-04-10T00:00:00Z',
          check_out: '2026-04-12T00:00:00Z',
          guests: 2,
          adults: 2,
          children: 0,
          infants: 0,
          total_amount: 450,
          status: 'confirmed',
          payment_status: 'paid',
        }),
      ),
      downloadInvoice: jest.fn().mockReturnValue(of(new Blob(['invoice']))),
      downloadVoucher: jest.fn().mockReturnValue(of(new Blob(['voucher']))),
    };

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: jest.fn(() => 'blob:invoice'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: jest.fn(),
    });
    const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    await TestBed.configureTestingModule({
      imports: [BookingConfirmationComponent],
      providers: [
        provideRouter([]),
        { provide: ActiveBookingService, useValue: activeBookingService },
        { provide: BookingService, useValue: bookingService },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: (key: string) => ({ ref: 'BK777' } as Record<string, string>)[key] ?? null,
              },
            },
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(BookingConfirmationComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.downloadInvoice();
    component.downloadVoucher();

    expect(bookingService.downloadInvoice).toHaveBeenCalledWith(77, 'BK777');
    expect(bookingService.downloadVoucher).toHaveBeenCalledWith(77, 'BK777');
    expect(clickSpy).toHaveBeenCalledTimes(2);

    clickSpy.mockRestore();
  });

  it('shows an error when booking lookup fails', async () => {
    const activeBookingService = {
      markBookingConfirmed: jest.fn(),
    };
    const bookingService = {
      getBookingByRef: jest.fn().mockReturnValue(throwError(() => new Error('boom'))),
    };

    await TestBed.configureTestingModule({
      imports: [BookingConfirmationComponent],
      providers: [
        provideRouter([]),
        { provide: ActiveBookingService, useValue: activeBookingService },
        { provide: BookingService, useValue: bookingService },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: (key: string) => ({ ref: 'BK404' } as Record<string, string>)[key] ?? null,
              },
            },
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(BookingConfirmationComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    expect(component.error).toContain('could not load');
    expect(activeBookingService.markBookingConfirmed).not.toHaveBeenCalled();
    expect(component.loading).toBe(false);
  });

  it('shows an error when the confirmation link has no booking reference', async () => {
    const activeBookingService = {
      markBookingConfirmed: jest.fn(),
    };
    const bookingService = {
      getBookingByRef: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [BookingConfirmationComponent],
      providers: [
        provideRouter([]),
        { provide: ActiveBookingService, useValue: activeBookingService },
        { provide: BookingService, useValue: bookingService },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: () => null,
              },
            },
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(BookingConfirmationComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    expect(bookingService.getBookingByRef).not.toHaveBeenCalled();
    expect(activeBookingService.markBookingConfirmed).not.toHaveBeenCalled();
    expect(component.error).toContain('reference is missing');
    expect(component.loading).toBe(false);
  });

  it('does not download when booking is null', async () => {
    const bookingService = {
      getBookingByRef: jest.fn(),
      downloadInvoice: jest.fn(),
      downloadVoucher: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [BookingConfirmationComponent],
      providers: [
        provideRouter([]),
        { provide: ActiveBookingService, useValue: { markBookingConfirmed: jest.fn() } },
        { provide: BookingService, useValue: bookingService },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: () => null } } },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(BookingConfirmationComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.downloadInvoice();
    component.downloadVoucher();

    expect(bookingService.downloadInvoice).not.toHaveBeenCalled();
    expect(bookingService.downloadVoucher).not.toHaveBeenCalled();
  });
});
