import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink],
  template: `
    <footer class="footer">
      <div class="footer__glow"></div>
      <div class="container">
        <div class="footer__grid">
          <div class="footer__brand">
            <a routerLink="/" class="footer__logo">🏨 Stay<span>Ease</span></a>
            <p>Discover luxury stays worldwide. Premium hotel bookings with unmatched service.</p>
            <div class="footer__socials">
              <a href="#" aria-label="Twitter">𝕏</a>
              <a href="#" aria-label="Instagram">📸</a>
              <a href="#" aria-label="LinkedIn">💼</a>
            </div>
          </div>

          <div class="footer__col">
            <h4>Explore</h4>
            <ul>
              <li><a routerLink="/search">All Rooms</a></li>
              <li><a routerLink="/search?room_type=suite">Suites</a></li>
              <li><a routerLink="/search?room_type=penthouse">Penthouses</a></li>
              <li><a routerLink="/search?featured=true">Featured</a></li>
            </ul>
          </div>

          <div class="footer__col">
            <h4>Destinations</h4>
            <ul>
              <li><a routerLink="/search?city=New York">New York</a></li>
              <li><a routerLink="/search?city=Bali">Bali</a></li>
              <li><a routerLink="/search?city=Dubai">Dubai</a></li>
              <li><a routerLink="/search?city=Kyoto">Kyoto</a></li>
            </ul>
          </div>

          <div class="footer__col">
            <h4>Portfolio</h4>
            <ul>
              <li><a href="https://payflow-gateway.vercel.app" target="_blank">PayFlow Gateway →</a></li>
              <li><a href="https://insightboard-admin.vercel.app" target="_blank">InsightBoard Admin →</a></li>
            </ul>
          </div>
        </div>

        <div class="footer__bottom">
          <p>© 2026 StayEase. Built by Athitthiyan — Portfolio Demo Project.</p>
          <p>Powered by Angular 17 · FastAPI · Supabase</p>
        </div>
      </div>
    </footer>
  `,
  styles: [`
    .footer {
      position: relative;
      background: var(--color-bg-2);
      border-top: 1px solid var(--color-border);
      padding-top: var(--space-4xl);
      overflow: hidden;
    }

    .footer__glow {
      position: absolute;
      top: -60px;
      left: 50%;
      transform: translateX(-50%);
      width: 600px;
      height: 120px;
      background: radial-gradient(ellipse, rgba(201,168,76,0.08), transparent 70%);
      pointer-events: none;
    }

    .footer__grid {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr 1fr;
      gap: var(--space-3xl);
      padding-bottom: var(--space-3xl);
      border-bottom: 1px solid var(--color-border);
    }

    .footer__brand p {
      font-size: 14px;
      color: var(--color-text-muted);
      line-height: 1.8;
      margin-top: var(--space-md);
      max-width: 260px;
    }

    .footer__logo {
      font-family: var(--font-serif);
      font-size: 1.4rem;
      font-weight: 700;
      color: var(--color-text);
    }

    .footer__logo span { color: var(--color-primary); }

    .footer__socials {
      display: flex;
      gap: var(--space-md);
      margin-top: var(--space-lg);
    }

    .footer__socials a {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 38px;
      height: 38px;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      font-size: 16px;
      transition: all var(--transition-fast);
    }

    .footer__socials a:hover {
      background: var(--color-surface-hover);
      border-color: var(--color-primary);
      transform: translateY(-2px);
    }

    .footer__col h4 {
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: var(--color-primary);
      margin-bottom: var(--space-lg);
    }

    .footer__col ul {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: var(--space-sm);
    }

    .footer__col a {
      font-size: 14px;
      color: var(--color-text-muted);
      transition: color var(--transition-fast);
    }

    .footer__col a:hover { color: var(--color-text); }

    .footer__bottom {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-block: var(--space-xl);
      font-size: 13px;
      color: var(--color-text-subtle);
    }

    @media (max-width: 900px) {
      .footer__grid { grid-template-columns: 1fr 1fr; }
    }

    @media (max-width: 600px) {
      .footer__bottom {
        flex-direction: column;
        gap: var(--space-sm);
        text-align: center;
      }
    }

    @media (max-width: 480px) {
      .footer__grid {
        grid-template-columns: 1fr;
        gap: var(--space-xl);
      }
    }
  `],
})
export class FooterComponent {}
