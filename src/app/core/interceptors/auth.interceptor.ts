import {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
  HttpErrorResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

const PASS_THROUGH_401_PATHS = ['/bookings/active-hold'];

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!req.url.startsWith(environment.apiUrl)) {
    return next(req);
  }

  // Add withCredentials so HttpOnly cookies are sent with all API requests
  let authedReq = req.clone({ withCredentials: true });
  const token = authService.getAccessToken();
  if (token) {
    authedReq = addBearerToken(authedReq, token);
  }

  return next(authedReq).pipe(
    catchError((err: unknown) => {
      if (shouldAttemptRefresh(req, err)) {
        return authService.refreshToken().pipe(
          switchMap(res => next(addBearerToken(req.clone({ withCredentials: true }), res.access_token))),
          catchError(refreshErr => {
            authService.logout();
            router.navigate(['/auth/login']);
            return throwError(() => refreshErr);
          })
        );
      }
      return throwError(() => err);
    })
  );
};

function addBearerToken(
  req: HttpRequest<unknown>,
  token: string
): HttpRequest<unknown> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

function shouldAttemptRefresh(
  req: HttpRequest<unknown>,
  err: unknown
): err is HttpErrorResponse {
  if (!(err instanceof HttpErrorResponse) || err.status !== 401) {
    return false;
  }

  if (req.url.includes('/auth/refresh')) {
    return false;
  }

  return !PASS_THROUGH_401_PATHS.some(path => req.url.includes(path));
}
