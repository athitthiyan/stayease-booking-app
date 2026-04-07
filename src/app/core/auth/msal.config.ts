import { APP_INITIALIZER, Provider } from '@angular/core';
import {
  IPublicClientApplication,
  PublicClientApplication,
  BrowserCacheLocation,
  Configuration,
  RedirectRequest,
  LogLevel,
  AuthenticationResult,
} from '@azure/msal-browser';
import { MSAL_INSTANCE, MsalService, MsalBroadcastService } from '@azure/msal-angular';
import { environment } from '../../../environments/environment';

/**
 * Stores the redirect result so the callback component knows
 * whether the login completed during APP_INITIALIZER.
 */
let _redirectResult: AuthenticationResult | null = null;
let _backendLoginDone = false;

export function getMsalRedirectResult(): AuthenticationResult | null {
  return _redirectResult;
}
export function wasBackendLoginDone(): boolean {
  return _backendLoginDone;
}

export const msalConfig: Configuration = {
  auth: {
    clientId: environment.microsoftClientId,
    authority: 'https://login.microsoftonline.com/common',
    redirectUri: window.location.origin + '/auth/callback/microsoft',
    postLogoutRedirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: BrowserCacheLocation.LocalStorage,
  },
  system: {
    loggerOptions: {
      logLevel: environment.production ? LogLevel.Error : LogLevel.Warning,
    },
  },
};

export const loginRequest: RedirectRequest = {
  scopes: ['openid', 'profile', 'email'],
  prompt: 'select_account',
};

function msalInstanceFactory(): IPublicClientApplication {
  return new PublicClientApplication(msalConfig);
}

/**
 * Complete the Stayvora backend login inline — before Angular routing starts.
 * This prevents MSAL from navigating away before the session is stored.
 */
async function completeBackendLogin(idToken: string): Promise<boolean> {
  try {
    const resp = await fetch(`${environment.apiUrl}/auth/social-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'microsoft', id_token: idToken }),
    });
    if (!resp.ok) return false;
    const data = await resp.json();
    if (data.access_token) {
      localStorage.setItem('se_access_token', data.access_token);
      localStorage.setItem('se_refresh_token', data.refresh_token);
      localStorage.setItem('se_user', JSON.stringify(data.user));
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function msalInitializerFactory(msalInstance: IPublicClientApplication): () => Promise<void> {
  return async () => {
    await msalInstance.initialize();
    try {
      _redirectResult = await msalInstance.handleRedirectPromise();
      if (_redirectResult?.idToken) {
        _backendLoginDone = await completeBackendLogin(_redirectResult.idToken);
      }
    } catch {
      _redirectResult = null;
    }
  };
}

export function msalProviders(): Provider[] {
  return [
    { provide: MSAL_INSTANCE, useFactory: msalInstanceFactory },
    {
      provide: APP_INITIALIZER,
      useFactory: msalInitializerFactory,
      deps: [MSAL_INSTANCE],
      multi: true,
    },
    MsalService,
    MsalBroadcastService,
  ];
}
