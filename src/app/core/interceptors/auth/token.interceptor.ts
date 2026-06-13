import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { TokenService } from '../../../shared/services/auth/token.service';

export const authTokenInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(TokenService);
  const authedReq = token.accessToken
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token.accessToken}` } })
    : req;
  return next(authedReq);
};
