export interface AuthenticationResult {
  idToken?: string;
  state?: string | null;
  [key: string]: unknown;
}

export interface RedirectRequest {
  scopes?: string[];
  prompt?: string;
  [key: string]: unknown;
}

export interface Configuration {
  auth: {
    clientId: string;
    authority: string;
    redirectUri: string;
    postLogoutRedirectUri: string;
  };
  cache: {
    cacheLocation: string;
  };
  system?: {
    loggerOptions?: {
      logLevel?: unknown;
    };
  };
}

export interface IPublicClientApplication {
  initialize(): Promise<void>;
  handleRedirectPromise(): Promise<AuthenticationResult | null>;
  loginRedirect(request: RedirectRequest): Promise<void>;
}

export const BrowserCacheLocation = {
  LocalStorage: 'localStorage',
} as const;

export const LogLevel = {
  Error: 'error',
  Warning: 'warning',
} as const;

const REDIRECT_STATE_KEY = 'msal_redirect_state';
const PKCE_VERIFIER_KEY = 'msal_pkce_verifier';

interface TokenExchangeResponse {
  id_token?: string;
}

function createOpaqueValue(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

async function createCodeChallenge(verifier: string): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new BrowserAuthError('crypto_unavailable', 'Web Crypto is required for Microsoft sign-in.');
  }

  const encoded = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return toBase64Url(new Uint8Array(digest));
}

function clearRedirectArtifacts(): void {
  localStorage.removeItem(REDIRECT_STATE_KEY);
  localStorage.removeItem(PKCE_VERIFIER_KEY);
}

function clearBrowserCallbackUrl(): void {
  if (typeof window.history?.replaceState === 'function') {
    window.history.replaceState({}, document.title, `${window.location.pathname}`);
  }
}

export class PublicClientApplication implements IPublicClientApplication {
  constructor(private readonly config: Configuration) {}

  async initialize(): Promise<void> {
    return Promise.resolve();
  }

  async handleRedirectPromise(): Promise<AuthenticationResult | null> {
    if (typeof window === 'undefined') {
      return null;
    }

    const search = window.location.search.startsWith('?')
      ? window.location.search.slice(1)
      : '';
    const hash = window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : '';
    const searchParams = new URLSearchParams(search);
    const hashParams = new URLSearchParams(hash);
    const expectedState = localStorage.getItem(REDIRECT_STATE_KEY);

    if (searchParams.get('code')) {
      const state = searchParams.get('state');
      const code = searchParams.get('code');
      const verifier = localStorage.getItem(PKCE_VERIFIER_KEY);

      if (!code || !verifier) {
        return null;
      }

      if (expectedState && state && expectedState !== state) {
        clearRedirectArtifacts();
        throw new BrowserAuthError('state_mismatch', 'Microsoft sign-in state validation failed.');
      }

      const authority = this.config.auth.authority.replace(/\/$/, '');
      const tokenUrl = `${authority}/oauth2/v2.0/token`;
      const scopes = 'openid profile email';
      const body = new URLSearchParams({
        client_id: this.config.auth.clientId,
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.config.auth.redirectUri,
        code_verifier: verifier,
        scope: scopes,
      });

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (!response.ok) {
        clearRedirectArtifacts();
        throw new BrowserAuthError('token_exchange_failed', 'Microsoft sign-in token exchange failed.');
      }

      const data = await response.json() as TokenExchangeResponse;
      if (!data.id_token) {
        clearRedirectArtifacts();
        return null;
      }

      clearRedirectArtifacts();
      clearBrowserCallbackUrl();
      return { idToken: data.id_token, state };
    }

    if (!hash) {
      return null;
    }

    const idToken = hashParams.get('id_token');
    const state = hashParams.get('state');

    if (!idToken) {
      return null;
    }

    if (expectedState && state && expectedState !== state) {
      clearRedirectArtifacts();
      return null;
    }

    clearRedirectArtifacts();
    clearBrowserCallbackUrl();

    return { idToken, state };
  }

  async loginRedirect(request: RedirectRequest): Promise<void> {
    if (typeof window === 'undefined') {
      return;
    }

    const state = createOpaqueValue();
    const verifier = createOpaqueValue() + createOpaqueValue();
    const challenge = await createCodeChallenge(verifier);
    localStorage.setItem(REDIRECT_STATE_KEY, state);
    localStorage.setItem(PKCE_VERIFIER_KEY, verifier);

    const scopes = request.scopes?.length
      ? request.scopes.join(' ')
      : 'openid profile email';

    const authority = this.config.auth.authority.replace(/\/$/, '');
    const url = new URL(`${authority}/oauth2/v2.0/authorize`);
    url.searchParams.set('client_id', this.config.auth.clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('response_mode', 'query');
    url.searchParams.set('redirect_uri', this.config.auth.redirectUri);
    url.searchParams.set('scope', scopes);
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', challenge);
    url.searchParams.set('code_challenge_method', 'S256');

    if (request.prompt) {
      url.searchParams.set('prompt', request.prompt);
    }

    window.location.assign(url.toString());
  }
}

export class BrowserAuthError extends Error {
  errorCode: string;

  constructor(errorCode: string, errorMessage = errorCode) {
    super(errorMessage);
    this.name = 'BrowserAuthError';
    this.errorCode = errorCode;
  }
}
