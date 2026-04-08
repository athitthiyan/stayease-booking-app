import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { getMsalRedirectResult, wasBackendLoginDone } from '../../../core/auth/msal.config';
import { AuthService } from '../../../core/services/auth.service';
import { BookingSearchStore } from '../../../core/services/booking-search.store';

@Component({
  selector: 'app-sso-callback',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="callback-page">
      <div class="callback-card">
        @if (error()) {
          <p class="callback-error">{{ error() }}</p>
          <button class="btn btn--primary" (click)="goToLogin()">Back to Sign In</button>
        } @else {
          <div class="spinner"></div>
          <p>Completing sign-in…</p>
        }
      </div>
    </div>
  `,
  styles: [`
    .callback-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--color-bg);
    }
    .callback-card {
      text-align: center;
      color: var(--color-text);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }
    .spinner {
      width: 36px;
      height: 36px;
      border: 3px solid var(--color-border);
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .callback-error {
      color: #f87171;
      font-size: 14px;
    }
  `],
})
export class SsoCallbackComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private searchStore = inject(BookingSearchStore);

  error = signal('');

  ngOnInit(): void {
    // Case 1: Backend login already completed in APP_INITIALIZER
    if (wasBackendLoginDone()) {
      this.redirectToIntendedRoute();
      return;
    }

    // Case 2: MSAL result available but backend login not done (retry)
    const msalResult = getMsalRedirectResult();
    if (msalResult?.idToken) {
      this.handleToken(this.resolveProvider(), msalResult.idToken);
      return;
    }

    // Case 3: Fall back to fragment parsing (legacy implicit flow)
    this.handleFragmentFallback();
  }

  private handleFragmentFallback(): void {
    const searchParams = new URLSearchParams(window.location.search);
    const fragment = this.route.snapshot.fragment || '';
    const params = new URLSearchParams(fragment);
    const error = searchParams.get('error') || params.get('error');
    const errorDescription = searchParams.get('error_description') || params.get('error_description');

    if (error) {
      this.error.set(this.humanizeOAuthError(error, errorDescription));
      return;
    }

    const idToken = params.get('id_token');

    if (!idToken) {
      if (searchParams.get('code')) {
        this.error.set('Sign-in could not be completed. Please try again.');
        return;
      }
      this.error.set('Sign-in failed. No authentication token received.');
      return;
    }

    this.handleToken(this.resolveProvider(), idToken);
  }

  private handleToken(provider: 'google' | 'apple' | 'microsoft', idToken: string): void {
    this.authService.socialLoginWithToken(provider, idToken).subscribe({
      next: () => this.redirectToIntendedRoute(),
      error: () => this.error.set('Sign-in failed. Please try again.'),
    });
  }

  /** Redirect to the route the user was trying to reach before login */
  private redirectToIntendedRoute(): void {
    const intended = this.searchStore.getAndClearRedirectIntent();
    if (intended) {
      this.router.navigateByUrl(intended);
    } else {
      this.router.navigate(['/']);
    }
  }

  goToLogin(): void {
    this.router.navigate(['/auth/login']);
  }

  private humanizeOAuthError(error: string, description: string | null): string {
    if (error === 'unsupported_response_type') {
      return 'Microsoft Sign-In is not configured correctly for this app. Please try again after updating the Microsoft app registration.';
    }

    if (!description) {
      return 'Sign-in failed. Please try again.';
    }

    return decodeURIComponent(description.replace(/\+/g, ' '));
  }

  private resolveProvider(): 'google' | 'apple' | 'microsoft' {
    const url = this.router.url;
    if (url.includes('microsoft')) return 'microsoft';
    if (url.includes('google')) return 'google';
    return 'microsoft';
  }
}
