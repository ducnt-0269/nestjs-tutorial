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
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import {
  fieldBody,
  invalidCredentialsBody,
} from '../../common/errors/api-error.js';
import { blank, taken } from '../../common/errors/messages.js';
import { Authenticated } from '../../common/decorators/authenticated.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
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
import { TokenRevocationService } from './token-revocation.service.js';

// The spec keeps /api/users (public: register, login) apart from /api/user
// (the authenticated caller), so this controller answers under the plural.
@ApiTags('users')
@Controller('users')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly tokenRevocationService: TokenRevocationService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Register a new account' })
  @ApiCreatedResponse({ schema: { example: userResponseExample } })
  @ApiUnprocessableEntityResponse({
    schema: { example: fieldBody('email', blank) },
  })
  @ApiConflictResponse({
    schema: { example: fieldBody('email', taken) },
  })
  @NoStore()
  @SerializeOptions({ schema: userResponseSchema })
  register(
    @Body({ schema: registerSchema }) body: RegisterBody,
  ): Promise<UserWithToken> {
    return this.authService.register(body.user);
  }

  @Post('login')
  // Signing in creates nothing, and NestJS answers POST with 201 by default.
  @HttpCode(200)
  @ApiOperation({ summary: 'Sign in to an existing account' })
  @ApiOkResponse({ schema: { example: userResponseExample } })
  @ApiUnauthorizedResponse({
    schema: { example: invalidCredentialsBody },
  })
  @ApiUnprocessableEntityResponse({
    schema: { example: fieldBody('email', blank) },
  })
  @NoStore()
  @SerializeOptions({ schema: userResponseSchema })
  login(
    @Body({ schema: loginSchema }) body: LoginBody,
  ): Promise<UserWithToken> {
    return this.authService.login(body.user);
  }

  @Post('logout')
  // The presented token dies here, so there is nothing left to answer with.
  @HttpCode(204)
  @Authenticated()
  @ApiOperation({ summary: 'Sign out and revoke the presented token' })
  @ApiNoContentResponse()
  logout(@CurrentUser() caller: Express.User): Promise<void> {
    return this.tokenRevocationService.revoke(caller.token);
  }
}
