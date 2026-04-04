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
      getRefreshToken: jest.fn().mockReturnValue(null),
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
});
