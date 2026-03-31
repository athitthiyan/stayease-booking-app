import { Component, HostListener, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule],
  template: `
    <nav class="navbar" [class.navbar--scrolled]="scrolled()">
      <div class="container navbar__inner">
        <!-- Logo -->
        <a routerLink="/" class="navbar__logo">
          <span class="navbar__logo-icon">🏨</span>
          <span class="navbar__logo-text">Stay<span>Ease</span></span>
        </a>

        <!-- Desktop Nav -->
        <ul class="navbar__links">
          <li><a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact:true}">Home</a></li>
          <li><a routerLink="/search" routerLinkActive="active">Explore</a></li>
          <li><a href="#destinations">Destinations</a></li>
          <li><a href="#about">About</a></li>
        </ul>

        <!-- CTA -->
        <div class="navbar__actions">
          <a routerLink="/search" class="btn btn--ghost btn--sm">Browse Rooms</a>
        </div>

        <!-- Mobile toggle -->
        <button class="navbar__burger" (click)="toggleMenu()" [class.open]="menuOpen()">
          <span></span><span></span><span></span>
        </button>
      </div>

      <!-- Mobile Menu -->
      @if (menuOpen()) {
        <div class="navbar__mobile" (click)="menuOpen.set(false)">
          <a routerLink="/">Home</a>
          <a routerLink="/search">Explore Rooms</a>
          <a href="#destinations">Destinations</a>
        </div>
      }
    </nav>
  `,
  styles: [`
    .navbar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: var(--z-nav);
      padding: 20px 0;
      transition: all var(--transition-base);

      &--scrolled {
        padding: 12px 0;
        background: rgba(8, 13, 26, 0.92);
        backdrop-filter: blur(24px);
        -webkit-backdrop-filter: blur(24px);
        border-bottom: 1px solid var(--color-border);
        box-shadow: 0 4px 30px rgba(0,0,0,0.3);
      }

      &__inner {
        display: flex;
        align-items: center;
        gap: var(--space-xl);
      }

      &__logo {
        display: flex;
        align-items: center;
        gap: 10px;
        font-family: var(--font-serif);
        font-size: 1.5rem;
        font-weight: 700;
        flex-shrink: 0;

        &-icon { font-size: 1.6rem; }
        &-text {
          color: var(--color-text);
          span { color: var(--color-primary); }
        }
      }

      &__links {
        display: flex;
        align-items: center;
        gap: var(--space-xl);
        list-style: none;
        margin-left: auto;

        a {
          font-size: 14px;
          font-weight: 500;
          color: var(--color-text-muted);
          transition: color var(--transition-fast);
          position: relative;
          padding-bottom: 4px;

          &::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 0;
            width: 0;
            height: 2px;
            background: var(--gradient-gold);
            border-radius: var(--radius-full);
            transition: width var(--transition-base);
          }

          &:hover, &.active {
            color: var(--color-primary);
            &::after { width: 100%; }
          }
        }

        @media (max-width: 768px) { display: none; }
      }

      &__actions {
        @media (max-width: 768px) { display: none; }
      }

      &__burger {
        display: none;
        flex-direction: column;
        gap: 5px;
        background: none;
        padding: 4px;
        margin-left: auto;

        span {
          display: block;
          width: 24px;
          height: 2px;
          background: var(--color-text);
          border-radius: 2px;
          transition: all var(--transition-base);
        }

        &.open {
          span:first-child  { transform: rotate(45deg) translate(5px, 5px); }
          span:nth-child(2) { opacity: 0; }
          span:last-child   { transform: rotate(-45deg) translate(5px, -5px); }
        }

        @media (max-width: 768px) { display: flex; }
      }

      &__mobile {
        display: flex;
        flex-direction: column;
        gap: var(--space-md);
        padding: var(--space-lg) var(--space-xl);
        background: rgba(8, 13, 26, 0.97);
        backdrop-filter: blur(24px);
        border-top: 1px solid var(--color-border);
        animation: fadeInUp 0.2s ease;

        a {
          font-size: 16px;
          font-weight: 500;
          color: var(--color-text-muted);
          padding: var(--space-sm) 0;
          border-bottom: 1px solid var(--color-border);
          transition: color var(--transition-fast);
          &:hover { color: var(--color-primary); }
        }
      }
    }
  `],
})
export class NavbarComponent {
  scrolled = signal(false);
  menuOpen = signal(false);

  @HostListener('window:scroll')
  onScroll() {
    this.scrolled.set(window.scrollY > 40);
  }

  toggleMenu() {
    this.menuOpen.update(v => !v);
  }
}
