import {
  Body,
  Controller,
  HttpCode,
  Post,
  SerializeOptions,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { NoStore } from '../../common/decorators/no-store.decorator.js';
import {
  userResponseExample,
  userResponseSchema,
} from '../users/users.schema.js';
import type { UserWithToken } from '../users/users.service.js';
import {
  type LoginBody,
  loginSchema,
  type RegisterBody,
  registerSchema,
} from './auth.schema.js';
import { AuthService } from './auth.service.js';

// The spec keeps /api/users (public: register, login) apart from /api/user
// (the authenticated caller), so this controller answers under the plural.
@ApiTags('users')
@Controller('users')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post()
  @ApiOperation({ summary: 'Register a new account' })
  @ApiCreatedResponse({ schema: { example: userResponseExample } })
  @ApiUnprocessableEntityResponse({
    schema: { example: { errors: { email: ["can't be blank"] } } },
  })
  @ApiConflictResponse({
    schema: { example: { errors: { email: ['has already been taken'] } } },
  })
  @NoStore()
  @SerializeOptions({ schema: userResponseSchema })
  register(
    @Body({ schema: registerSchema }) body: RegisterBody,
  ): Promise<UserWithToken> {
    return this.auth.register(body.user);
  }

  @Post('login')
  // Signing in creates nothing, and NestJS answers POST with 201 by default.
  @HttpCode(200)
  @ApiOperation({ summary: 'Sign in to an existing account' })
  @ApiOkResponse({ schema: { example: userResponseExample } })
  @ApiUnauthorizedResponse({
    schema: { example: { errors: { credentials: ['invalid'] } } },
  })
  @ApiUnprocessableEntityResponse({
    schema: { example: { errors: { email: ["can't be blank"] } } },
  })
  @NoStore()
  @SerializeOptions({ schema: userResponseSchema })
  login(
    @Body({ schema: loginSchema }) body: LoginBody,
  ): Promise<UserWithToken> {
    return this.auth.login(body.user);
  }
}
