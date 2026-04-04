import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';
import { Room } from '../../core/models/room.model';

@Component({
  selector: 'app-search-map-placeholder',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="map-shell" aria-label="Map view placeholder">
      <div class="map-shell__panel">
        <p class="map-shell__eyebrow">Map View Preview</p>
        <h3>Interactive map architecture is ready</h3>
        <p>
          This placeholder reserves the layout, responsive behavior, and lazy-loading boundary for a future
          provider such as Google Maps, Mapbox, or OpenStreetMap.
        </p>

        <div class="map-shell__meta">
          <span>{{ rooms().length }} stays in current results</span>
          <span>{{ cityLabel() }}</span>
        </div>

        <ul class="map-shell__list">
          @for (room of rooms().slice(0, 3); track room.id) {
            <li>
              <strong>{{ room.hotel_name }}</strong>
              <span>{{ room.location || room.city || 'Location coming soon' }}</span>
            </li>
          }
        </ul>
      </div>

      <div class="map-shell__canvas" role="img" aria-label="Static preview of future map surface">
        <div class="map-shell__grid"></div>
        <div class="map-shell__pin map-shell__pin--a"></div>
        <div class="map-shell__pin map-shell__pin--b"></div>
        <div class="map-shell__pin map-shell__pin--c"></div>
        <div class="map-shell__legend">Lazy-loaded map provider mounts here</div>
      </div>
    </section>
  `,
  styles: [`
    .map-shell {
      display: grid;
      grid-template-columns: minmax(260px, 340px) 1fr;
      gap: 20px;
      margin-top: 24px;
      padding: 20px;
      border: 1px solid var(--color-border);
      border-radius: 20px;
      background: rgba(11, 18, 32, 0.72);
      backdrop-filter: blur(18px);
    }

    .map-shell__eyebrow {
      margin: 0 0 6px;
      font-size: 11px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--color-primary);
    }

    .map-shell__panel h3 {
      margin: 0 0 8px;
      color: var(--color-text);
      font-size: 1.2rem;
    }

    .map-shell__panel p {
      margin: 0 0 14px;
      color: var(--color-text-muted);
      line-height: 1.6;
      font-size: 14px;
    }

    .map-shell__meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 16px;
    }

    .map-shell__meta span,
    .map-shell__legend {
      display: inline-flex;
      align-items: center;
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(212, 175, 55, 0.12);
      color: var(--color-primary);
      font-size: 12px;
      font-weight: 600;
    }

    .map-shell__list {
      margin: 0;
      padding: 0;
      list-style: none;
      display: grid;
      gap: 10px;
    }

    .map-shell__list li {
      padding: 12px 14px;
      border-radius: 14px;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.05);
    }

    .map-shell__list strong,
    .map-shell__list span {
      display: block;
    }

    .map-shell__list strong {
      color: var(--color-text);
      margin-bottom: 4px;
    }

    .map-shell__list span {
      color: var(--color-text-muted);
      font-size: 13px;
    }

    .map-shell__canvas {
      min-height: 320px;
      position: relative;
      overflow: hidden;
      border-radius: 18px;
      border: 1px solid rgba(255,255,255,0.08);
      background:
        radial-gradient(circle at 20% 20%, rgba(76, 201, 240, 0.16), transparent 28%),
        radial-gradient(circle at 80% 30%, rgba(212, 175, 55, 0.18), transparent 26%),
        linear-gradient(180deg, rgba(17, 24, 39, 0.96), rgba(10, 15, 26, 0.98));
    }

    .map-shell__grid {
      position: absolute;
      inset: 0;
      background-image:
        linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px);
      background-size: 36px 36px;
    }

    .map-shell__pin {
      position: absolute;
      width: 18px;
      height: 18px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      background: var(--color-primary);
      box-shadow: 0 0 0 8px rgba(212, 175, 55, 0.1);
    }

    .map-shell__pin::after {
      content: '';
      position: absolute;
      inset: 4px;
      border-radius: 50%;
      background: #fff;
    }

    .map-shell__pin--a { top: 22%; left: 26%; }
    .map-shell__pin--b { top: 38%; right: 22%; }
    .map-shell__pin--c { bottom: 18%; left: 48%; }

    .map-shell__legend {
      position: absolute;
      left: 16px;
      bottom: 16px;
    }

    @media (max-width: 900px) {
      .map-shell {
        grid-template-columns: 1fr;
      }

      .map-shell__canvas {
        min-height: 240px;
      }
    }
  `],
})
export class SearchMapPlaceholderComponent {
  readonly rooms = input<Room[]>([]);
  readonly cityLabel = input<string>('Flexible search area');
}
