import { Component, HostListener, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../../core/services/auth.service';
import { WishlistService } from '../../../core/services/wishlist.service';

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

        <!-- CTA / Auth -->
        <div class="navbar__actions">
          <a routerLink="/search" class="btn btn--ghost btn--sm">Browse Rooms</a>

          @if (authService.isLoggedIn) {
            <a routerLink="/wishlist" class="navbar__icon-btn" title="Saved stays">❤️</a>
            <div class="navbar__user-menu">
              <button class="navbar__user-btn" (click)="toggleUserMenu()">
                <span class="user-avatar">{{ userInitials() }}</span>
                <span class="user-name">{{ firstName() }}</span>
                <span>▾</span>
              </button>
              @if (userMenuOpen()) {
                <div class="navbar__dropdown" (click)="userMenuOpen.set(false)">
                  <a routerLink="/profile" class="dropdown-item">👤 Profile</a>
                  <a routerLink="/bookings" class="dropdown-item">📋 My Bookings</a>
                  <a routerLink="/wishlist" class="dropdown-item">❤️ Saved Stays</a>
                  <div class="dropdown-divider"></div>
                  <button class="dropdown-item dropdown-item--danger" (click)="logout()">🚪 Sign out</button>
                </div>
              }
            </div>
          } @else {
            <a routerLink="/auth/login" class="btn btn--ghost btn--sm">Sign in</a>
            <a routerLink="/auth/signup" class="btn btn--primary btn--sm">Sign up</a>
          }
        </div>

        <!-- Mobile toggle -->
        <button class="navbar__burger" (click)="toggleMenu()" [class.open]="menuOpen()">
          <span></span><span></span><span></span>
        </button>
      </div>

      <!-- Mobile Menu -->
      @if (menuOpen()) {
        <button
          type="button"
          class="navbar__mobile-backdrop"
          (click)="closeMenu()"
          aria-label="Close mobile menu"
        ></button>
        <div class="navbar__mobile">
          <a routerLink="/" (click)="closeMenu()">Home</a>
          <a routerLink="/search" (click)="closeMenu()">Explore Rooms</a>
          <a routerLink="/" fragment="destinations" (click)="closeMenu()">Destinations</a>
          <a routerLink="/" fragment="about" (click)="closeMenu()">About</a>
          @if (authService.isLoggedIn) {
            <a routerLink="/profile" (click)="closeMenu()">Profile</a>
            <a routerLink="/bookings" (click)="closeMenu()">My Bookings</a>
            <a routerLink="/wishlist" (click)="closeMenu()">Saved Stays</a>
            <button class="mobile-signout" (click)="logout()">Sign out</button>
          } @else {
            <a routerLink="/auth/login" (click)="closeMenu()">Sign in</a>
            <a routerLink="/auth/signup" (click)="closeMenu()">Sign up</a>
          }
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
      position: fixed;
      top: 88px;
      left: 0;
      right: 0;
      max-height: calc(100dvh - 88px);
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: var(--space-md);
      padding: var(--space-lg) var(--space-xl);
      background: rgba(8, 13, 26, 0.97);
      backdrop-filter: blur(24px);
      border-top: 1px solid var(--color-border);
      animation: fadeInUp 0.2s ease;
      z-index: calc(var(--z-nav) + 2);
    }

    .navbar__mobile-backdrop {
      position: fixed;
      inset: 0;
      top: 88px;
      background: rgba(8, 13, 26, 0.45);
      border: 0;
      padding: 0;
      z-index: calc(var(--z-nav) + 1);
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

    .navbar__icon-btn {
      font-size: 1.2rem;
      padding: 4px 8px;
      border-radius: var(--radius-md);
      transition: background var(--transition-fast);
    }
    .navbar__icon-btn:hover { background: rgba(255,255,255,0.08); }

    .navbar__user-menu { position: relative; }

    .navbar__user-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      background: rgba(255,255,255,0.07);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-full);
      color: var(--color-text);
      font-size: 13px;
      cursor: pointer;
      transition: all var(--transition-fast);
    }
    .navbar__user-btn:hover { background: rgba(255,255,255,0.12); }

    .user-avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: var(--gradient-gold);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 700;
      color: #000;
    }

    .navbar__dropdown {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      min-width: 200px;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-xl);
      padding: var(--space-sm);
      box-shadow: 0 16px 40px rgba(0,0,0,0.4);
      z-index: 1000;
      animation: fadeInUp 0.15s ease;
    }

    .dropdown-item {
      display: block;
      width: 100%;
      text-align: left;
      padding: 10px 14px;
      font-size: 14px;
      color: var(--color-text-muted);
      border-radius: var(--radius-md);
      transition: all var(--transition-fast);
      background: none;
      cursor: pointer;
    }
    .dropdown-item:hover { background: rgba(255,255,255,0.06); color: var(--color-text); }
    .dropdown-item--danger:hover { background: rgba(239,68,68,0.1); color: #f87171; }

    .dropdown-divider {
      height: 1px;
      background: var(--color-border);
      margin: var(--space-sm) 0;
    }

    .mobile-signout {
      background: none;
      font-size: 16px;
      font-weight: 500;
      color: #f87171;
      padding: var(--space-sm) 0;
      border-bottom: 1px solid var(--color-border);
      cursor: pointer;
      text-align: left;
    }
  `],
})
export class NavbarComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  protected authService = inject(AuthService);
  private wishlistService = inject(WishlistService);

  scrolled = signal(false);
  menuOpen = signal(false);
  userMenuOpen = signal(false);
  currentUrl = signal(this.router.url);
  activeSection = signal<'home' | 'destinations' | 'about'>('home');

  ngOnInit() {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(event => {
        this.currentUrl.set(event.urlAfterRedirects);
        this.closeMenu();
        this.updateActiveSection();
      });

    this.updateActiveSection();
  }

  ngOnDestroy(): void {
    this.unlockBodyScroll();
  }

  @HostListener('window:scroll')
  onScroll() {
    this.scrolled.set(window.scrollY > 40);
    this.updateActiveSection();
  }

  toggleMenu(): void {
    const nextValue = !this.menuOpen();
    this.menuOpen.set(nextValue);

    if (nextValue) {
      this.lockBodyScroll();
    } else {
      this.unlockBodyScroll();
    }
  }

  toggleUserMenu(): void {
    this.userMenuOpen.update(v => !v);
  }

  logout(): void {
    this.closeMenu();
    this.authService.logout();
  }

  firstName(): string {
    return this.authService.currentUser?.full_name?.split(' ').at(0) ?? '';
  }

  userInitials(): string {
    const name = this.authService.currentUser?.full_name ?? '';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
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

  closeMenu(): void {
    if (!this.menuOpen()) {
      return;
    }

    this.menuOpen.set(false);
    this.unlockBodyScroll();
  }

  private lockBodyScroll(): void {
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
  }

  private unlockBodyScroll(): void {
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
  }
}
