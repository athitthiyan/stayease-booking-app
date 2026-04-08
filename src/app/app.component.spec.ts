import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { AppComponent, shouldShowMaintenanceMode } from './app.component';
import { AuthService } from './core/services/auth.service';
import { ActiveBookingService } from './core/services/active-booking.service';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        {
          provide: AuthService,
          useValue: {
            isAuthenticated: jest.fn(() => false),
            currentUser: jest.fn(() => null),
            logout: jest.fn(),
          },
        },
        {
          provide: ActiveBookingService,
          useValue: {
            activeHold: jest.fn(() => null),
            loadError: jest.fn(() => ''),
            toastMessage: jest.fn(() => ''),
            shouldShowActiveReservation: jest.fn(() => false),
            canContinue: jest.fn(() => false),
            continueBooking: jest.fn(),
            cancelActiveBooking: jest.fn(),
            retryLoad: jest.fn(),
            remainingSeconds: jest.fn(() => 0),
          },
        },
      ],
    }).compileComponents();
  });

  it('renders the shared shell', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('app-coming-soon')).toBeNull();
    expect(element.querySelector('app-navbar')).not.toBeNull();
    expect(element.querySelector('app-active-booking-cta-bar')).not.toBeNull();
    expect(element.querySelector('router-outlet')).not.toBeNull();
    expect(element.querySelector('app-footer')).not.toBeNull();
  });

  it('enables maintenance mode only for configured hosts', () => {
    expect(
      shouldShowMaintenanceMode('stayease-booking-app.vercel.app', {
        maintenanceMode: false,
        maintenanceHosts: ['www.stayvora.co.in'],
      }),
    ).toBe(false);

    expect(
      shouldShowMaintenanceMode('www.stayvora.co.in', {
        maintenanceMode: false,
        maintenanceHosts: ['www.stayvora.co.in'],
      }),
    ).toBe(true);

    expect(
      shouldShowMaintenanceMode('any-host.example', {
        maintenanceMode: true,
        maintenanceHosts: [],
      }),
    ).toBe(true);
  });
});
