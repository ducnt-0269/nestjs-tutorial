import {
  HttpStatus,
  Logger,
  Module,
  StandardSchemaSerializerInterceptor,
  StandardSchemaValidationPipe,
} from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE, Reflector } from '@nestjs/core';
import { AllExceptionsFilter } from './filters/all-exceptions.filter.js';
import { validationExceptionFactory } from './pipes/validation-exception.factory.js';

// Registered as providers rather than in the bootstrap, so tests import the same wiring.
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
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    {
      // Its constructor types Reflector as `any`, so DI needs a factory.
      provide: APP_INTERCEPTOR,
      useFactory: (reflector: Reflector) =>
        new StandardSchemaSerializerInterceptor(reflector),
      inject: [Reflector],
    },
  ],
})
export class CommonModule {}
