import { of, throwError } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { SignupComponent } from './signup.component';
import { AuthService } from '../../../core/services/auth.service';

describe('SignupComponent', () => {
  const authService = {
    signup: jest.fn(),
    loginWithMicrosoft: jest.fn().mockResolvedValue(undefined),
    loginWithGoogle: jest.fn(),
  };

  beforeEach(async () => {
    authService.signup.mockReset();

    await TestBed.configureTestingModule({
      imports: [SignupComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
      ],
    }).compileComponents();
  });

  function setValidForm(component: SignupComponent) {
    component.form.setValue({
      full_name: 'Alex Doe',
      email: 'alex@example.com',
      password: 'StrongPass1',
      confirmPassword: 'StrongPass1',
    });
  }

  it('toggles password visibility and validates form fields', () => {
    const fixture = TestBed.createComponent(SignupComponent);
    const component = fixture.componentInstance;

    component.togglePassword();
    expect(component.showPassword()).toBe(true);

    component.form.controls.full_name.markAsTouched();
    component.form.controls.email.markAsTouched();
    component.form.controls.password.markAsTouched();
    component.form.controls.confirmPassword.markAsTouched();
    expect(component.isFieldInvalid('full_name')).toBe(true);
    expect(component.isFieldInvalid('email')).toBe(true);
    expect(component.isFieldInvalid('password')).toBe(true);
    expect(component.isConfirmInvalid()).toBe(true);

    component.form.patchValue({ password: 'StrongPass1', confirmPassword: 'Mismatch1' });
    component.form.controls.confirmPassword.markAsTouched();
    expect(component.isConfirmInvalid()).toBe(true);
  });

  it('does not submit while invalid or loading', () => {
    const fixture = TestBed.createComponent(SignupComponent);
    const component = fixture.componentInstance;

    component.onSubmit();
    expect(authService.signup).not.toHaveBeenCalled();

    setValidForm(component);
    component.loading.set(true);
    component.onSubmit();
    expect(authService.signup).not.toHaveBeenCalled();
  });

  it('submits successfully and navigates home', () => {
    authService.signup.mockReturnValue(of({}));

    const fixture = TestBed.createComponent(SignupComponent);
    const component = fixture.componentInstance;
    const router = TestBed.inject(Router);
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);
    setValidForm(component);

    component.onSubmit();

    expect(authService.signup).toHaveBeenCalledWith({
      full_name: 'Alex Doe',
      email: 'alex@example.com',
      password: 'StrongPass1',
    });
    expect(navigateSpy).toHaveBeenCalledWith(['/']);
  });

  it('surfaces backend and fallback signup errors', () => {
    const fixture = TestBed.createComponent(SignupComponent);
    const component = fixture.componentInstance;
    setValidForm(component);

    authService.signup.mockReturnValueOnce(throwError(() => ({ error: { detail: 'Email exists' } })));
    component.onSubmit();
    expect(component.errorMsg()).toBe('Email exists');
    expect(component.loading()).toBe(false);

    authService.signup.mockReturnValueOnce(throwError(() => ({ error: {} })));
    component.onSubmit();
    expect(component.errorMsg()).toBe('Signup failed. Please try again.');
  });

  it('treats null password values as invalid strength input', () => {
    const fixture = TestBed.createComponent(SignupComponent);
    const component = fixture.componentInstance;

    component.form.controls.password.setValue(null as unknown as string);
    component.form.controls.password.markAsTouched();

    expect(component.isFieldInvalid('password')).toBe(true);
  });

  it('delegates Google sign-in to the auth service', () => {
    authService.loginWithGoogle.mockResolvedValue(undefined);
    const fixture = TestBed.createComponent(SignupComponent);
    const component = fixture.componentInstance;
    component.signInWithGoogle();
    expect(authService.loginWithGoogle).toHaveBeenCalled();
    expect(component.socialLoading()).toBe(true);
  });

  it('shows error message when Google sign-in fails', async () => {
    authService.loginWithGoogle.mockRejectedValue(new Error('Google Client ID is not configured.'));
    const fixture = TestBed.createComponent(SignupComponent);
    const component = fixture.componentInstance;
    component.signInWithGoogle();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(component.errorMsg()).toBe('Google Client ID is not configured.');
    expect(component.socialLoading()).toBe(false);
  });

  it('falls back to default message when Google error has no message', async () => {
    authService.loginWithGoogle.mockRejectedValue(new Error(''));
    const fixture = TestBed.createComponent(SignupComponent);
    const component = fixture.componentInstance;
    component.signInWithGoogle();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(component.errorMsg()).toBe('Google Sign-In failed. Please try again.');
    expect(component.socialLoading()).toBe(false);
  });

  it('delegates Microsoft sign-in to the auth service', () => {
    const fixture = TestBed.createComponent(SignupComponent);
    const component = fixture.componentInstance;
    component.signInWithMicrosoft();
    expect(authService.loginWithMicrosoft).toHaveBeenCalled();
  });
});
