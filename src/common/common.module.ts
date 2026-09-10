import {
  HttpStatus,
  Logger,
  Module,
  StandardSchemaSerializerInterceptor,
  StandardSchemaValidationPipe,
} from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE, Reflector } from '@nestjs/core';
import { ErrorsEnvelopeFilter } from './filters/errors-envelope.filter.js';
import { validationExceptionFactory } from './pipes/validation-exception.factory.js';

/**
 * The three components every request passes through
 * (docs/system-architecture.md §5). Registered as providers rather than in
 * main.ts so a test application can import exactly what production runs.
 */
@Module({
  providers: [
    Logger,
    {
      provide: APP_PIPE,
      useValue: new StandardSchemaValidationPipe({
        errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        exceptionFactory: validationExceptionFactory,
      }),
    },
    { provide: APP_FILTER, useClass: ErrorsEnvelopeFilter },
    {
      // The interceptor takes Reflector untyped, so DI cannot resolve it by
      // itself.
      provide: APP_INTERCEPTOR,
      useFactory: (reflector: Reflector) =>
        new StandardSchemaSerializerInterceptor(reflector),
      inject: [Reflector],
    },
  ],
})
export class CommonModule {}
