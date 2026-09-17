import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiSecurity, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { invalidTokenBody } from '../errors/api-error.js';
import { JwtAuthGuard, TOKEN_SCHEME } from '../guards/jwt-auth.guard.js';

// Requires a valid token; optional-authentication routes need a separate guard.
export function Authenticated() {
  return applyDecorators(
    UseGuards(JwtAuthGuard),
    ApiSecurity(TOKEN_SCHEME),
    ApiUnauthorizedResponse({ schema: { example: invalidTokenBody } }),
  );
}
