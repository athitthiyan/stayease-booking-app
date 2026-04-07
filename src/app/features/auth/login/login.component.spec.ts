import { of, throwError } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';

import { LoginComponent } from './login.component';
import { AuthService } from '../../../core/services/auth.service';

describe('LoginComponent', () => {
  const authService = {
    login: jest.fn(),
    loginWithMicrosoft: jest.fn().mockResolvedValue(undefined),
    loginWithGoogle: jest.fn(),
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

  it('delegates Google sign-in to the auth service', () => {
    authService.loginWithGoogle.mockResolvedValue(undefined);
    const fixture = TestBed.createComponent(LoginComponent);
    const component = fixture.componentInstance;
    component.signInWithGoogle();
    expect(authService.loginWithGoogle).toHaveBeenCalled();
    expect(component.socialLoading()).toBe(true);
  });

  it('shows error message when Google sign-in fails', async () => {
    authService.loginWithGoogle.mockRejectedValue(new Error('Google Client ID is not configured.'));
    const fixture = TestBed.createComponent(LoginComponent);
    const component = fixture.componentInstance;
    component.signInWithGoogle();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(component.errorMsg()).toBe('Google Client ID is not configured.');
    expect(component.socialLoading()).toBe(false);
  });

  it('falls back to default message when Google error has no message', async () => {
    authService.loginWithGoogle.mockRejectedValue(new Error(''));
    const fixture = TestBed.createComponent(LoginComponent);
    const component = fixture.componentInstance;
    component.signInWithGoogle();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(component.errorMsg()).toBe('Google Sign-In failed. Please try again.');
    expect(component.socialLoading()).toBe(false);
  });

  it('delegates Microsoft sign-in to the auth service', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    const component = fixture.componentInstance;
    component.signInWithMicrosoft();
    expect(authService.loginWithMicrosoft).toHaveBeenCalled();
  });
});
