import { of, throwError } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';

import { LoginComponent } from './login.component';
import { AuthService } from '../../../core/services/auth.service';

describe('LoginComponent', () => {
  const authService = {
    login: jest.fn(),
    loginWithMicrosoft: jest.fn(),
  };

  function configure(returnUrl: string | null = null) {
    return TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: { get: () => returnUrl },
            },
          },
        },
      ],
    }).compileComponents();
  }

  beforeEach(async () => {
    authService.login.mockReset();
    await configure('/bookings');
  });

  it('toggles password visibility and validates fields', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    const component = fixture.componentInstance;

    expect(component.showPassword()).toBe(false);
    component.togglePassword();
    expect(component.showPassword()).toBe(true);

    component.form.controls.email.markAsTouched();
    component.form.controls.password.markAsTouched();
    expect(component.isFieldInvalid('email')).toBe(true);
    expect(component.isFieldInvalid('password')).toBe(true);

    component.form.setValue({ email: 'test@example.com', password: 'secret' });
    expect(component.isFieldInvalid('email')).toBe(false);
  });

  it('does not submit while invalid or loading', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    const component = fixture.componentInstance;

    component.onSubmit();
    expect(authService.login).not.toHaveBeenCalled();

    component.form.setValue({ email: 'test@example.com', password: 'secret' });
    component.loading.set(true);
    component.onSubmit();
    expect(authService.login).not.toHaveBeenCalled();
  });

  it('navigates to the return url on success', () => {
    authService.login.mockReturnValue(of({}));

    const fixture = TestBed.createComponent(LoginComponent);
    const component = fixture.componentInstance;
    const router = TestBed.inject(Router);
    const navigateSpy = jest.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    component.form.setValue({ email: 'test@example.com', password: 'secret' });

    component.onSubmit();

    expect(authService.login).toHaveBeenCalledWith(component.form.getRawValue());
    expect(navigateSpy).toHaveBeenCalledWith('/bookings');
  });

  it('uses root as the default return url', async () => {
    TestBed.resetTestingModule();
    authService.login.mockReturnValue(of({}));
    await configure(null);

    const fixture = TestBed.createComponent(LoginComponent);
    const component = fixture.componentInstance;
    const router = TestBed.inject(Router);
    const navigateSpy = jest.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    component.form.setValue({ email: 'test@example.com', password: 'secret' });

    component.onSubmit();

    expect(navigateSpy).toHaveBeenCalledWith('/');
  });

  it('surfaces backend and fallback login errors', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    const component = fixture.componentInstance;
    component.form.setValue({ email: 'test@example.com', password: 'secret' });

    authService.login.mockReturnValueOnce(throwError(() => ({ error: { detail: 'Invalid credentials' } })));
    component.onSubmit();
    expect(component.errorMsg()).toBe('Invalid credentials');
    expect(component.loading()).toBe(false);

    authService.login.mockReturnValueOnce(throwError(() => ({ error: {} })));
    component.onSubmit();
    expect(component.errorMsg()).toBe('Login failed. Please try again.');
  });

  it('shows a placeholder message for Apple sign-in', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    const component = fixture.componentInstance;
    component.signInWithApple();
    expect(component.errorMsg()).toBe('Apple Sign-In is coming soon on web. Use the mobile app.');
  });

  it('delegates Microsoft sign-in to the auth service', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    const component = fixture.componentInstance;
    component.signInWithMicrosoft();
    expect(authService.loginWithMicrosoft).toHaveBeenCalled();
  });
});
