import { applyDecorators, Header } from '@nestjs/common';

/**
 * For responses that carry a token. RFC 6749 §5.1 requires no-store and
 * no-cache on those; Expires covers caches that predate either.
 */
export function NoStore() {
  return applyDecorators(
    Header('Cache-Control', 'no-store'),
    Header('Pragma', 'no-cache'),
    Header('Expires', '0'),
  );
}
