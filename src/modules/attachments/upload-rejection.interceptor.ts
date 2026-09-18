import {
  type CallHandler,
  type ExecutionContext,
  mixin,
  type NestInterceptor,
  PayloadTooLargeException,
  type Type,
  UnprocessableEntityException,
} from '@nestjs/common';
import { type Observable, catchError, throwError } from 'rxjs';

import { fieldBody } from '../../common/errors/api-error.js';

import { MAX_IMAGE_BYTES } from './attachments.constants.js';

// When the size limit trips, the platform layer raises a payload-too-large
// exception and the global filter would answer 413 keyed on the request as a
// whole. Both the status and the key are wrong for a rejected field.
export function UploadRejectionInterceptor(
  field: string,
): Type<NestInterceptor> {
  class MixinInterceptor implements NestInterceptor {
    intercept(
      _context: ExecutionContext,
      next: CallHandler,
    ): Observable<unknown> {
      return next
        .handle()
        .pipe(
          catchError((error: unknown) =>
            throwError(() =>
              error instanceof PayloadTooLargeException
                ? new UnprocessableEntityException(
                    fieldBody(
                      field,
                      `must be at most ${MAX_IMAGE_BYTES} bytes long`,
                    ),
                  )
                : error,
            ),
          ),
        );
    }
  }

  return mixin(MixinInterceptor);
}
