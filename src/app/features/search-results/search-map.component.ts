import {
  Component,
  AfterViewInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  Input,
  Output,
  EventEmitter,
  ElementRef,
  ViewChild,
  signal,
  inject,
  NgZone,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Room } from '../../core/models/room.model';
import * as L from 'leaflet';
import {
  ROOM_IMAGE_PLACEHOLDER,
  normalizeRoomImageUrl,
} from '../../shared/utils/image-fallback';

// Fix Leaflet default icon paths (webpack/angular CLI strips them)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'assets/marker-icon-2x.png',
  iconUrl: 'assets/marker-icon.png',
  shadowUrl: 'assets/marker-shadow.png',
});

/** Haversine distance in km */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

@Component({
  selector: 'app-search-map',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <!-- Clean map-only container — no sidebar, no floating list -->
    <div class="map-wrapper">
      <div #mapEl class="map-wrapper__leaflet"></div>

      <!-- Map Controls — top right -->
      <div class="map-controls">
        <button
          type="button"
          class="map-ctrl-btn"
          (click)="locateUser()"
          [disabled]="locating()"
          aria-label="Locate me"
        >
          @if (locating()) {
            <span class="map-ctrl-btn__spinner"></span>
          } @else {
            <span class="map-ctrl-btn__icon">▶</span>
          }
          <span class="map-ctrl-btn__text">Locate Me</span>
        </button>

        <button
          type="button"
          class="map-ctrl-btn"
          (click)="fitAllMarkers()"
          aria-label="Fit all markers"
        >
          <span class="map-ctrl-btn__icon">⊞</span>
          <span class="map-ctrl-btn__text">Fit All</span>
        </button>

        <button
          type="button"
          class="map-ctrl-btn map-ctrl-btn--search"
          (click)="searchThisArea()"
          [class.map-ctrl-btn--visible]="showSearchArea()"
          aria-label="Search this area"
        >
          <span class="map-ctrl-btn__icon">↻</span>
          <span class="map-ctrl-btn__text">Search This Area</span>
        </button>
      </div>

      <!-- No-results overlay inside map -->
      @if (rooms.length === 0 && !locating()) {
        <div class="map-empty">
          <span>No stays in this area</span>
          <small>Try zooming out or searching a different area</small>
        </div>
      }

      <!-- Active Room Popup Card (bottom center) -->
      @if (activeRoom()) {
        <div class="map-popup">
          <button type="button" class="map-popup__close" (click)="clearActive()" aria-label="Close">&times;</button>
          <img
            [src]="resolveImage(activeRoom()!.image_url)"
            [alt]="activeRoom()!.hotel_name"
            class="map-popup__img"
            (error)="onImgError($event)"
          />
          <div class="map-popup__body">
            <div class="map-popup__top">
              <span class="map-popup__type">{{ activeRoom()!.room_type | titlecase }}</span>
              @if (activeRoom()!.is_featured) {
                <span class="map-popup__badge">Featured</span>
              }
            </div>
            <h3 class="map-popup__name">{{ activeRoom()!.hotel_name }}</h3>
            <p class="map-popup__loc">{{ activeRoom()!.location || activeRoom()!.city }}</p>
            <div class="map-popup__stats">
              <span>{{ activeRoom()!.rating }} ★ ({{ activeRoom()!.review_count }})</span>
              <span>{{ activeRoom()!.beds }} Bed · {{ activeRoom()!.bathrooms }} Bath</span>
            </div>
            <div class="map-popup__footer">
              <div class="map-popup__price">
                @if (activeRoom()!.original_price) {
                  <span class="map-popup__price-old">₹{{ activeRoom()!.original_price }}</span>
                }
                <span class="map-popup__price-now">₹{{ activeRoom()!.price }}</span>
                <small>/night</small>
              </div>
              <div class="map-popup__actions">
                <a class="map-popup__cta" [routerLink]="['/rooms', activeRoom()!.id]">View</a>
                <button type="button" class="map-popup__dir" (click)="openDirections(activeRoom()!)">Directions</button>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- Legend -->
      <div class="map-legend">
        <span class="map-legend__dot map-legend__dot--hotel"></span> Hotels
        @if (userLocation()) {
          <span class="map-legend__dot map-legend__dot--user"></span> You
        }
      </div>
    </div>
  `,
  styleUrl: './search-map.component.scss',
})
export class SearchMapComponent implements AfterViewInit, OnDestroy, OnChanges {
  @ViewChild('mapEl') mapEl!: ElementRef<HTMLDivElement>;
  @Input() rooms: Room[] = [];
  @Input() hoveredRoomId: number | null = null;
  @Input() cityLabel = '';
  @Output() roomSelected = new EventEmitter<Room>();
  @Output() searchArea = new EventEmitter<{ north: number; south: number; east: number; west: number }>();

  private ngZone = inject(NgZone);
  private map!: L.Map;
  private markerLayer = L.layerGroup();
  private clusterGroup: L.LayerGroup | null = null;
  private markers = new Map<number, L.Marker>();
  private userMarker: L.Marker | null = null;
  private userCircle: L.Circle | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private orientationHandler: (() => void) | null = null;
  private geoPromptShown = false;
  private previousBounds: L.LatLngBounds | null = null;
  private tileLayer: L.TileLayer | null = null;

  activeRoom = signal<Room | null>(null);
  activeRoomId = signal<number | null>(null);
  userLocation = signal<{ lat: number; lng: number } | null>(null);
  locating = signal(false);
  showSearchArea = signal(false);

  // City center fallback (Chennai)
  private readonly FALLBACK_CENTER: [number, number] = [13.0827, 80.2707];
  private readonly FALLBACK_ZOOM = 12;

  private readonly TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
  private readonly TILE_ATTR =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>';

  resolveImage(url?: string): string {
    return normalizeRoomImageUrl(url) || ROOM_IMAGE_PLACEHOLDER;
  }

  onImgError(event: Event): void {
    (event.target as HTMLImageElement).src = ROOM_IMAGE_PLACEHOLDER;
  }

  getDistance(room: Room): string {
    const loc = this.userLocation();
    if (!loc || !room.latitude || !room.longitude) return '';
    return haversineKm(loc.lat, loc.lng, room.latitude, room.longitude).toFixed(1);
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────

  ngAfterViewInit(): void {
    this.ngZone.runOutsideAngular(() => {
      this.initMap();

      // ResizeObserver: fix grey tiles on ANY container resize
      this.resizeObserver = new ResizeObserver(() => {
        this.map?.invalidateSize({ animate: false });
      });
      this.resizeObserver.observe(this.mapEl.nativeElement);

      // Orientation change handler (SCENARIO 6)
      this.orientationHandler = () => {
        setTimeout(() => this.map?.invalidateSize({ animate: true }), 300);
      };
      window.addEventListener('orientationchange', this.orientationHandler);
    });
  }

  private _prevHoveredId: number | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['rooms'] && this.map) {
      this.renderMarkers();
    }
    // Sync hover from parent (card hovered → glow marker on map)
    if (changes['hoveredRoomId'] && this.map) {
      if (this._prevHoveredId && this._prevHoveredId !== this.hoveredRoomId) {
        this.unhighlightMarker(this._prevHoveredId);
      }
      if (this.hoveredRoomId) {
        this.highlightMarker(this.hoveredRoomId);
      }
      this._prevHoveredId = this.hoveredRoomId;
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    if (this.orientationHandler) {
      window.removeEventListener('orientationchange', this.orientationHandler);
    }
    this.map?.remove();
  }

  // ── Map Init ──────────────────────────────────────────────────────────

  private initMap(): void {
    this.map = L.map(this.mapEl.nativeElement, {
      center: this.FALLBACK_CENTER,
      zoom: this.FALLBACK_ZOOM,
      zoomControl: false,
      attributionControl: false,
    });

    // Tiles with error retry (SCENARIO 5)
    this.tileLayer = L.tileLayer(this.TILES, {
      attribution: this.TILE_ATTR,
      maxZoom: 19,
      subdomains: 'abcd',
      errorTileUrl: '', // Suppress broken tile images
    }).addTo(this.map);

    // Handle tile load errors — retry
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.tileLayer.on('tileerror', (e: any) => {
      setTimeout(() => {
        if (e.tile && e.tile.src) {
          const src = e.tile.src;
          e.tile.src = '';
          e.tile.src = src; // Retry by reassigning src
        }
      }, 2000);
    });

    L.control.zoom({ position: 'topright' }).addTo(this.map);
    L.control.attribution({ position: 'bottomright', prefix: false }).addTo(this.map);

    this.markerLayer.addTo(this.map);
    this.renderMarkers();

    // Show "Search This Area" after user drags/zooms
    this.map.on('moveend', () => {
      this.ngZone.run(() => this.showSearchArea.set(true));
    });

    // Invalidate after initial render — prevents grey tiles
    setTimeout(() => this.map.invalidateSize(), 100);
    setTimeout(() => this.map.invalidateSize(), 400);
    setTimeout(() => this.map.invalidateSize(), 1000);
  }

  // ── Markers ───────────────────────────────────────────────────────────

  private renderMarkers(): void {
    this.markerLayer.clearLayers();
    if (this.clusterGroup) {
      this.clusterGroup.clearLayers();
      this.map.removeLayer(this.clusterGroup);
    }
    this.markers.clear();

    const geoRooms = this.rooms.filter(r => r.latitude && r.longitude);
    if (geoRooms.length === 0) return;

    // Use MarkerClusterGroup if available (PHASE 6)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const useCluster = geoRooms.length > 5 && typeof (L as any).markerClusterGroup === 'function';

    if (useCluster) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.clusterGroup = (L as any).markerClusterGroup({
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        animate: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        iconCreateFunction: (cluster: any) => {
          const count = cluster.getChildCount();
          const size = count < 10 ? 44 : count < 25 ? 54 : 64;
          return L.divIcon({
            className: '',
            html: `<div class="cluster-pill" style="width:${size}px;height:${size}px">
              <span>${count} stays</span>
            </div>`,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
          });
        },
      });
    }

    const targetLayer = this.clusterGroup || this.markerLayer;

    for (const room of geoRooms) {
      const icon = this.createPriceIcon(room);
      const marker = L.marker([room.latitude!, room.longitude!], { icon })
        .on('click', () => {
          this.ngZone.run(() => {
            this.activeRoom.set(room);
            this.activeRoomId.set(room.id);
            this.roomSelected.emit(room);
          });
          this.map.flyTo([room.latitude!, room.longitude!], Math.max(this.map.getZoom(), 14), { duration: 0.6 });
        })
        .on('mouseover', () => {
          this.ngZone.run(() => this.highlightMarker(room.id));
        })
        .on('mouseout', () => {
          this.ngZone.run(() => this.unhighlightMarker(room.id));
        });

      marker.addTo(targetLayer);
      this.markers.set(room.id, marker);
    }

    if (this.clusterGroup) {
      this.clusterGroup.addTo(this.map);
    }

    this.fitAllMarkers();

    // Auto-prompt for geolocation on first load
    if (!this.geoPromptShown && !this.userLocation()) {
      this.geoPromptShown = true;
      this.promptGeolocation();
    }
  }

  private promptGeolocation(): void {
    if (!navigator.geolocation || !navigator.permissions) return;
    navigator.permissions.query({ name: 'geolocation' }).then(result => {
      if (result.state === 'granted') {
        this.locateUser();
      }
    }).catch(() => {});
  }

  private createPriceIcon(room: Room, active = false): L.DivIcon {
    const cls = active ? 'price-pill price-pill--active' : 'price-pill';
    const price = room.price >= 1000
      ? `₹${room.price.toLocaleString('en-IN')}`
      : `₹${room.price}`;
    return L.divIcon({
      className: 'price-pill-wrapper',
      html: `<div class="${cls}">${price}</div>`,
      iconSize: [80, 36],
      iconAnchor: [40, 18],
    });
  }

  // ── Public actions ────────────────────────────────────────────────────

  focusRoom(room: Room): void {
    this.activeRoom.set(room);
    this.activeRoomId.set(room.id);
    this.roomSelected.emit(room);
    if (room.latitude && room.longitude) {
      this.map.flyTo([room.latitude, room.longitude], 15, { duration: 0.8 });
      const marker = this.markers.get(room.id);
      if (marker) {
        marker.setIcon(this.createPriceIcon(room, true));
      }
    }
  }

  highlightMarker(roomId: number): void {
    const room = this.rooms.find(r => r.id === roomId);
    const marker = this.markers.get(roomId);
    if (room && marker) {
      marker.setIcon(this.createPriceIcon(room, true));
    }
  }

  unhighlightMarker(roomId: number): void {
    const room = this.rooms.find(r => r.id === roomId);
    const marker = this.markers.get(roomId);
    if (room && marker && this.activeRoomId() !== roomId) {
      marker.setIcon(this.createPriceIcon(room, false));
    }
  }

  clearActive(): void {
    const prev = this.activeRoomId();
    if (prev) {
      const room = this.rooms.find(r => r.id === prev);
      const marker = this.markers.get(prev);
      if (room && marker) marker.setIcon(this.createPriceIcon(room, false));
    }
    this.activeRoom.set(null);
    this.activeRoomId.set(null);
  }

  fitAllMarkers(): void {
    const geoRooms = this.rooms.filter(r => r.latitude && r.longitude);
    if (geoRooms.length === 0) {
      // No rooms — center on city fallback
      this.map.setView(this.FALLBACK_CENTER, this.FALLBACK_ZOOM);
      return;
    }

    const bounds = L.latLngBounds(geoRooms.map(r => [r.latitude!, r.longitude!] as L.LatLngTuple));
    if (this.userLocation()) {
      bounds.extend([this.userLocation()!.lat, this.userLocation()!.lng]);
    }
    this.map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15, animate: true });
  }

  searchThisArea(): void {
    if (!this.map) return;
    const bounds = this.map.getBounds();
    this.searchArea.emit({
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
    });
    this.showSearchArea.set(false);
  }

  /** PHASE 3 — Locate Me: flyTo zoom 15, blue pulse marker, radius circle */
  locateUser(): void {
    if (!navigator.geolocation) return;
    this.locating.set(true);

    navigator.geolocation.getCurrentPosition(
      pos => {
        this.ngZone.run(() => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          this.userLocation.set(loc);
          this.locating.set(false);

          // Add/update user marker
          if (this.userMarker) {
            this.userMarker.setLatLng([loc.lat, loc.lng]);
          } else {
            const userIcon = L.divIcon({
              className: '',
              html: `<div class="user-marker"><div class="user-marker__pulse"></div><div class="user-marker__dot"></div></div>`,
              iconSize: [40, 40],
              iconAnchor: [20, 20],
            });
            this.userMarker = L.marker([loc.lat, loc.lng], { icon: userIcon, zIndexOffset: 1000 })
              .addTo(this.map);
          }

          // Add/update radius circle (500m–1km)
          if (this.userCircle) {
            this.userCircle.setLatLng([loc.lat, loc.lng]);
          } else {
            this.userCircle = L.circle([loc.lat, loc.lng], {
              radius: 800, // 800m radius
              color: 'rgba(99, 199, 212, 0.4)',
              fillColor: 'rgba(99, 199, 212, 0.08)',
              fillOpacity: 0.3,
              weight: 1.5,
            }).addTo(this.map);
          }

          // CRITICAL: flyTo user location at zoom 15 — NOT fitAllMarkers
          this.map.flyTo([loc.lat, loc.lng], 15, {
            animate: true,
            duration: 1.5,
          });
        });
      },
      () => {
        // SCENARIO 1 & 10: No geolocation / timeout → fallback to city center
        this.ngZone.run(() => {
          this.locating.set(false);
          this.map.flyTo(this.FALLBACK_CENTER, this.FALLBACK_ZOOM, {
            animate: true,
            duration: 1.0,
          });
        });
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  /** Save bounds before fullscreen, restore after */
  saveBounds(): void {
    this.previousBounds = this.map?.getBounds() || null;
  }

  restoreBounds(): void {
    if (this.previousBounds) {
      this.map?.fitBounds(this.previousBounds, { animate: true });
      this.previousBounds = null;
    }
  }

  /** Force invalidate — called by parent after fullscreen/resize */
  invalidate(): void {
    setTimeout(() => this.map?.invalidateSize({ animate: false }), 50);
    setTimeout(() => this.map?.invalidateSize({ animate: false }), 300);
  }

  openDirections(room: Room): void {
    if (!room.latitude || !room.longitude) return;
    const destination = `${room.latitude},${room.longitude}`;
    const userLoc = this.userLocation();
    const origin = userLoc ? `${userLoc.lat},${userLoc.lng}` : '';
    const url = origin
      ? `https://www.google.com/maps/dir/${origin}/${destination}`
      : `https://www.google.com/maps/dir//${destination}`;
    window.open(url, '_blank');
  }
}
