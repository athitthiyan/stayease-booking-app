import { of, throwError } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';

import { BookingConfirmationComponent } from './booking-confirmation.component';
import { BookingService } from '../../core/services/booking.service';

describe('BookingConfirmationComponent', () => {
  it('loads booking details by reference', async () => {
    const bookingService = {
      getBookingByRef: jest.fn().mockReturnValue(
        of({
          booking_ref: 'BK123',
          room: { hotel_name: 'The Grand Azure', location: 'New York' },
          check_in: '2026-04-10T00:00:00Z',
          check_out: '2026-04-12T00:00:00Z',
          guests: 2,
          total_amount: 450,
          status: 'confirmed',
          payment_status: 'paid',
        })
      ),
    };

    await TestBed.configureTestingModule({
      imports: [BookingConfirmationComponent],
      providers: [
        provideRouter([]),
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
    expect(component.bookingRef).toBe('BK123');
    expect(component.booking?.payment_status).toBe('paid');
    expect(component.loading).toBe(false);
  });

  it('shows an error when booking lookup fails', async () => {
    const bookingService = {
      getBookingByRef: jest.fn().mockReturnValue(throwError(() => new Error('boom'))),
    };

    await TestBed.configureTestingModule({
      imports: [BookingConfirmationComponent],
      providers: [
        provideRouter([]),
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
    expect(component.loading).toBe(false);
  });

  it('shows an error when the confirmation link has no booking reference', async () => {
    const bookingService = {
      getBookingByRef: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [BookingConfirmationComponent],
      providers: [
        provideRouter([]),
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
    expect(component.error).toContain('reference is missing');
    expect(component.loading).toBe(false);
  });
});
