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

export const msalConfig: Configuration = {
  auth: {
    clientId: environment.microsoftClientId,
    authority: `https://login.microsoftonline.com/${environment.microsoftTenantId}`,
    redirectUri: window.location.origin + '/auth/callback/microsoft',
    postLogoutRedirectUri: window.location.origin,
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
