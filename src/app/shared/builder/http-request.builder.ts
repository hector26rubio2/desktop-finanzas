import { HttpRequest } from '@angular/common/http';
import { EncryptionStrategy } from '../strategy/encryption/strategy';

export class HttpRequestBuilder {
  private _req: HttpRequest<unknown>;
  private _token: string | null = null;
  private _strategy: EncryptionStrategy | null = null;

  constructor(req: HttpRequest<unknown>) {
    this._req = req;
  }

  withToken(token: string): this {
    this._token = token;
    return this;
  }

  withEncryption(strategy: EncryptionStrategy): this {
    this._strategy = strategy;
    return this;
  }

  async build(): Promise<HttpRequest<unknown>> {
    let req = this._req;
    if (this._token) {
      req = req.clone({ setHeaders: { Authorization: `Bearer ${this._token}` } });
    }
    if (
      this._strategy &&
      req.body &&
      typeof req.body === 'object' &&
      !(req.body instanceof FormData) &&
      req.method !== 'GET'
    ) {
      const encrypted = await this._strategy.encrypt(req.body);
      req = req.clone({ body: { encrypted } });
    }
    return req;
  }
}
