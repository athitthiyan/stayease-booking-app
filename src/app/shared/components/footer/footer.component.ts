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
            <a routerLink="/" class="footer__logo">🏨 Stay<span>vora</span></a>
            <p>Stay Better. Travel Smarter. Premium hotel bookings with real-time inventory, safer payments, and clearer policies.</p>
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
            <h4>Policies</h4>
            <ul>
              <li><a routerLink="/privacy-policy">Privacy Policy</a></li>
              <li><a routerLink="/terms-and-conditions">Terms & Conditions</a></li>
              <li><a routerLink="/refund-policy">Refund Policy</a></li>
              <li><a routerLink="/cancellation-policy">Cancellation Policy</a></li>
            </ul>
          </div>

          <div class="footer__col">
            <h4>Support</h4>
            <ul>
              <li><a routerLink="/support">Help Center</a></li>
              <li><a href="mailto:support@stayvora.co.in">support&#64;stayvora.co.in</a></li>
              <li><a routerLink="/booking-history">My Bookings</a></li>
              <li><a routerLink="/wishlist">Saved Stays</a></li>
            </ul>
          </div>
        </div>

        <div class="footer__bottom">
          <p>© 2026 Stayvora. Stay Better. Travel Smarter.</p>
          <p>Support: support&#64;stayvora.co.in</p>
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
      background: radial-gradient(ellipse, rgba(201, 168, 76, 0.08), transparent 70%);
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
      max-width: 320px;
    }

    .footer__logo {
      font-family: var(--font-serif);
      font-size: 1.4rem;
      font-weight: 700;
      color: var(--color-text);
    }

    .footer__logo span { color: var(--color-primary); }

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
