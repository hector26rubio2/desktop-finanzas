import { ErrorHandler, inject, Injectable } from '@angular/core';
import { LoggerService } from '../../shared/services/logger/logger.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private logger = inject(LoggerService);

  handleError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    this.logger.error(`Angular uncaught: ${message}`, stack);
  }
}
