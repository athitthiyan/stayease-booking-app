import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { ResetPasswordComponent } from './reset-password.component';
import { AuthService } from '../../../core/services/auth.service';

describe('ResetPasswordComponent', () => {
  const authService = {
    resetPassword: jest.fn(),
  };

  beforeEach(async () => {
    authService.resetPassword.mockReset();

    await TestBed.configureTestingModule({
      imports: [ResetPasswordComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: { get: () => 'reset-session-token' } },
          },
        },
      ],
    }).compileComponents();
  });

  it('loads reset token and toggles password visibility', () => {
    const fixture = TestBed.createComponent(ResetPasswordComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    expect(component.resetToken()).toBe('reset-session-token');
    component.togglePassword();
    expect(component.showPassword()).toBe(true);
  });

  it('submits reset password with reset session token', () => {
    authService.resetPassword.mockReturnValue(of({ message: 'ok' }));
    const fixture = TestBed.createComponent(ResetPasswordComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    component.form.setValue({ new_password: 'StrongPass1', confirmPassword: 'StrongPass1' });

    component.onSubmit();

    expect(authService.resetPassword).toHaveBeenCalledWith({
      reset_token: 'reset-session-token',
      new_password: 'StrongPass1',
    });
    expect(component.success()).toBe(true);
  });

  it('surfaces reset password errors and blocks invalid submissions', () => {
    const fixture = TestBed.createComponent(ResetPasswordComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.onSubmit();
    expect(authService.resetPassword).not.toHaveBeenCalled();

    component.form.setValue({ new_password: 'StrongPass1', confirmPassword: 'StrongPass1' });
    authService.resetPassword.mockReturnValueOnce(throwError(() => ({ error: { detail: { message: 'Expired session' } } })));
    component.onSubmit();
    expect(component.errorMsg()).toBe('Expired session');
  });

  it('isFieldInvalid returns true when field is invalid and touched', () => {
    const fixture = TestBed.createComponent(ResetPasswordComponent);
    const component = fixture.componentInstance;
    const ctrl = component.form.get('new_password');

    expect(component.isFieldInvalid('new_password')).toBe(false);

    ctrl?.markAsTouched();
    expect(component.isFieldInvalid('new_password')).toBe(true);

    ctrl?.setValue('StrongPass1');
    expect(component.isFieldInvalid('new_password')).toBe(false);
  });

  it('isFieldInvalid returns false when field is untouched despite being invalid', () => {
    const fixture = TestBed.createComponent(ResetPasswordComponent);
    const component = fixture.componentInstance;
    const ctrl = component.form.get('new_password');

    expect(ctrl?.invalid).toBe(true);
    expect(component.isFieldInvalid('new_password')).toBe(false);
  });

  it('isConfirmInvalid returns true when touched and password mismatch exists', () => {
    const fixture = TestBed.createComponent(ResetPasswordComponent);
    const component = fixture.componentInstance;
    const confirmCtrl = component.form.get('confirmPassword');

    component.form.setValue({ new_password: 'StrongPass1', confirmPassword: 'DifferentPass1' });
    confirmCtrl?.markAsTouched();

    expect(component.isConfirmInvalid()).toBe(true);
  });

  it('isConfirmInvalid returns false when untouched', () => {
    const fixture = TestBed.createComponent(ResetPasswordComponent);
    const component = fixture.componentInstance;

    component.form.setValue({ new_password: 'StrongPass1', confirmPassword: 'DifferentPass1' });

    expect(component.isConfirmInvalid()).toBe(false);
  });

  it('isConfirmInvalid returns false when passwords match and touched', () => {
    const fixture = TestBed.createComponent(ResetPasswordComponent);
    const component = fixture.componentInstance;
    const confirmCtrl = component.form.get('confirmPassword');

    component.form.setValue({ new_password: 'StrongPass1', confirmPassword: 'StrongPass1' });
    confirmCtrl?.markAsTouched();

    expect(component.isConfirmInvalid()).toBe(false);
  });

  it('onSubmit is blocked when resetToken is empty', () => {
    const fixture = TestBed.createComponent(ResetPasswordComponent);
    const component = fixture.componentInstance;
    component.form.setValue({ new_password: 'StrongPass1', confirmPassword: 'StrongPass1' });
    component.resetToken.set('');

    component.onSubmit();

    expect(authService.resetPassword).not.toHaveBeenCalled();
  });

  it('onSubmit handles error response with object detail.message format', () => {
    authService.resetPassword.mockReturnValue(
      throwError(() => ({
        error: { detail: { message: 'Token validation failed' } }
      }))
    );

    const fixture = TestBed.createComponent(ResetPasswordComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    component.form.setValue({ new_password: 'StrongPass1', confirmPassword: 'StrongPass1' });

    component.onSubmit();

    expect(component.errorMsg()).toBe('Token validation failed');
  });

  it('isFieldInvalid and isConfirmInvalid work together to display validation errors', () => {
    const fixture = TestBed.createComponent(ResetPasswordComponent);
    const component = fixture.componentInstance;

    const newPwCtrl = component.form.get('new_password');
    const confirmCtrl = component.form.get('confirmPassword');

    newPwCtrl?.markAsTouched();
    confirmCtrl?.markAsTouched();

    expect(component.isFieldInvalid('new_password')).toBe(true);
    expect(component.isConfirmInvalid()).toBe(true);

    component.form.setValue({ new_password: 'StrongPass1', confirmPassword: 'StrongPass1' });

    expect(component.isFieldInvalid('new_password')).toBe(false);
    expect(component.isConfirmInvalid()).toBe(false);
  });
});
