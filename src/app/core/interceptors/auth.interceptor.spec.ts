import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

describe('authInterceptor', () => {
  let httpClient: HttpClient;
  let httpMock: HttpTestingController;
  let mockAuth: jest.Mocked<Partial<AuthService>>;
  let mockRouter: jest.Mocked<Partial<Router>>;

  const apiUrl = environment.apiUrl;

  function setupModule(overrides: Partial<AuthService> = {}) {
    mockAuth = {
      getAccessToken: jest.fn().mockReturnValue(null),
      refreshToken: jest.fn(),
      logout: jest.fn(),
      ...overrides,
    } as jest.Mocked<Partial<AuthService>>;

    mockRouter = { navigate: jest.fn() } as jest.Mocked<Partial<Router>>;

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: mockAuth },
        { provide: Router, useValue: mockRouter },
      ],
    });

    httpClient = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  }

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  it('should NOT add Authorization header for non-API urls', () => {
    setupModule({ getAccessToken: jest.fn().mockReturnValue('my-token') });

    httpClient.get('https://external.example.com/data').subscribe();

    const req = httpMock.expectOne('https://external.example.com/data');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('should add Bearer token for API requests when token exists', () => {
    setupModule({ getAccessToken: jest.fn().mockReturnValue('my-access-token') });

    httpClient.get(`${apiUrl}/rooms`).subscribe();

    const req = httpMock.expectOne(`${apiUrl}/rooms`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer my-access-token');
    req.flush([]);
  });

  it('should NOT add Authorization header when no token', () => {
    setupModule({ getAccessToken: jest.fn().mockReturnValue(null) });

    httpClient.get(`${apiUrl}/rooms`).subscribe();

    const req = httpMock.expectOne(`${apiUrl}/rooms`);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush([]);
  });

  it('refreshes the token and retries the request after a 401', () => {
    setupModule({
      getAccessToken: jest.fn().mockReturnValue('expired-token'),
      refreshToken: jest.fn().mockReturnValue(of({ access_token: 'fresh-token' })),
    });

    const nextSpy = jest.fn();
    httpClient.get(`${apiUrl}/rooms`).subscribe(nextSpy);

    const initialReq = httpMock.expectOne(`${apiUrl}/rooms`);
    expect(initialReq.request.headers.get('Authorization')).toBe('Bearer expired-token');
    initialReq.flush(
      { detail: 'expired' },
      { status: 401, statusText: 'Unauthorized' },
    );

    const retriedReq = httpMock.expectOne(`${apiUrl}/rooms`);
    expect(mockAuth.refreshToken).toHaveBeenCalled();
    expect(retriedReq.request.headers.get('Authorization')).toBe('Bearer fresh-token');
    retriedReq.flush([{ id: 1 }]);

    expect(nextSpy).toHaveBeenCalledWith([{ id: 1 }]);
  });

  it('logs out and redirects when token refresh fails', () => {
    setupModule({
      getAccessToken: jest.fn().mockReturnValue('expired-token'),
      refreshToken: jest.fn().mockReturnValue(
        throwError(() => new Error('refresh failed')),
      ),
    });

    const errorSpy = jest.fn();
    httpClient.get(`${apiUrl}/rooms`).subscribe({ error: errorSpy });

    const req = httpMock.expectOne(`${apiUrl}/rooms`);
    req.flush(
      { detail: 'expired' },
      { status: 401, statusText: 'Unauthorized' },
    );

    expect(mockAuth.logout).toHaveBeenCalled();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/auth/login']);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('passes through non-401 API errors without refreshing', () => {
    setupModule({
      getAccessToken: jest.fn().mockReturnValue('token'),
      refreshToken: jest.fn(),
    });

    const errorSpy = jest.fn();
    httpClient.get(`${apiUrl}/rooms`).subscribe({ error: errorSpy });

    const req = httpMock.expectOne(`${apiUrl}/rooms`);
    req.flush({ detail: 'forbidden' }, { status: 403, statusText: 'Forbidden' });

    expect(mockAuth.refreshToken).not.toHaveBeenCalled();
    expect(mockAuth.logout).not.toHaveBeenCalled();
    expect(mockRouter.navigate).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
  });

  it('passes through active hold 401s without refreshing or logging out', () => {
    setupModule({
      getAccessToken: jest.fn().mockReturnValue('expired-token'),
      refreshToken: jest.fn(),
    });

    const errorSpy = jest.fn();
    httpClient.get(`${apiUrl}/bookings/active-hold`).subscribe({ error: errorSpy });

    const req = httpMock.expectOne(`${apiUrl}/bookings/active-hold`);
    req.flush(
      { detail: 'missing session' },
      { status: 401, statusText: 'Unauthorized' },
    );

    expect(mockAuth.refreshToken).not.toHaveBeenCalled();
    expect(mockAuth.logout).not.toHaveBeenCalled();
    expect(mockRouter.navigate).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
  });
});
