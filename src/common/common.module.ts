import {
  Global,
  HttpStatus,
  Logger,
  Module,
  StandardSchemaSerializerInterceptor,
  StandardSchemaValidationPipe,
} from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE, Reflector } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { AllExceptionsFilter } from './filters/all-exceptions.filter.js';
import { validationExceptionFactory } from './pipes/validation-exception.factory.js';

// Registered as providers rather than in the bootstrap, so tests import the same wiring.
// Global because a subclass of the passport guard inherits its options
// parameter, which every module owning a guarded route would otherwise supply.
@Global()
@Module({
  imports: [PassportModule.register({})],
  exports: [PassportModule],
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
