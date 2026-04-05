import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActiveBookingCtaBarComponent } from './active-booking-cta-bar.component';
import { ActiveHold } from '../../../core/models/booking.model';
import { ActiveBookingService } from '../../../core/services/active-booking.service';

const hold = (overrides: Partial<ActiveHold> = {}): ActiveHold => ({
  booking_id: 14,
  room_id: 1,
  hotel_name: 'Serenity Beach Resort',
  room_name: 'suite',
  check_in: '2026-05-01',
  check_out: '2026-05-03',
  guests: 2,
  expires_at: '2026-05-01T10:10:00.000Z',
  remaining_seconds: 523,
  ...overrides,
});

describe('ActiveBookingCtaBarComponent', () => {
  let activeHold: ReturnType<typeof signal<ActiveHold | null>>;
  let loadError: ReturnType<typeof signal<string>>;
  let toastMessage: ReturnType<typeof signal<string>>;
  let remainingSeconds: ReturnType<typeof signal<number>>;
  let canContinue: ReturnType<typeof signal<boolean>>;
  let activeBookingService: {
    activeHold: typeof activeHold;
    loadError: typeof loadError;
    toastMessage: typeof toastMessage;
    remainingSeconds: typeof remainingSeconds;
    canContinue: typeof canContinue;
    continueBooking: jest.Mock;
    cancelActiveBooking: jest.Mock;
    retryLoad: jest.Mock;
  };

  beforeEach(async () => {
    activeHold = signal<ActiveHold | null>(null);
    loadError = signal('');
    toastMessage = signal('');
    remainingSeconds = signal(0);
    canContinue = signal(false);
    activeBookingService = {
      activeHold,
      loadError,
      toastMessage,
      remainingSeconds,
      canContinue,
      continueBooking: jest.fn(),
      cancelActiveBooking: jest.fn(),
      retryLoad: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ActiveBookingCtaBarComponent],
      providers: [{ provide: ActiveBookingService, useValue: activeBookingService }],
    }).compileComponents();
  });

  it('renders the active booking CTA bar with a live countdown', () => {
    activeHold.set(hold());
    remainingSeconds.set(523);
    canContinue.set(true);

    const fixture = TestBed.createComponent(ActiveBookingCtaBarComponent);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('You already have an active booking hold');
    expect(element.textContent).toContain('08:43');
    expect(element.textContent).toContain('Serenity Beach Resort');
  });

  it('triggers continue and cancel actions', () => {
    activeHold.set(hold());
    remainingSeconds.set(180);
    canContinue.set(true);

    const fixture = TestBed.createComponent(ActiveBookingCtaBarComponent);
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('button');
    (buttons[0] as HTMLButtonElement).click();
    (buttons[1] as HTMLButtonElement).click();

    expect(activeBookingService.continueBooking).toHaveBeenCalled();
    expect(activeBookingService.cancelActiveBooking).toHaveBeenCalled();
  });

  it('renders the retry bar when active booking retrieval fails', () => {
    loadError.set('Unable to retrieve active booking.');

    const fixture = TestBed.createComponent(ActiveBookingCtaBarComponent);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Unable to retrieve active booking');
    expect(element.textContent).toContain('Retry');

    const retryButton = element.querySelector('button') as HTMLButtonElement;
    retryButton.click();
    expect(activeBookingService.retryLoad).toHaveBeenCalled();
  });

  it('renders transient toast messages', () => {
    toastMessage.set('Booking hold expired.');

    const fixture = TestBed.createComponent(ActiveBookingCtaBarComponent);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Booking hold expired.');
  });
});
