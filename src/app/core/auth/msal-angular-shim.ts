import { Injectable, InjectionToken, inject } from '@angular/core';
import { from, Observable } from 'rxjs';
import { IPublicClientApplication, RedirectRequest } from './msal-browser-shim';

export const MSAL_INSTANCE = new InjectionToken<IPublicClientApplication>('MSAL_INSTANCE');

@Injectable()
export class MsalService {
  readonly instance = inject(MSAL_INSTANCE);

  loginRedirect(request: RedirectRequest): Observable<void> {
    const redirect = this.instance.loginRedirect?.(request) ?? Promise.resolve();
    return from(redirect);
  }
}

@Injectable()
export class MsalBroadcastService {}
