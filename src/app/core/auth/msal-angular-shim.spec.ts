import { TestBed } from '@angular/core/testing';

import { MSAL_INSTANCE, MsalBroadcastService, MsalService } from './msal-angular-shim';

describe('msal-angular-shim', () => {
  it('wraps loginRedirect in an observable when the instance method exists', done => {
    const loginRedirect = jest.fn().mockResolvedValue(undefined);

    TestBed.configureTestingModule({
      providers: [
        MsalService,
        { provide: MSAL_INSTANCE, useValue: { loginRedirect } },
      ],
    });

    const service = TestBed.inject(MsalService);
    service.loginRedirect({ prompt: 'select_account' }).subscribe({
      next: value => {
        expect(value).toBeUndefined();
      },
      complete: () => {
        expect(loginRedirect).toHaveBeenCalledWith({ prompt: 'select_account' });
        done();
      },
    });
  });

  it('falls back to a resolved observable when loginRedirect is unavailable', done => {
    TestBed.configureTestingModule({
      providers: [
        MsalService,
        { provide: MSAL_INSTANCE, useValue: {} },
      ],
    });

    const service = TestBed.inject(MsalService);
    service.loginRedirect({ scopes: ['openid'] }).subscribe({
      next: value => {
        expect(value).toBeUndefined();
      },
      complete: done,
    });
  });

  it('can instantiate the broadcast service', () => {
    TestBed.configureTestingModule({
      providers: [MsalBroadcastService],
    });

    expect(TestBed.inject(MsalBroadcastService)).toBeInstanceOf(MsalBroadcastService);
  });
});
