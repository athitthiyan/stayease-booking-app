import { of, throwError } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ForgotPasswordComponent } from './forgot-password.component';
import { AuthService } from '../../../core/services/auth.service';

describe('ForgotPasswordComponent', () => {
  const authService = {
    forgotPassword: jest.fn(),
  };

  beforeEach(async () => {
    authService.forgotPassword.mockReset();

    await TestBed.configureTestingModule({
      imports: [ForgotPasswordComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
      ],
    }).compileComponents();
  });

  it('validates the email field', () => {
    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    const component = fixture.componentInstance;

    component.form.controls.email.markAsTouched();
    expect(component.isEmailInvalid()).toBe(true);

    component.form.controls.email.setValue('test@example.com');
    expect(component.isEmailInvalid()).toBe(false);
  });

  it('does not submit while invalid or loading', () => {
    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    const component = fixture.componentInstance;

    component.onSubmit();
    expect(authService.forgotPassword).not.toHaveBeenCalled();

    component.form.setValue({ email: 'test@example.com' });
    component.loading.set(true);
    component.onSubmit();
    expect(authService.forgotPassword).not.toHaveBeenCalled();
  });

  it('submits successfully', () => {
    authService.forgotPassword.mockReturnValue(of({ message: 'sent' }));

    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    const component = fixture.componentInstance;
    component.form.setValue({ email: 'test@example.com' });

    component.onSubmit();

    expect(authService.forgotPassword).toHaveBeenCalledWith({ email: 'test@example.com' });
    expect(component.submitted()).toBe(true);
    expect(component.errorMsg()).toBe('');
  });

  it('surfaces backend and fallback errors', () => {
    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    const component = fixture.componentInstance;
    component.form.setValue({ email: 'test@example.com' });

    authService.forgotPassword.mockReturnValueOnce(
      throwError(() => ({ error: { detail: 'No account found' } }))
    );
    component.onSubmit();
    expect(component.errorMsg()).toBe('No account found');
    expect(component.loading()).toBe(false);

    authService.forgotPassword.mockReturnValueOnce(
      throwError(() => ({ error: {} }))
    );
    component.onSubmit();
    expect(component.errorMsg()).toBe('Request failed. Please try again.');
  });
});
