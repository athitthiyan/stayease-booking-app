import {
  BrowserAuthError,
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

  it('uses default scopes and falls back when randomUUID is unavailable', async () => {
    const app = new PublicClientApplication(baseConfig);
    const assign = jest.fn();
    jest.spyOn(Date, 'now').mockReturnValue(1234567890);
    jest.spyOn(Math, 'random').mockReturnValue(0.123456789);

    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {
        subtle: {
          digest: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4]).buffer),
        },
      },
    });
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        assign,
      },
    });

    await app.loginRedirect({});

    const authUrl = new URL(assign.mock.calls[0][0] as string);
    expect(authUrl.searchParams.get('scope')).toBe('openid profile email');
    expect(authUrl.searchParams.get('prompt')).toBeNull();
    expect(authUrl.searchParams.get('state')).toContain('1234567890-');
  });

  it('throws a crypto_unavailable error when PKCE cannot be generated', async () => {
    const app = new PublicClientApplication(baseConfig);

    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: undefined,
    });

    await expect(app.loginRedirect({})).rejects.toMatchObject({
      name: 'BrowserAuthError',
      errorCode: 'crypto_unavailable',
    });
  });

  it('resolves initialize immediately', async () => {
    const app = new PublicClientApplication(baseConfig);
    await expect(app.initialize()).resolves.toBeUndefined();
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

  it('returns null when the code flow is missing the PKCE verifier', async () => {
    window.history.replaceState({}, '', '/auth/callback/microsoft?code=abc123&state=opaque-value');
    localStorage.setItem('msal_redirect_state', 'opaque-value');

    const app = new PublicClientApplication(baseConfig);
    await expect(app.handleRedirectPromise()).resolves.toBeNull();
  });

  it('throws when the code flow state does not match the stored state', async () => {
    window.history.replaceState({}, '', '/auth/callback/microsoft?code=abc123&state=wrong-state');
    localStorage.setItem('msal_redirect_state', 'expected-state');
    localStorage.setItem('msal_pkce_verifier', 'opaque-valueopaque-value');

    const app = new PublicClientApplication(baseConfig);

    await expect(app.handleRedirectPromise()).rejects.toMatchObject({
      name: 'BrowserAuthError',
      errorCode: 'state_mismatch',
    });
    expect(localStorage.getItem('msal_redirect_state')).toBeNull();
    expect(localStorage.getItem('msal_pkce_verifier')).toBeNull();
  });

  it('throws when the token exchange response is not ok', async () => {
    window.history.replaceState({}, '', '/auth/callback/microsoft?code=abc123&state=opaque-value');
    localStorage.setItem('msal_redirect_state', 'opaque-value');
    localStorage.setItem('msal_pkce_verifier', 'opaque-valueopaque-value');

    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: jest.fn().mockResolvedValue({ ok: false }),
    });

    const app = new PublicClientApplication(baseConfig);

    await expect(app.handleRedirectPromise()).rejects.toMatchObject({
      name: 'BrowserAuthError',
      errorCode: 'token_exchange_failed',
    });
  });

  it('returns null when the token exchange succeeds without an id token', async () => {
    window.history.replaceState({}, '', '/auth/callback/microsoft?code=abc123&state=opaque-value');
    localStorage.setItem('msal_redirect_state', 'opaque-value');
    localStorage.setItem('msal_pkce_verifier', 'opaque-valueopaque-value');

    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response),
    });

    const app = new PublicClientApplication(baseConfig);
    await expect(app.handleRedirectPromise()).resolves.toBeNull();
    expect(localStorage.getItem('msal_redirect_state')).toBeNull();
    expect(localStorage.getItem('msal_pkce_verifier')).toBeNull();
  });

  it('returns null when there is no redirect hash or query payload', async () => {
    window.history.replaceState({}, '', '/auth/callback/microsoft');

    const app = new PublicClientApplication(baseConfig);
    await expect(app.handleRedirectPromise()).resolves.toBeNull();
  });

  it('returns null when the fragment is missing an id token', async () => {
    window.history.replaceState({}, '', '/auth/callback/microsoft#state=opaque-value');

    const app = new PublicClientApplication(baseConfig);
    await expect(app.handleRedirectPromise()).resolves.toBeNull();
  });

  it('preserves BrowserAuthError metadata', () => {
    const error = new BrowserAuthError('sample_error', 'Readable message');

    expect(error.name).toBe('BrowserAuthError');
    expect(error.errorCode).toBe('sample_error');
    expect(error.message).toBe('Readable message');
  });

  it('returns null when handleRedirectPromise is called in SSR environment (window undefined)', async () => {
    const originalWindow = globalThis.window;

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: undefined,
    });

    try {
      const app = new PublicClientApplication(baseConfig);
      const result = await app.handleRedirectPromise();

      expect(result).toBeNull();
    } finally {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: originalWindow,
      });
    }
  });

  it('validates state mismatch in hash-based implicit flow during handleRedirectPromise', async () => {
    window.history.replaceState({}, '', '/auth/callback/microsoft#id_token=jwt-token&state=wrong-state');
    localStorage.setItem('msal_redirect_state', 'expected-state');

    const app = new PublicClientApplication(baseConfig);
    const result = await app.handleRedirectPromise();

    expect(result).toBeNull();
    expect(localStorage.getItem('msal_redirect_state')).toBeNull();
  });

  it('successfully returns id_token and state from implicit hash flow when state matches', async () => {
    window.history.replaceState({}, '', '/auth/callback/microsoft#id_token=jwt-implicit-token&state=matching-state');
    localStorage.setItem('msal_redirect_state', 'matching-state');

    const app = new PublicClientApplication(baseConfig);
    const result = await app.handleRedirectPromise();

    expect(result).toEqual({ idToken: 'jwt-implicit-token', state: 'matching-state' });
    expect(localStorage.getItem('msal_redirect_state')).toBeNull();
  });
});
