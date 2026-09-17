import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiSecurity, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { invalidTokenBody } from '../errors/api-error.js';
import { JwtAuthGuard, TOKEN_SCHEME } from '../guards/jwt-auth.guard.js';

// Everything a route that demands a token has to say: the guard that turns a
// missing or revoked one into 401, plus the two lines of OpenAPI that tell a
// reader the route expects a token and what it answers without a valid one.
// Demands, not accepts: §4's optional-authentication routes answer 200 to a
// reader whose token is broken, and this composite would turn that into 401.
export function Authenticated() {
  return applyDecorators(
    UseGuards(JwtAuthGuard),
    ApiSecurity(TOKEN_SCHEME),
    ApiUnauthorizedResponse({ schema: { example: invalidTokenBody } }),
  );
}
