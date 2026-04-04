import { Subject } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, Router, provideRouter } from '@angular/router';

import { NavbarComponent } from './navbar.component';
import { AuthService } from '../../../core/services/auth.service';
import { WishlistService } from '../../../core/services/wishlist.service';

describe('NavbarComponent', () => {
  const events$ = new Subject<unknown>();
  const authService = {
    isLoggedIn: false,
    currentUser: null as null | { full_name: string },
    logout: jest.fn(),
  };
  const wishlistService = {};

  beforeEach(async () => {
    authService.isLoggedIn = false;
    authService.currentUser = null;
    authService.logout.mockReset();

    await TestBed.configureTestingModule({
      imports: [NavbarComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
        { provide: WishlistService, useValue: wishlistService },
      ],
    }).compileComponents();

    const router = TestBed.inject(Router);
    Object.defineProperty(router, 'events', { value: events$.asObservable() });
    Object.defineProperty(router, 'url', { value: '/', writable: true });
  });

  it('tracks router navigation and active sections', () => {
    const fixture = TestBed.createComponent(NavbarComponent);
    const component = fixture.componentInstance;
    const router = TestBed.inject(Router) as Router & { url: string };

    document.body.innerHTML = '<section id="destinations"></section><section id="about"></section>';
    Object.defineProperty(document.getElementById('destinations')!, 'offsetTop', { value: 300 });
    Object.defineProperty(document.getElementById('about')!, 'offsetTop', { value: 700 });

    component.ngOnInit();
    expect(component.isHomeActive()).toBe(true);

    Object.defineProperty(window, 'scrollY', { value: 400, configurable: true });
    component.onScroll();
    expect(component.isSectionActive('destinations')).toBe(true);

    Object.defineProperty(window, 'scrollY', { value: 800, configurable: true });
    component.onScroll();
    expect(component.isSectionActive('about')).toBe(true);

    router.url = '/search?city=Bali';
    events$.next(new NavigationEnd(1, '/search', '/search'));
    expect(component.isExploreActive()).toBe(true);
    expect(component.isHomeActive()).toBe(false);
  });

  it('toggles menu state and user menu state', () => {
    const fixture = TestBed.createComponent(NavbarComponent);
    const component = fixture.componentInstance;

    component.toggleMenu();
    component.toggleUserMenu();

    expect(component.menuOpen()).toBe(true);
    expect(component.userMenuOpen()).toBe(true);
  });

  it('locks body scroll while the mobile menu is open and restores it when closed', () => {
    const fixture = TestBed.createComponent(NavbarComponent);
    const component = fixture.componentInstance;

    component.toggleMenu();
    expect(component.menuOpen()).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.body.style.touchAction).toBe('none');

    component.toggleMenu();
    expect(component.menuOpen()).toBe(false);
    expect(document.body.style.overflow).toBe('');
    expect(document.body.style.touchAction).toBe('');
  });

  it('cleans up body scroll lock on destroy', () => {
    const fixture = TestBed.createComponent(NavbarComponent);
    const component = fixture.componentInstance;

    component.toggleMenu();
    component.ngOnDestroy();

    expect(document.body.style.overflow).toBe('');
    expect(document.body.style.touchAction).toBe('');
  });

  it('derives names and logs out', () => {
    authService.isLoggedIn = true;
    authService.currentUser = { full_name: 'Alex Doe' };

    const fixture = TestBed.createComponent(NavbarComponent);
    const component = fixture.componentInstance;

    expect(component.firstName()).toBe('Alex');
    expect(component.userInitials()).toBe('AD');

    component.logout();
    expect(authService.logout).toHaveBeenCalled();
  });

  it('returns empty name helpers without a user', () => {
    const fixture = TestBed.createComponent(NavbarComponent);
    const component = fixture.componentInstance;

    expect(component.firstName()).toBe('');
    expect(component.userInitials()).toBe('');
  });
});
