import { applyDecorators, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';

import { MAX_IMAGE_BYTES } from './attachments.constants.js';
import { UploadRejectionInterceptor } from './upload-rejection.interceptor.js';

// No storage is configured, so the upload is held in memory and never touches
// disk: a rejected request leaves nothing behind anywhere.
export function ImageUpload(field: string) {
  return applyDecorators(
    // Order carries meaning: the first is the outer layer, and only the outer
    // layer sees an error the inner one raises before the handler is reached.
    UseInterceptors(
      UploadRejectionInterceptor(field),
      // Exclusive: the parser stops the moment the total reaches the number it
      // was given, so this is the first size refused, not the largest accepted.
      FileInterceptor(field, {
        limits: { fileSize: MAX_IMAGE_BYTES + 1 },
      }),
    ),
    ApiConsumes('multipart/form-data'),
    ApiBody({
      schema: {
        type: 'object',
        properties: { [field]: { type: 'string', format: 'binary' } },
      },
    }),
  );
}
