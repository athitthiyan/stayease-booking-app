import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, NavbarComponent, FooterComponent],
  template: `
    <app-navbar />

    <main class="profile-page container">
      <div class="profile-header">
        <div class="avatar">
          @if (user()?.avatar_url) {
            <img [src]="user()!.avatar_url" [alt]="user()!.full_name" />
          } @else {
            <span class="avatar-initials">{{ initials() }}</span>
          }
        </div>
        <div class="profile-meta">
          <h1>{{ user()?.full_name }}</h1>
          <p class="email">{{ user()?.email }}</p>
          <p class="member-since">Member since {{ memberSince() }}</p>
        </div>
      </div>

      <div class="profile-grid">
        <!-- Edit Profile -->
        <section class="profile-card">
          <h2>Edit Profile</h2>

          @if (successMsg()) {
            <div class="alert alert--success">{{ successMsg() }}</div>
          }
          @if (errorMsg()) {
            <div class="alert alert--error">{{ errorMsg() }}</div>
          }

          <form [formGroup]="profileForm" (ngSubmit)="saveProfile()" novalidate>
            <div class="form-group">
              <label for="full_name">Full name</label>
              <input id="full_name" type="text" formControlName="full_name" />
            </div>

            <div class="form-group">
              <label for="phone">Phone number</label>
              <input id="phone" type="tel" formControlName="phone" placeholder="+1 555 000 0000" />
            </div>

            <button type="submit" class="btn btn--primary" [disabled]="saving()">
              @if (saving()) { Saving… } @else { Save changes }
            </button>
          </form>
        </section>

        <!-- Change Password -->
        <section class="profile-card">
          <h2>Change Password</h2>

          @if (pwSuccessMsg()) {
            <div class="alert alert--success">{{ pwSuccessMsg() }}</div>
          }
          @if (pwErrorMsg()) {
            <div class="alert alert--error">{{ pwErrorMsg() }}</div>
          }

          <form [formGroup]="passwordForm" (ngSubmit)="changePassword()" novalidate>
            <div class="form-group">
              <label for="current_password">Current password</label>
              <input
                id="current_password"
                type="password"
                formControlName="current_password"
                [class.is-invalid]="isPasswordFieldInvalid('current_password')"
              />
              @if (isPasswordFieldInvalid('current_password')) {
                <span class="field-error">Current password is required</span>
              }
            </div>

            <div class="form-group">
              <label for="new_password">New password</label>
              <input
                id="new_password"
                type="password"
                formControlName="new_password"
                [class.is-invalid]="isPasswordFieldInvalid('new_password')"
              />
              @if (isPasswordFieldInvalid('new_password')) {
                <span class="field-error">Min 10 chars, upper, lower &amp; digit</span>
              }
            </div>

            <button type="submit" class="btn btn--primary" [disabled]="changingPw()">
              @if (changingPw()) { Updating… } @else { Update password }
            </button>
          </form>
        </section>
      </div>

      <!-- Quick links -->
      <div class="quick-links">
        <a routerLink="/bookings" class="quick-link-card">
          <span class="ql-icon">📋</span>
          <span>My Bookings</span>
        </a>
        <a routerLink="/wishlist" class="quick-link-card">
          <span class="ql-icon">❤️</span>
          <span>Saved Stays</span>
        </a>
      </div>
    </main>

    <app-footer />
  `,
  styles: [`
    .profile-page {
      padding-top: 120px;
      padding-bottom: var(--space-4xl);
      min-height: 100vh;
    }

    .profile-header {
      display: flex;
      align-items: center;
      gap: var(--space-xl);
      margin-bottom: var(--space-2xl);
    }

    .avatar {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      overflow: hidden;
      background: var(--gradient-gold);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .avatar img { width: 100%; height: 100%; object-fit: cover; }
    .avatar-initials { font-size: 1.8rem; font-weight: 700; color: #000; }

    .profile-meta h1 { font-size: 1.5rem; font-weight: 700; margin: 0 0 4px; }
    .email { color: var(--color-text-muted); margin: 0 0 4px; font-size: 14px; }
    .member-since { color: var(--color-text-muted); font-size: 13px; margin: 0; }

    .profile-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: var(--space-xl);
      margin-bottom: var(--space-xl);
    }

    .profile-card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-xl);
      padding: var(--space-xl);
      display: flex;
      flex-direction: column;
      gap: var(--space-lg);
    }

    .profile-card h2 { font-size: 1.1rem; font-weight: 600; margin: 0; }

    .alert {
      padding: 12px 16px;
      border-radius: var(--radius-md);
      font-size: 14px;
    }

    .alert--success {
      background: rgba(34, 197, 94, 0.1);
      border: 1px solid rgba(34, 197, 94, 0.3);
      color: #4ade80;
    }

    .alert--error {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #f87171;
    }

    .form-group { display: flex; flex-direction: column; gap: 6px; }

    .form-group label { font-size: 14px; font-weight: 500; color: var(--color-text); }

    input {
      padding: 12px 16px;
      background: var(--color-bg);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      color: var(--color-text);
      font-size: 15px;
      transition: border-color var(--transition-fast);
      box-sizing: border-box;
    }

    input:focus { outline: none; border-color: var(--color-primary); }
    input.is-invalid { border-color: #ef4444; }

    .field-error { font-size: 12px; color: #f87171; }

    .quick-links {
      display: flex;
      gap: var(--space-lg);
      flex-wrap: wrap;
    }

    .quick-link-card {
      display: flex;
      align-items: center;
      gap: var(--space-md);
      padding: var(--space-lg) var(--space-xl);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-xl);
      color: var(--color-text);
      font-weight: 500;
      transition: border-color var(--transition-fast), background var(--transition-fast);
    }

    .quick-link-card:hover {
      border-color: var(--color-primary);
      background: rgba(var(--color-primary-rgb), 0.05);
    }

    .ql-icon { font-size: 1.4rem; }
  `],
})
export class ProfileComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);

  user = signal(this.authService.currentUser);
  saving = signal(false);
  successMsg = signal('');
  errorMsg = signal('');
  changingPw = signal(false);
  pwSuccessMsg = signal('');
  pwErrorMsg = signal('');

  profileForm = this.fb.nonNullable.group({
    full_name: ['', Validators.required],
    phone: [''],
  });

  passwordForm = this.fb.nonNullable.group({
    current_password: ['', Validators.required],
    new_password: ['', [Validators.required, Validators.minLength(10)]],
  });

  ngOnInit(): void {
    this.authService.getMe().subscribe(u => {
      this.user.set(u);
      this.profileForm.patchValue({ full_name: u.full_name, phone: u.phone ?? '' });
    });
  }

  initials(): string {
    const name = this.user()?.full_name ?? '';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  memberSince(): string {
    const d = this.user()?.created_at;
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  isPasswordFieldInvalid(field: 'current_password' | 'new_password'): boolean {
    const ctrl = this.passwordForm.get(field);
    return !!(ctrl?.invalid && ctrl.touched);
  }

  saveProfile(): void {
    this.profileForm.markAllAsTouched();
    if (this.profileForm.invalid || this.saving()) return;

    this.saving.set(true);
    this.successMsg.set('');
    this.errorMsg.set('');

    this.authService.updateProfile(this.profileForm.getRawValue()).subscribe({
      next: u => {
        this.user.set(u);
        this.successMsg.set('Profile updated successfully.');
        this.saving.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMsg.set(err.error?.detail ?? 'Update failed.');
        this.saving.set(false);
      },
    });
  }

  changePassword(): void {
    this.passwordForm.markAllAsTouched();
    if (this.passwordForm.invalid || this.changingPw()) return;

    this.changingPw.set(true);
    this.pwSuccessMsg.set('');
    this.pwErrorMsg.set('');

    this.authService.changePassword(this.passwordForm.getRawValue()).subscribe({
      next: () => {
        this.pwSuccessMsg.set('Password changed successfully.');
        this.passwordForm.reset();
        this.changingPw.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.pwErrorMsg.set(err.error?.detail ?? 'Password change failed.');
        this.changingPw.set(false);
      },
    });
  }
}
