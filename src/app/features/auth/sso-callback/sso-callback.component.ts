import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MsalService } from '@azure/msal-angular';
import { AuthService } from '../../../core/services/auth.service';

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
  private msalService = inject(MsalService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  error = signal('');

  ngOnInit(): void {
    this.msalService.handleRedirectObservable().subscribe({
      next: (result) => {
        if (result?.idToken) {
          this.handleToken(this.resolveProvider(), result.idToken);
          return;
        }
        // MSAL did not handle the redirect — fall back to fragment parsing
        this.handleFragmentFallback();
      },
      error: () => {
        this.handleFragmentFallback();
      },
    });
  }

  private handleFragmentFallback(): void {
    const fragment = this.route.snapshot.fragment || '';
    const params = new URLSearchParams(fragment);
    const idToken = params.get('id_token');

    if (!idToken) {
      this.error.set('Sign-in failed. No authentication token received.');
      return;
    }

    this.handleToken(this.resolveProvider(), idToken);
  }

  private handleToken(provider: 'google' | 'apple' | 'microsoft', idToken: string): void {
    this.authService.socialLoginWithToken(provider, idToken).subscribe({
      next: () => this.router.navigate(['/']),
      error: () => this.error.set('Sign-in failed. Please try again.'),
    });
  }

  goToLogin(): void {
    this.router.navigate(['/auth/login']);
  }

  private resolveProvider(): 'google' | 'apple' | 'microsoft' {
    const url = this.router.url;
    if (url.includes('microsoft')) return 'microsoft';
    if (url.includes('google')) return 'google';
    return 'microsoft';
  }
}
