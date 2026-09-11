import { applyDecorators, Header } from '@nestjs/common';

// RFC 6749 §5.1 requires no-store and no-cache on a response carrying a token;
// Expires covers caches that predate either.
export function NoStore() {
  return applyDecorators(
    Header('Cache-Control', 'no-store'),
    Header('Pragma', 'no-cache'),
    Header('Expires', '0'),
  );
}
