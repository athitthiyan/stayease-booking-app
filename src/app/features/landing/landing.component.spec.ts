import { of, throwError } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { LandingComponent } from './landing.component';
import { RoomService } from '../../core/services/room.service';

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
      queryParams: {
        city: 'Bali',
        check_in: '2026-05-01',
        check_out: '2026-05-05',
        guests: 3,
      },
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

    expect(navigateSpy).toHaveBeenCalledWith(['/search'], { queryParams: {} });
  });
});
