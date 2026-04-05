import { of, throwError } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';

import { ResetPasswordComponent } from './reset-password.component';
import { AuthService } from '../../../core/services/auth.service';

describe('ResetPasswordComponent', () => {
  const authService = {
    resetPassword: jest.fn(),
  };

  function configure(token: string | null) {
    return TestBed.configureTestingModule({
      imports: [ResetPasswordComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: { get: () => token },
            },
          },
        },
      ],
    }).compileComponents();
  }

  beforeEach(async () => {
    authService.resetPassword.mockReset();
    await configure('token-123');
  });

  function setValidForm(component: ResetPasswordComponent) {
    component.form.setValue({
      new_password: 'StrongPass1',
      confirmPassword: 'StrongPass1',
    });
  }

  it('loads the token and validates password fields', () => {
    const fixture = TestBed.createComponent(ResetPasswordComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    expect(component.token()).toBe('token-123');
    component.togglePassword();
    expect(component.showPassword()).toBe(true);

    component.form.controls.new_password.markAsTouched();
    component.form.controls.confirmPassword.markAsTouched();
    expect(component.isFieldInvalid('new_password')).toBe(true);

    component.form.patchValue({ new_password: 'StrongPass1', confirmPassword: 'Mismatch1' });
    component.form.controls.confirmPassword.markAsTouched();
    expect(component.isConfirmInvalid()).toBe(true);
  });

  it('does not submit while invalid, loading, or without a token', async () => {
    const fixture = TestBed.createComponent(ResetPasswordComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.onSubmit();
    expect(authService.resetPassword).not.toHaveBeenCalled();

    setValidForm(component);
    component.loading.set(true);
    component.onSubmit();
    expect(authService.resetPassword).not.toHaveBeenCalled();

    TestBed.resetTestingModule();
    await configure(null);
    const secondFixture = TestBed.createComponent(ResetPasswordComponent);
    const second = secondFixture.componentInstance;
    second.ngOnInit();
    setValidForm(second);
    second.onSubmit();
    expect(authService.resetPassword).not.toHaveBeenCalled();
  });

  it('submits successfully', () => {
    authService.resetPassword.mockReturnValue(of({}));

    const fixture = TestBed.createComponent(ResetPasswordComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    setValidForm(component);

    component.onSubmit();

    expect(authService.resetPassword).toHaveBeenCalledWith({
      token: 'token-123',
      new_password: 'StrongPass1',
    });
    expect(component.success()).toBe(true);
  });

  it('surfaces backend and fallback reset errors', () => {
    const fixture = TestBed.createComponent(ResetPasswordComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    setValidForm(component);

    authService.resetPassword.mockReturnValueOnce(throwError(() => ({ error: { detail: 'Expired token' } })));
    component.onSubmit();
    expect(component.errorMsg()).toBe('Expired token');
    expect(component.loading()).toBe(false);

    authService.resetPassword.mockReturnValueOnce(throwError(() => ({ error: {} })));
    component.onSubmit();
    expect(component.errorMsg()).toBe('Reset failed. The link may have expired.');
  });

  it('treats null password values as invalid strength input', () => {
    const fixture = TestBed.createComponent(ResetPasswordComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.form.controls.new_password.setValue(null as unknown as string);
    component.form.controls.new_password.markAsTouched();

    expect(component.isFieldInvalid('new_password')).toBe(true);
  });
});
