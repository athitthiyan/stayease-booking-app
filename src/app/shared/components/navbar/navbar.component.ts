import { Component, HostListener, OnInit, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, CommonModule],
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
          <li><a routerLink="/" [class.active]="isHomeActive()">Home</a></li>
          <li><a routerLink="/search" [class.active]="isExploreActive()">Explore</a></li>
          <li><a routerLink="/" fragment="destinations" [class.active]="isSectionActive('destinations')">Destinations</a></li>
          <li><a routerLink="/" fragment="about" [class.active]="isSectionActive('about')">About</a></li>
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
          <a routerLink="/" fragment="destinations">Destinations</a>
          <a routerLink="/" fragment="about">About</a>
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
    }

    .navbar--scrolled {
      padding: 12px 0;
      background: rgba(8, 13, 26, 0.92);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border-bottom: 1px solid var(--color-border);
      box-shadow: 0 4px 30px rgba(0,0,0,0.3);
    }

    .navbar__inner {
      display: flex;
      align-items: center;
      gap: var(--space-xl);
    }

    .navbar__logo {
      display: flex;
      align-items: center;
      gap: 10px;
      font-family: var(--font-serif);
      font-size: 1.5rem;
      font-weight: 700;
      flex-shrink: 0;
    }

    .navbar__logo-icon { font-size: 1.6rem; }
    .navbar__logo-text { color: var(--color-text); }
    .navbar__logo-text span { color: var(--color-primary); }

    .navbar__links {
      display: flex;
      align-items: center;
      gap: var(--space-xl);
      list-style: none;
      margin-left: auto;
    }

    .navbar__links a {
      font-size: 14px;
      font-weight: 500;
      color: var(--color-text-muted);
      transition: color var(--transition-fast);
      position: relative;
      padding-bottom: 4px;
    }

    .navbar__links a::after {
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

    .navbar__links a:hover,
    .navbar__links a.active {
      color: var(--color-primary);
    }

    .navbar__links a:hover::after,
    .navbar__links a.active::after {
      width: 100%;
    }

    .navbar__burger {
      display: none;
      flex-direction: column;
      gap: 5px;
      background: none;
      padding: 4px;
      margin-left: auto;
    }

    .navbar__burger span {
      display: block;
      width: 24px;
      height: 2px;
      background: var(--color-text);
      border-radius: 2px;
      transition: all var(--transition-base);
    }

    .navbar__burger.open span:first-child  { transform: rotate(45deg) translate(5px, 5px); }
    .navbar__burger.open span:nth-child(2) { opacity: 0; }
    .navbar__burger.open span:last-child   { transform: rotate(-45deg) translate(5px, -5px); }

    .navbar__mobile {
      display: flex;
      flex-direction: column;
      gap: var(--space-md);
      padding: var(--space-lg) var(--space-xl);
      background: rgba(8, 13, 26, 0.97);
      backdrop-filter: blur(24px);
      border-top: 1px solid var(--color-border);
      animation: fadeInUp 0.2s ease;
    }

    .navbar__mobile a {
      font-size: 16px;
      font-weight: 500;
      color: var(--color-text-muted);
      padding: var(--space-sm) 0;
      border-bottom: 1px solid var(--color-border);
      transition: color var(--transition-fast);
    }

    .navbar__mobile a:hover { color: var(--color-primary); }

    @media (max-width: 768px) {
      .navbar__links,
      .navbar__actions {
        display: none;
      }

      .navbar__burger {
        display: flex;
      }
    }
  `],
})
export class NavbarComponent implements OnInit {
  private router = inject(Router);

  scrolled = signal(false);
  menuOpen = signal(false);
  currentUrl = signal(this.router.url);
  activeSection = signal<'home' | 'destinations' | 'about'>('home');

  ngOnInit() {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(event => {
        this.currentUrl.set(event.urlAfterRedirects);
        this.updateActiveSection();
      });

    this.updateActiveSection();
  }

  @HostListener('window:scroll')
  onScroll() {
    this.scrolled.set(window.scrollY > 40);
    this.updateActiveSection();
  }

  toggleMenu() {
    this.menuOpen.update(v => !v);
  }

  isHomeActive(): boolean {
    return this.isLandingPage() && this.activeSection() === 'home';
  }

  isExploreActive(): boolean {
    return this.currentUrl().startsWith('/search');
  }

  isSectionActive(section: 'destinations' | 'about'): boolean {
    return this.isLandingPage() && this.activeSection() === section;
  }

  private isLandingPage(): boolean {
    const [path] = this.currentUrl().split('#');
    return path === '/';
  }

  private updateActiveSection() {
    if (!this.isLandingPage()) {
      return;
    }

    const destinations = document.getElementById('destinations');
    const about = document.getElementById('about');
    const scrollY = window.scrollY;
    const offset = 160;

    if (about && scrollY >= about.offsetTop - offset) {
      this.activeSection.set('about');
      return;
    }

    if (destinations && scrollY >= destinations.offsetTop - offset) {
      this.activeSection.set('destinations');
      return;
    }

    this.activeSection.set('home');
  }
}
