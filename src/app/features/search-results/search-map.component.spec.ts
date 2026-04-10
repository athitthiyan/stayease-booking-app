jest.mock('leaflet', () => {
  const mapHandlers = new Map<string, (...args: unknown[]) => void>();
  const tileHandlers = new Map<string, (...args: unknown[]) => void>();

  const mapInstance: Record<string, jest.Mock> = {
    setView: jest.fn(),
    fitBounds: jest.fn(),
    flyTo: jest.fn(),
    remove: jest.fn(),
    invalidateSize: jest.fn(),
    removeLayer: jest.fn(),
    getZoom: jest.fn(() => 12),
    getBounds: jest.fn(() => ({
      getNorth: () => 20,
      getSouth: () => 10,
      getEast: () => 30,
      getWest: () => 5,
    })),
    on: jest.fn(),
  };
  mapInstance['on'].mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
    mapHandlers.set(event, handler);
    return mapInstance;
  });

  const markerFactory = (): Record<string, unknown> => {
    const handlers = new Map<string, (...args: unknown[]) => void>();
    const marker: Record<string, unknown> = {
      on: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
        handlers.set(event, handler);
        return marker;
      }),
      addTo: jest.fn(() => marker),
      setIcon: jest.fn(() => marker),
      setLatLng: jest.fn(() => marker),
      __handlers: handlers,
    };
    return marker;
  };

  const layerGroupInstance: Record<string, jest.Mock> = {
    addTo: jest.fn(),
    clearLayers: jest.fn(),
  };
  layerGroupInstance['addTo'].mockImplementation(() => layerGroupInstance);

  const tileLayerInstance: Record<string, jest.Mock> = {
    addTo: jest.fn(),
    on: jest.fn(),
  };
  tileLayerInstance['addTo'].mockImplementation(() => tileLayerInstance);
  tileLayerInstance['on'].mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
    tileHandlers.set(event, handler);
    return tileLayerInstance;
  });

  const zoomControl = { addTo: jest.fn() };
  const attributionControl = { addTo: jest.fn() };

  const leaflet = {
    map: jest.fn(() => mapInstance),
    tileLayer: jest.fn(() => tileLayerInstance),
    layerGroup: jest.fn(() => layerGroupInstance),
    marker: jest.fn(() => markerFactory()),
    divIcon: jest.fn((options: unknown) => options),
    circle: jest.fn(() => ({
      addTo: jest.fn(),
      setLatLng: jest.fn(),
    })),
    control: {
      zoom: jest.fn(() => zoomControl),
      attribution: jest.fn(() => attributionControl),
    },
    latLngBounds: jest.fn((coords: unknown[]) => ({
      coords,
      extend: jest.fn(),
    })),
    Icon: {
      Default: {
        prototype: {},
        mergeOptions: jest.fn(),
      },
    },
    __mapInstance: mapInstance,
    __layerGroupInstance: layerGroupInstance,
    __tileLayerInstance: tileLayerInstance,
    __mapHandlers: mapHandlers,
    __tileHandlers: tileHandlers,
  };

  return leaflet;
});

import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import * as L from 'leaflet';

import { SearchMapComponent } from './search-map.component';
import { Room } from '../../core/models/room.model';
import { ROOM_IMAGE_PLACEHOLDER } from '../../shared/utils/image-fallback';

const baseRoom: Room = {
  id: 1,
  hotel_name: 'Serenity Beach Resort',
  room_type: 'suite',
  price: 420,
  original_price: 580,
  availability: true,
  rating: 4.8,
  review_count: 512,
  image_url: 'https://example.com/room.jpg',
  location: 'Bali, Indonesia',
  city: 'Bali',
  country: 'Indonesia',
  max_guests: 2,
  beds: 1,
  bathrooms: 2,
  is_featured: true,
  created_at: '2026-04-01T00:00:00.000Z',
  latitude: 1.23,
  longitude: 4.56,
};

function makeRoom(overrides: Partial<Room>): Room {
  return { ...baseRoom, ...overrides };
}

