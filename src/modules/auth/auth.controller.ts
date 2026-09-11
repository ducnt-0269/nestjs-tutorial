import {
  Body,
  Controller,
  Header,
  Post,
  SerializeOptions,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { userResponseSchema } from '../users/users.schema.js';
import { type RegisterBody, registerSchema } from './auth.schema.js';
import { type AuthenticatedUser, AuthService } from './auth.service.js';

// The spec keeps /api/users (public: register, login) apart from /api/user
// (the authenticated caller), so this controller answers under the plural.
@ApiTags('users')
@Controller('users')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post()
  @ApiOperation({ summary: 'Register a new account' })
  @ApiCreatedResponse({
    schema: {
      example: {
        user: {
          email: 'jake@example.com',
          username: 'jake',
          bio: null,
          image: null,
          token: '<jwt>',
        },
      },
    },
  })
  @ApiUnprocessableEntityResponse({
    schema: { example: { errors: { email: ["can't be blank"] } } },
  })
  @ApiConflictResponse({
    schema: { example: { errors: { email: ['has already been taken'] } } },
  })
  // The response carries a token. RFC 6749 §5.1 requires no-store and
  // no-cache on token responses; Expires covers caches that predate either.
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @SerializeOptions({ schema: userResponseSchema })
  register(
    @Body({ schema: registerSchema }) body: RegisterBody,
  ): Promise<AuthenticatedUser> {
    return this.auth.register(body.user);
  }
}
