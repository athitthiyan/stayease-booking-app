import { of, throwError } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';

import { SearchResultsComponent } from './search-results.component';
import { RoomService } from '../../core/services/room.service';

describe('SearchResultsComponent', () => {
  let roomService: { getRooms: jest.Mock };

  beforeEach(async () => {
    roomService = { getRooms: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [SearchResultsComponent],
      providers: [
        provideRouter([]),
        { provide: RoomService, useValue: roomService },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams: of({ city: 'Paris', guests: '2', room_type: 'suite' }),
          },
        },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads rooms from query params on init', () => {
    roomService.getRooms.mockReturnValue(
      of({ rooms: [{ id: 1 }], total: 1, page: 1, per_page: 9 })
    );

    const fixture = TestBed.createComponent(SearchResultsComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    expect(roomService.getRooms).toHaveBeenCalled();
    expect(component.rooms().length).toBe(1);
    expect(component.total()).toBe(1);
    expect(component.loading()).toBe(false);
  });

  it('handles load error', () => {
    roomService.getRooms.mockReturnValue(throwError(() => new Error('boom')));

    const fixture = TestBed.createComponent(SearchResultsComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    expect(component.error()).toBe(true);
    expect(component.rooms()).toEqual([]);
    expect(component.loading()).toBe(false);
  });

  it('clears filters and paginates', () => {
    roomService.getRooms.mockReturnValue(
      of({ rooms: [], total: 0, page: 1, per_page: 9 })
    );
    const scrollSpy = jest.spyOn(window, 'scrollTo').mockImplementation(() => {});

    const fixture = TestBed.createComponent(SearchResultsComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    component.clearFilters();
    component.goToPage(2);

    expect(component.page()).toBe(2);
    expect(scrollSpy).toHaveBeenCalled();
  });
});
