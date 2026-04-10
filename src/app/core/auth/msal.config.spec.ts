describe('msal.config', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.resetModules();
    fetchMock.mockReset();
    Object.defineProperty(window, 'fetch', {
      configurable: true,
      writable: true,
      value: fetchMock,
    });
    localStorage.clear();
  });

  it('exports config, login request, and providers with the expected local redirect settings', async () => {
    jest.doMock('./msal-browser-shim', () => {
      enum LogLevel {
        Error = 'error',
        Warning = 'warning',
      }

      class PublicClientApplication {
        constructor(public readonly config: unknown) {}

        initialize = jest.fn().mockResolvedValue(undefined);
        handleRedirectPromise = jest.fn().mockResolvedValue(null);
      }

      return {
        BrowserCacheLocation: { LocalStorage: 'localStorage' },
        LogLevel,
        PublicClientApplication,
      };
    });

    jest.doMock('./msal-angular-shim', () => ({
      MSAL_INSTANCE: Symbol('MSAL_INSTANCE'),
      MsalService: class {},
      MsalBroadcastService: class {},
    }));

    const module = await import('./msal.config');

    expect(module.msalConfig.auth.clientId).toBe('041f5aef-c9db-4eb8-9bb0-349a19fc3002');
    expect(module.msalConfig.auth.redirectUri).toContain('/auth/callback/microsoft');
    expect(module.msalConfig.auth.postLogoutRedirectUri).toBe(window.location.origin);
    expect(module.msalConfig.cache).toBeDefined();
    expect(module.msalConfig.cache?.cacheLocation).toBe('localStorage');
    expect(module.loginRequest).toEqual({
      scopes: ['openid', 'profile', 'email'],
      prompt: 'select_account',
    });

    const providers = module.msalProviders();
    expect(providers).toHaveLength(4);

    const instanceProvider = providers.find(
      provider => typeof provider === 'object' && 'provide' in provider && provider.provide,
    );
    expect(instanceProvider && 'useFactory' in instanceProvider).toBe(true);

    if (!instanceProvider || !('useFactory' in instanceProvider)) {
      throw new Error('MSAL instance provider missing');
    }

    const instance = instanceProvider.useFactory() as { config: typeof module.msalConfig };
    expect(instance.config).toEqual(module.msalConfig);
  });

  it('completes backend login during APP_INITIALIZER and stores tokens', async () => {
    const { APP_INITIALIZER } = await import('@angular/core');
    const initialize = jest.fn().mockResolvedValue(undefined);
    const handleRedirectPromise = jest.fn().mockResolvedValue({ idToken: 'id-token-123' });

    jest.doMock('./msal-browser-shim', () => {
      enum LogLevel {
        Error = 'error',
        Warning = 'warning',
      }

      class PublicClientApplication {
        constructor(public readonly config: unknown) {
          void config;
        }

        initialize = initialize;
        handleRedirectPromise = handleRedirectPromise;
      }

      return {
        BrowserCacheLocation: { LocalStorage: 'localStorage' },
        LogLevel,
        PublicClientApplication,
      };
    });

    const msalInstanceToken = Symbol('MSAL_INSTANCE');
    jest.doMock('./msal-angular-shim', () => ({
      MSAL_INSTANCE: msalInstanceToken,
      MsalService: class {},
      MsalBroadcastService: class {},
    }));

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        user: { email: 'user@example.com' },
      }),
    } as Response);

    const module = await import('./msal.config');
    const appInitializerProvider = module
      .msalProviders()
      .find(provider => typeof provider === 'object' && 'provide' in provider && provider.provide === APP_INITIALIZER);

    expect(appInitializerProvider && 'useFactory' in appInitializerProvider).toBe(true);

    if (!appInitializerProvider || !('useFactory' in appInitializerProvider)) {
      throw new Error('APP_INITIALIZER provider missing');
    }

    const instance = {
      initialize,
      handleRedirectPromise,
    };
    const initializer = appInitializerProvider.useFactory(instance as never) as () => Promise<void>;
    await initializer();

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8000/auth/social-login', expect.objectContaining({
      method: 'POST',
    }));
    expect(localStorage.getItem('se_user')).toBe(JSON.stringify({ email: 'user@example.com' }));
    expect(module.consumePendingSession()).toEqual({
      accessToken: 'access-token',
      user: { email: 'user@example.com' },
    });
    expect(module.getMsalRedirectResult()).toEqual({ idToken: 'id-token-123' });
    expect(module.wasBackendLoginDone()).toBe(true);
  });

  it('gracefully handles failed backend login and redirect errors', async () => {
    const { APP_INITIALIZER } = await import('@angular/core');
    const initialize = jest.fn().mockResolvedValue(undefined);
    const handleRedirectPromise = jest
      .fn()
      .mockResolvedValueOnce({ idToken: 'id-token-123' })
      .mockRejectedValueOnce(new Error('redirect failed'));

    jest.doMock('./msal-browser-shim', () => {
      enum LogLevel {
        Error = 'error',
        Warning = 'warning',
      }

      class PublicClientApplication {
        initialize = initialize;
        handleRedirectPromise = handleRedirectPromise;
      }

      return {
        BrowserCacheLocation: { LocalStorage: 'localStorage' },
        LogLevel,
        PublicClientApplication,
      };
    });

    jest.doMock('./msal-angular-shim', () => ({
      MSAL_INSTANCE: Symbol('MSAL_INSTANCE'),
      MsalService: class {},
      MsalBroadcastService: class {},
    }));

    fetchMock.mockResolvedValueOnce({ ok: false } as Response).mockRejectedValueOnce(new Error('network'));

    const module = await import('./msal.config');
    const appInitializerProvider = module
      .msalProviders()
      .find(provider => typeof provider === 'object' && 'provide' in provider && provider.provide === APP_INITIALIZER);

    if (!appInitializerProvider || !('useFactory' in appInitializerProvider)) {
      throw new Error('APP_INITIALIZER provider missing');
    }

    const instance = {
      initialize,
      handleRedirectPromise,
    };

    const initializerOne = appInitializerProvider.useFactory(instance as never) as () => Promise<void>;
    await initializerOne();
    expect(module.wasBackendLoginDone()).toBe(false);
    expect(localStorage.getItem('se_access_token')).toBeNull();

    const initializerTwo = appInitializerProvider.useFactory(instance as never) as () => Promise<void>;
    await initializerTwo();
    expect(module.getMsalRedirectResult()).toBeNull();
  });

  it('returns false when backend login throws during initializer execution', async () => {
    const { APP_INITIALIZER } = await import('@angular/core');
    const initialize = jest.fn().mockResolvedValue(undefined);
    const handleRedirectPromise = jest.fn().mockResolvedValue({ idToken: 'id-token-789' });

    jest.doMock('./msal-browser-shim', () => {
      enum LogLevel {
        Error = 'error',
        Warning = 'warning',
      }

      class PublicClientApplication {
        initialize = initialize;
        handleRedirectPromise = handleRedirectPromise;
      }

      return {
        BrowserCacheLocation: { LocalStorage: 'localStorage' },
        LogLevel,
        PublicClientApplication,
      };
    });

    jest.doMock('./msal-angular-shim', () => ({
      MSAL_INSTANCE: Symbol('MSAL_INSTANCE'),
      MsalService: class {},
      MsalBroadcastService: class {},
    }));

    fetchMock.mockRejectedValue(new Error('network down'));

    const module = await import('./msal.config');
    const appInitializerProvider = module
      .msalProviders()
      .find(provider => typeof provider === 'object' && 'provide' in provider && provider.provide === APP_INITIALIZER);

    if (!appInitializerProvider || !('useFactory' in appInitializerProvider)) {
      throw new Error('APP_INITIALIZER provider missing');
    }

    const initializer = appInitializerProvider.useFactory({
      initialize,
      handleRedirectPromise,
    } as never) as () => Promise<void>;

    await initializer();

    expect(module.getMsalRedirectResult()).toEqual({ idToken: 'id-token-789' });
    expect(module.wasBackendLoginDone()).toBe(false);
  });

  it('treats successful backend responses without an access token as an incomplete login', async () => {
    const { APP_INITIALIZER } = await import('@angular/core');
    const initialize = jest.fn().mockResolvedValue(undefined);
    const handleRedirectPromise = jest.fn().mockResolvedValue({ idToken: 'id-token-456' });

    jest.doMock('./msal-browser-shim', () => {
      enum LogLevel {
        Error = 'error',
        Warning = 'warning',
      }

      class PublicClientApplication {
        constructor(public readonly config: unknown) {
          void config;
        }

        initialize = initialize;
        handleRedirectPromise = handleRedirectPromise;
      }

      return {
        BrowserCacheLocation: { LocalStorage: 'localStorage' },
        LogLevel,
        PublicClientApplication,
      };
    });

    jest.doMock('./msal-angular-shim', () => ({
      MSAL_INSTANCE: Symbol('MSAL_INSTANCE'),
      MsalService: class {},
      MsalBroadcastService: class {},
    }));

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ refresh_token: 'refresh-only', user: { email: 'user@example.com' } }),
    } as Response);

    const module = await import('./msal.config');
    const appInitializerProvider = module
      .msalProviders()
      .find(provider => typeof provider === 'object' && 'provide' in provider && provider.provide === APP_INITIALIZER);

    if (!appInitializerProvider || !('useFactory' in appInitializerProvider)) {
      throw new Error('APP_INITIALIZER provider missing');
    }

    const initializer = appInitializerProvider.useFactory({
      initialize,
      handleRedirectPromise,
    } as never) as () => Promise<void>;

    await initializer();

    expect(module.getMsalRedirectResult()).toEqual({ idToken: 'id-token-456' });
    expect(module.wasBackendLoginDone()).toBe(false);
    expect(localStorage.getItem('se_access_token')).toBeNull();
  });

  it('uses Error LogLevel in production environment', async () => {
    jest.resetModules();
    fetchMock.mockReset();

    jest.doMock('./msal-browser-shim', () => {
      enum LogLevel {
        Error = 'error',
        Warning = 'warning',
      }

      class PublicClientApplication {
        constructor(public readonly config: unknown) {}

        initialize = jest.fn().mockResolvedValue(undefined);
        handleRedirectPromise = jest.fn().mockResolvedValue(null);
      }

      return {
        BrowserCacheLocation: { LocalStorage: 'localStorage' },
        LogLevel,
        PublicClientApplication,
      };
    });

    jest.doMock('./msal-angular-shim', () => ({
      MSAL_INSTANCE: Symbol('MSAL_INSTANCE'),
      MsalService: class {},
      MsalBroadcastService: class {},
    }));

    // Mock environment as production
    jest.doMock('../../../environments/environment', () => ({
      environment: {
        production: true,
        microsoftClientId: '041f5aef-c9db-4eb8-9bb0-349a19fc3002',
        microsoftTenantId: 'test-tenant',
        apiUrl: 'http://localhost:8000',
      },
    }));

    const module = await import('./msal.config');

    expect(module.msalConfig.system?.loggerOptions?.logLevel).toBe('error');
  });

  it('uses Warning LogLevel in development environment', async () => {
    jest.resetModules();
    fetchMock.mockReset();

    jest.doMock('./msal-browser-shim', () => {
      enum LogLevel {
        Error = 'error',
        Warning = 'warning',
      }

      class PublicClientApplication {
        constructor(public readonly config: unknown) {}

        initialize = jest.fn().mockResolvedValue(undefined);
        handleRedirectPromise = jest.fn().mockResolvedValue(null);
      }

      return {
        BrowserCacheLocation: { LocalStorage: 'localStorage' },
        LogLevel,
        PublicClientApplication,
      };
    });

    jest.doMock('./msal-angular-shim', () => ({
      MSAL_INSTANCE: Symbol('MSAL_INSTANCE'),
      MsalService: class {},
      MsalBroadcastService: class {},
    }));

    // Mock environment as development (production: false)
    jest.doMock('../../../environments/environment', () => ({
      environment: {
        production: false,
        microsoftClientId: '041f5aef-c9db-4eb8-9bb0-349a19fc3002',
        microsoftTenantId: 'test-tenant',
        apiUrl: 'http://localhost:8000',
      },
    }));

    const module = await import('./msal.config');

    expect(module.msalConfig.system?.loggerOptions?.logLevel).toBe('warning');
  });
});
