import { HttpInterceptorFn } from '@angular/common/http';

function getCsrfToken(): string | null {
  const match = document.cookie.split('; ').find((row) => row.startsWith('XSRF-TOKEN='));
  return match ? decodeURIComponent(match.split('=')[1]) : null;
}

function ensureCsrfCookie(): void {
  if (!document.cookie.includes('XSRF-TOKEN=')) {
    const token = crypto.getRandomValues(new Uint8Array(32)).reduce((s, b) => s + b.toString(16).padStart(2, '0'), '');
    document.cookie = `XSRF-TOKEN=${token}; path=/; SameSite=Strict${location.protocol === 'https:' ? '; Secure' : ''}`;
  }
}

export const csrfInterceptor: HttpInterceptorFn = (req, next) => {
  const skip = req.method === 'GET' || req.method === 'HEAD';
  if (skip) {
    ensureCsrfCookie();
    return next(req);
  }

  ensureCsrfCookie();
  const token = getCsrfToken();
  if (token) {
    return next(req.clone({ setHeaders: { 'X-XSRF-Token': token } }));
  }
  return next(req);
};