describe('SearchMapComponent', () => {
  let resizeObserverCallback: ResizeObserverCallback | undefined;
  const originalResizeObserver = global.ResizeObserver;
  const originalOpen = window.open;
  const originalGeo = navigator.geolocation;
  const originalPermissions = navigator.permissions;

  beforeEach(async () => {
    jest.useFakeTimers();
    Object.defineProperty(global, 'ResizeObserver', {
      writable: true,
      value: class {
        constructor(callback: ResizeObserverCallback) {
          resizeObserverCallback = callback;
        }

        observe = jest.fn();
        disconnect = jest.fn();
      },
    });

    Object.defineProperty(window, 'open', {
      writable: true,
      value: jest.fn(),
    });

    Object.defineProperty(navigator, 'geolocation', {
      writable: true,
      value: {
        getCurrentPosition: jest.fn(),
      },
    });

    Object.defineProperty(navigator, 'permissions', {
      writable: true,
      value: {
        query: jest.fn().mockResolvedValue({ state: 'granted' }),
      },
    });

    await TestBed.configureTestingModule({
      imports: [SearchMapComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
    Object.defineProperty(global, 'ResizeObserver', { writable: true, value: originalResizeObserver });
    Object.defineProperty(window, 'open', { writable: true, value: originalOpen });
    Object.defineProperty(navigator, 'geolocation', { writable: true, value: originalGeo });
    Object.defineProperty(navigator, 'permissions', { writable: true, value: originalPermissions });
  });

  it('initializes the map, renders markers, and reacts to resize and move events', async () => {
    const fixture = TestBed.createComponent(SearchMapComponent);
    const component = fixture.componentInstance;
    fixture.componentRef.setInput('rooms', [makeRoom({ id: 1 }), makeRoom({ id: 2, latitude: 2, longitude: 5 })]);
    fixture.detectChanges();
    component.ngAfterViewInit();
    await Promise.resolve();

    expect((L as unknown as { map: jest.Mock }).map).toHaveBeenCalled();
    expect((L as unknown as { marker: jest.Mock }).marker.mock.calls.length).toBeGreaterThanOrEqual(2);

    resizeObserverCallback?.([] as ResizeObserverEntry[], {} as ResizeObserver);
    expect((L as unknown as { __mapInstance: { invalidateSize: jest.Mock } }).__mapInstance.invalidateSize).toHaveBeenCalled();

    const moveEnd = (L as unknown as { __mapHandlers: Map<string, () => void> }).__mapHandlers.get('moveend');
    moveEnd?.();
    expect(component.showSearchArea()).toBe(true);
  });

  it('covers marker rendering edge cases, focus/highlight helpers, and clearing the active room', async () => {
    const leaflet = L as unknown as {
      markerClusterGroup?: jest.Mock;
      __mapInstance: { removeLayer: jest.Mock };
    };
    leaflet.markerClusterGroup = jest.fn(() => ({
      addTo: jest.fn(),
      clearLayers: jest.fn(),
    }));

    const fixture = TestBed.createComponent(SearchMapComponent);
    const component = fixture.componentInstance;
    fixture.componentRef.setInput('rooms', [
      makeRoom({ id: 1 }),
      makeRoom({ id: 2, latitude: 2, longitude: 5 }),
      makeRoom({ id: 3, latitude: 3, longitude: 6 }),
      makeRoom({ id: 4, latitude: 4, longitude: 7 }),
      makeRoom({ id: 5, latitude: 5, longitude: 8 }),
      makeRoom({ id: 6, latitude: 6, longitude: 9 }),
    ]);
    fixture.detectChanges();
    component.ngAfterViewInit();

    component.focusRoom(makeRoom({ id: 1 }));
    expect(component.activeRoomId()).toBe(1);

    component.highlightMarker(1);
    component.unhighlightMarker(2);
    component.clearActive();
    expect(component.activeRoom()).toBeNull();

    fixture.componentRef.setInput('rooms', [makeRoom({ id: 9, latitude: undefined, longitude: undefined })]);
    component.ngOnChanges({
      rooms: {
        currentValue: [makeRoom({ id: 9, latitude: undefined, longitude: undefined })],
        previousValue: [],
        firstChange: false,
        isFirstChange: () => false,
      },
    });
    expect(leaflet.__mapInstance.removeLayer).toHaveBeenCalled();
  });

  it('syncs hovered room changes and selected room scrolling behavior', () => {
    const fixture = TestBed.createComponent(SearchMapComponent);
    const component = fixture.componentInstance;
    fixture.componentRef.setInput('rooms', [makeRoom({ id: 5 })]);
    fixture.detectChanges();
    component.ngAfterViewInit();

    fixture.componentRef.setInput('hoveredRoomId', 5);
    component.ngOnChanges({
      hoveredRoomId: {
        currentValue: 5,
        previousValue: null,
        firstChange: false,
        isFirstChange: () => false,
      },
    });

    expect(component.activeRoomId()).toBeNull();
  });

  it('unhighlights the previous hovered marker when hover moves to a different room', () => {
    const fixture = TestBed.createComponent(SearchMapComponent);
    const component = fixture.componentInstance;
    fixture.componentRef.setInput('rooms', [makeRoom({ id: 5 }), makeRoom({ id: 6, latitude: 2, longitude: 5 })]);
    fixture.detectChanges();
    component.ngAfterViewInit();

    component.hoveredRoomId = 5;
    component.ngOnChanges({
      hoveredRoomId: {
        currentValue: 5,
        previousValue: null,
        firstChange: false,
        isFirstChange: () => false,
      },
    });

    const unhighlightSpy = jest.spyOn(component, 'unhighlightMarker');
    component.hoveredRoomId = 6;
    component.ngOnChanges({
      hoveredRoomId: {
        currentValue: 6,
        previousValue: 5,
        firstChange: false,
        isFirstChange: () => false,
      },
    });

    expect(unhighlightSpy).toHaveBeenCalledWith(5);
  });

  it('handles image helpers, distance calculation, no-room fit fallback, and search-area emission', () => {
    const fixture = TestBed.createComponent(SearchMapComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    component.ngAfterViewInit();

    expect(component.resolveImage(undefined)).toBe(ROOM_IMAGE_PLACEHOLDER);
    const target = { src: '' } as HTMLImageElement;
    component.onImgError({ target } as unknown as Event);
    expect(target.src).toBe(ROOM_IMAGE_PLACEHOLDER);

    expect(component.getDistance(makeRoom({ latitude: undefined, longitude: undefined }))).toBe('');
    component.userLocation.set({ lat: 13.0827, lng: 80.2707 });
    expect(component.getDistance(makeRoom({ latitude: 13.09, longitude: 80.28 }))).not.toBe('');

    fixture.componentRef.setInput('rooms', []);
    component.fitAllMarkers();
    expect((L as unknown as { __mapInstance: { setView: jest.Mock } }).__mapInstance.setView).toHaveBeenCalled();

    const emitSpy = jest.spyOn(component.searchArea, 'emit');
    component.showSearchArea.set(true);
    component.searchThisArea();
    expect(emitSpy).toHaveBeenCalledWith({ north: 20, south: 10, east: 30, west: 5 });
    expect(component.showSearchArea()).toBe(false);
  });

  it('locates the user successfully and falls back to the city center on geolocation failure', () => {
    const fixture = TestBed.createComponent(SearchMapComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    component.ngAfterViewInit();

    const getCurrentPosition = navigator.geolocation.getCurrentPosition as jest.Mock;
    getCurrentPosition.mockImplementation((success: PositionCallback) => {
      success({
        coords: {
          latitude: 13.0827,
          longitude: 80.2707,
          accuracy: 10,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
          toJSON: () => ({}),
        },
        timestamp: Date.now(),
        toJSON: () => ({}),
      } as GeolocationPosition);
    });

    component.locateUser();
    expect(component.userLocation()).toEqual({ lat: 13.0827, lng: 80.2707 });
    expect((L as unknown as { __mapInstance: { flyTo: jest.Mock } }).__mapInstance.flyTo).toHaveBeenCalledWith(
      [13.0827, 80.2707],
      15,
      expect.any(Object),
    );

    getCurrentPosition.mockImplementation((_success: PositionCallback, error?: PositionErrorCallback) => {
      error?.({
        code: 1,
        message: 'denied',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      });
    });

    component.locateUser();
    expect(component.locating()).toBe(false);
  });

  it('ignores locate requests before the map is ready', () => {
    const fixture = TestBed.createComponent(SearchMapComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    (component as unknown as { map: unknown }).map = null;
    component.locateUser();

    expect(navigator.geolocation.getCurrentPosition).not.toHaveBeenCalled();
    expect(component.locating()).toBe(false);
  });

  it('prompts geolocation, preserves bounds, invalidates, opens directions, and cleans up on destroy', async () => {
    const fixture = TestBed.createComponent(SearchMapComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    component.ngAfterViewInit();
    await Promise.resolve();

    (navigator.permissions.query as jest.Mock).mockRejectedValueOnce(new Error('permissions unavailable'));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (component as any).promptGeolocation();

    component.saveBounds();
    component.restoreBounds();
    component.invalidate();
    jest.runAllTimers();

    component.openDirections(makeRoom({ id: 3 }));
    expect(window.open).toHaveBeenCalled();
    component.openDirections(makeRoom({ id: 4, latitude: undefined, longitude: undefined }));

    const orientationHandler = jest.spyOn(window, 'removeEventListener');
    component.ngOnDestroy();
    expect(orientationHandler).toHaveBeenCalledWith('orientationchange', expect.any(Function));
    expect((L as unknown as { __mapInstance: { remove: jest.Mock } }).__mapInstance.remove).toHaveBeenCalled();
  });

  it('retries tile errors, builds cluster icons, handles marker events, and updates user marker and circle on repeat location', () => {
    const leaflet = L as unknown as {
      markerClusterGroup?: jest.Mock;
      __tileHandlers: Map<string, (event: { tile?: { src?: string } }) => void>;
      marker: jest.Mock;
    };
    const clusterConfig: { iconCreateFunction?: (cluster: { getChildCount: () => number }) => unknown } = {};
    leaflet.markerClusterGroup = jest.fn((options: typeof clusterConfig) => {
      Object.assign(clusterConfig, options);
      return {
        addTo: jest.fn(),
        clearLayers: jest.fn(),
      };
    });

    const fixture = TestBed.createComponent(SearchMapComponent);
    const component = fixture.componentInstance;
    fixture.componentRef.setInput('rooms', [
      makeRoom({ id: 1 }),
      makeRoom({ id: 2, latitude: 2, longitude: 5 }),
      makeRoom({ id: 3, latitude: 3, longitude: 6 }),
      makeRoom({ id: 4, latitude: 4, longitude: 7 }),
      makeRoom({ id: 5, latitude: 5, longitude: 8 }),
      makeRoom({ id: 6, latitude: 6, longitude: 9 }),
    ]);
    fixture.detectChanges();
    component.ngAfterViewInit();

    const tileError = leaflet.__tileHandlers.get('tileerror');
    const tile = { src: 'https://tiles.example/a.png' };
    tileError?.({ tile });
    jest.advanceTimersByTime(2000);
    expect(tile.src).toBe('https://tiles.example/a.png');

    const smallIcon = clusterConfig.iconCreateFunction?.({ getChildCount: () => 5 }) as { iconSize: [number, number] };
    const mediumIcon = clusterConfig.iconCreateFunction?.({ getChildCount: () => 15 }) as { iconSize: [number, number] };
    const largeIcon = clusterConfig.iconCreateFunction?.({ getChildCount: () => 35 }) as { iconSize: [number, number] };
    expect(smallIcon.iconSize).toEqual([44, 44]);
    expect(mediumIcon.iconSize).toEqual([54, 54]);
    expect(largeIcon.iconSize).toEqual([64, 64]);

    const createdMarker = leaflet.marker.mock.results.at(-1)?.value as { __handlers: Map<string, () => void> };
    const emitSpy = jest.spyOn(component.roomSelected, 'emit');
    createdMarker.__handlers.get('click')?.();
    createdMarker.__handlers.get('mouseover')?.();
    createdMarker.__handlers.get('mouseout')?.();
    expect(emitSpy).toHaveBeenCalled();

    const getCurrentPosition = navigator.geolocation.getCurrentPosition as jest.Mock;
    getCurrentPosition.mockImplementation((success: PositionCallback) => {
      success({
        coords: {
          latitude: 13.0827,
          longitude: 80.2707,
          accuracy: 10,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
          toJSON: () => ({}),
        },
        timestamp: Date.now(),
        toJSON: () => ({}),
      } as GeolocationPosition);
    });

    component.locateUser();
    component.locateUser();

    expect(component.userLocation()).toEqual({ lat: 13.0827, lng: 80.2707 });
  });
});
