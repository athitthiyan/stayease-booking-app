import { of, throwError } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { LandingComponent } from './landing.component';
import { RoomService } from '../../core/services/room.service';
import { BookingSearchStore } from '../../core/services/booking-search.store';

describe('LandingComponent', () => {
  const roomService = {
    getFeaturedRooms: jest.fn(),
  };

  beforeEach(async () => {
    roomService.getFeaturedRooms.mockReset();

    await TestBed.configureTestingModule({
      imports: [LandingComponent],
      providers: [
        provideRouter([]),
        { provide: RoomService, useValue: roomService },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    sessionStorage.clear();
    jest.restoreAllMocks();
  });

  it('loads featured rooms successfully', () => {
    roomService.getFeaturedRooms.mockReturnValue(of([{ id: 1, hotel_name: 'Azure' }]));

    const fixture = TestBed.createComponent(LandingComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    expect(roomService.getFeaturedRooms).toHaveBeenCalledWith(6);
    expect(component.featuredRooms()).toEqual([{ id: 1, hotel_name: 'Azure' }]);
    expect(component.roomsError()).toBe(false);
    expect(component.loadingRooms()).toBe(false);
    expect(component.destinations.length).toBe(5);
    expect(component.features.length).toBe(4);
    expect(component.testimonials.length).toBe(3);
    expect(component.particles.length).toBe(20);
  });

  it('handles featured room load failure', () => {
    roomService.getFeaturedRooms.mockReturnValue(throwError(() => new Error('boom')));

    const fixture = TestBed.createComponent(LandingComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    expect(component.featuredRooms()).toEqual([]);
    expect(component.roomsError()).toBe(true);
    expect(component.loadingRooms()).toBe(false);
  });

  it('builds search params and navigates', () => {
    roomService.getFeaturedRooms.mockReturnValue(of([]));

    const fixture = TestBed.createComponent(LandingComponent);
    const component = fixture.componentInstance;
    const router = TestBed.inject(Router);
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);

    component.searchCity = 'Bali';
    component.checkIn = '2026-05-01';
    component.checkOut = '2026-05-05';
    component.guests = 3;

    component.search();

    expect(navigateSpy).toHaveBeenCalledWith(['/search'], {
      queryParams: expect.objectContaining({
        city: 'Bali',
        check_in: '2026-05-01',
        check_out: '2026-05-05',
        guests: '3',
        adults: '2',
        destination: 'Bali',
      }),
    });
  });

  it('omits empty search params', () => {
    roomService.getFeaturedRooms.mockReturnValue(of([]));

    const fixture = TestBed.createComponent(LandingComponent);
    const component = fixture.componentInstance;
    const router = TestBed.inject(Router);
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);

    component.searchCity = '';
    component.checkIn = '';
    component.checkOut = '';
    component.guests = 0 as never;

    component.search();

    expect(navigateSpy).toHaveBeenCalledWith(['/search'], { queryParams: expect.objectContaining({ adults: '2' }) });
  });

  it('restores recent search state and shows the recovery banner when destination is empty', () => {
    roomService.getFeaturedRooms.mockReturnValue(of([]));

    const fixture = TestBed.createComponent(LandingComponent);
    const component = fixture.componentInstance;
    const store = TestBed.inject(BookingSearchStore);
    jest.spyOn(store, 'hasRecentSearch').mockReturnValue(true);

    store.patchState({
      destination: '',
      checkIn: '2026-06-10',
      checkOut: '2026-06-12',
      adults: 3,
      children: 1,
      infants: 1,
    });

    component.ngOnInit();

    expect(component.checkIn).toBe('2026-06-10');
    expect(component.checkOut).toBe('2026-06-12');
    expect(component.guestSelection).toEqual({ adults: 3, children: 1, infants: 1 });
    expect(component.guests).toBe(4);
    expect(component.showRecoveryBanner()).toBe(true);
  });

  it('updates dates and validates past and same-day ranges', () => {
    roomService.getFeaturedRooms.mockReturnValue(of([]));

    const fixture = TestBed.createComponent(LandingComponent);
    const component = fixture.componentInstance;
    const store = TestBed.inject(BookingSearchStore);
    const updateDatesSpy = jest.spyOn(store, 'updateDates');

    component.onDateChange({ checkIn: '2020-01-01', checkOut: '2020-01-02' });
    expect(updateDatesSpy).toHaveBeenCalledWith('2020-01-01', '2020-01-02');
    expect(component.searchValidationError).toBe('Check-in date cannot be in the past');

    component.onDateChange({ checkIn: '2030-01-05', checkOut: '2030-01-05' });
    expect(component.searchValidationError).toBe('Check-out must be after check-in (minimum 1 night)');
  });

  it('updates guests through the store and resumes a dismissed recovery search', () => {
    roomService.getFeaturedRooms.mockReturnValue(of([]));

    const fixture = TestBed.createComponent(LandingComponent);
    const component = fixture.componentInstance;
    const router = TestBed.inject(Router);
    const store = TestBed.inject(BookingSearchStore);
    const updateGuestsSpy = jest.spyOn(store, 'updateGuests');
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);

    store.patchState({
      destination: 'Jaipur',
      checkIn: '2030-07-01',
      checkOut: '2030-07-03',
      adults: 2,
      children: 1,
      infants: 0,
    });
    component.showRecoveryBanner.set(true);

    component.onGuestChange({ adults: 2, children: 2, infants: 1 });
    expect(component.guests).toBe(4);
    expect(updateGuestsSpy).toHaveBeenCalledWith(2, 2, 1);

    component.resumeSearch();

    expect(component.showRecoveryBanner()).toBe(false);
    expect(component.searchCity).toBe('Jaipur');
    expect(component.checkIn).toBe('2030-07-01');
    expect(component.checkOut).toBe('2030-07-03');
    expect(navigateSpy).toHaveBeenCalledWith(['/search'], {
      queryParams: expect.objectContaining({
        destination: 'Jaipur',
        city: 'Jaipur',
        check_in: '2030-07-01',
        check_out: '2030-07-03',
        guests: '4',
        adults: '2',
        children: '2',
        infants: '1',
      }),
    });
  });

  it('blocks navigation when validation fails and lets users dismiss recovery', () => {
    roomService.getFeaturedRooms.mockReturnValue(of([]));

    const fixture = TestBed.createComponent(LandingComponent);
    const component = fixture.componentInstance;
    const router = TestBed.inject(Router);
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);
    const event = { stopPropagation: jest.fn() } as unknown as MouseEvent;

    component.checkIn = '2020-01-01';
    component.checkOut = '2020-01-02';
    component.search();
    expect(navigateSpy).not.toHaveBeenCalled();

    component.showRecoveryBanner.set(true);
    component.dismissRecovery(event);
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(component.showRecoveryBanner()).toBe(false);
  });
});
