import {
  BrowserCacheLocation,
  PublicClientApplication,
  type Configuration,
} from './msal-browser-shim';

describe('msal-browser-shim', () => {
  const baseConfig: Configuration = {
    auth: {
      clientId: 'client-id',
      authority: 'https://login.microsoftonline.com/test-tenant',
      redirectUri: 'http://localhost:4200/auth/callback/microsoft',
      postLogoutRedirectUri: 'http://localhost:4200',
    },
    cache: {
      cacheLocation: BrowserCacheLocation.LocalStorage,
    },
  };

  const originalLocation = window.location;
  const originalCrypto = globalThis.crypto;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/auth/callback/microsoft');

    const subtle = {
      digest: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4]).buffer),
    };

    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {
        randomUUID: jest.fn().mockReturnValue('opaque-value'),
        subtle,
      },
    });
  });

  afterEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/');
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: originalCrypto,
    });
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: originalFetch,
    });
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('uses authorization code flow with PKCE for loginRedirect', async () => {
    const app = new PublicClientApplication(baseConfig);
    const assign = jest.fn();

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        assign,
      },
    });

    await app.loginRedirect({ scopes: ['openid', 'profile', 'email'], prompt: 'select_account' });

    expect(assign).toHaveBeenCalledTimes(1);
    const authUrl = new URL(assign.mock.calls[0][0] as string);
    expect(authUrl.searchParams.get('response_type')).toBe('code');
    expect(authUrl.searchParams.get('response_mode')).toBe('query');
    expect(authUrl.searchParams.get('code_challenge_method')).toBe('S256');
    expect(authUrl.searchParams.get('state')).toBe('opaque-value');
    expect(authUrl.searchParams.get('prompt')).toBe('select_account');
    expect(localStorage.getItem('msal_redirect_state')).toBe('opaque-value');
    expect(localStorage.getItem('msal_pkce_verifier')).toContain('opaque-value');
  });

  it('exchanges an authorization code for an id token during handleRedirectPromise', async () => {
    window.history.replaceState({}, '', '/auth/callback/microsoft?code=abc123&state=opaque-value');
    localStorage.setItem('msal_redirect_state', 'opaque-value');
    localStorage.setItem('msal_pkce_verifier', 'opaque-valueopaque-value');

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id_token: 'jwt-token' }),
    } as Response);
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: fetchMock,
    });

    const app = new PublicClientApplication(baseConfig);
    const result = await app.handleRedirectPromise();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://login.microsoftonline.com/test-tenant/oauth2/v2.0/token',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(result).toEqual({ idToken: 'jwt-token', state: 'opaque-value' });
    expect(localStorage.getItem('msal_redirect_state')).toBeNull();
    expect(localStorage.getItem('msal_pkce_verifier')).toBeNull();
    expect(window.location.search).toBe('');
  });

  it('returns null when the redirect state does not match', async () => {
    window.history.replaceState({}, '', '/auth/callback/microsoft#id_token=jwt-token&state=wrong-state');
    localStorage.setItem('msal_redirect_state', 'expected-state');

    const app = new PublicClientApplication(baseConfig);
    const result = await app.handleRedirectPromise();

    expect(result).toBeNull();
    expect(localStorage.getItem('msal_redirect_state')).toBeNull();
  });
});
