import { APP_INITIALIZER, Provider } from '@angular/core';
import {
  IPublicClientApplication,
  PublicClientApplication,
  BrowserCacheLocation,
  Configuration,
  PopupRequest,
} from '@azure/msal-browser';
import { MSAL_INSTANCE, MsalService, MsalBroadcastService } from '@azure/msal-angular';
import { environment } from '../../../environments/environment';

// Normalize origin to strip "www." so redirect URI always matches Azure registration
const normalizedOrigin = window.location.origin.replace('://www.', '://');

export const msalConfig: Configuration = {
  auth: {
    clientId: environment.microsoftClientId,
    authority: 'https://login.microsoftonline.com/common',
    redirectUri: normalizedOrigin + '/auth/callback/microsoft',
    postLogoutRedirectUri: normalizedOrigin,
  },
  cache: {
    cacheLocation: BrowserCacheLocation.LocalStorage,
  },
  system: {
    loggerOptions: {
      logLevel: 0, // Error only
    },
  },
};

export const loginRequest: PopupRequest = {
  scopes: ['openid', 'profile', 'email'],
  prompt: 'select_account',
};

function msalInstanceFactory(): IPublicClientApplication {
  return new PublicClientApplication(msalConfig);
}

function msalInitializerFactory(msalInstance: IPublicClientApplication): () => Promise<void> {
  return () => msalInstance.initialize();
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
