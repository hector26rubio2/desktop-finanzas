import { HttpInterceptorFn } from '@angular/common/http';

export const csrfInterceptor: HttpInterceptorFn = (req, next) => {
  const skip = req.method === 'GET' || req.method === 'HEAD' || req.url.includes('/auth/');
  if (skip) return next(req);
  return next(req.clone({ setHeaders: { 'X-XSRF-Token': '1' } }));
};
