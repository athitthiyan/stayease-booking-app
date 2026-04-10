import { TestBed } from '@angular/core/testing';
import { appConfig } from './app.config';
import { AuthService } from './core/services/auth.service';
import { of } from 'rxjs';

describe('appConfig', () => {
  it('registers the application providers', () => {
    expect(appConfig.providers).toBeDefined();
    expect(appConfig.providers?.length).toBe(10);
  });

  it('APP_INITIALIZER factory calls authService.initSession()', () => {
    const mockAuthService = {
      initSession: jest.fn().mockReturnValue(of(null)),
    };

    // Configure TestBed with appConfig and mock AuthService
    TestBed.configureTestingModule({
      providers: [
        ...appConfig.providers!,
        { provide: AuthService, useValue: mockAuthService },
      ],
    });

    // The APP_INITIALIZER should be called automatically during TestBed initialization
    // Retrieve the AuthService to verify it was injected and used
    const authService = TestBed.inject(AuthService);

    expect(authService.initSession).toHaveBeenCalled();
  });
});
