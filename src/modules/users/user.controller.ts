import {
  Body,
  Controller,
  Get,
  Put,
  SerializeOptions,
  UseGuards,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { NoStore } from '../../common/decorators/no-store.decorator.js';
import {
  JwtAuthGuard,
  TOKEN_SCHEME,
} from '../../common/guards/jwt-auth.guard.js';
import {
  type UpdateUserBody,
  updateUserSchema,
  userResponseExample,
  userResponseSchema,
} from './users.schema.js';
import { type UserWithToken, UsersService } from './users.service.js';

// The caller's own account; the public plural route stays with auth.
@ApiTags('user')
@Controller('user')
export class UserController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Read the signed-in account' })
  @ApiSecurity(TOKEN_SCHEME)
  @ApiOkResponse({ schema: { example: userResponseExample } })
  @ApiUnauthorizedResponse({
    schema: { example: { errors: { token: ['is invalid'] } } },
  })
  @NoStore()
  @SerializeOptions({ schema: userResponseSchema })
  async current(@CurrentUser() caller: Express.User): Promise<UserWithToken> {
    const user = await this.usersService.currentUser(caller.id);

    // The presented token, not a new one: one sign-in, one token to revoke.
    return { ...user, token: caller.token };
  }

  @Put()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update the signed-in account' })
  @ApiSecurity(TOKEN_SCHEME)
  @ApiOkResponse({ schema: { example: userResponseExample } })
  @ApiUnauthorizedResponse({
    schema: { example: { errors: { token: ['is invalid'] } } },
  })
  @ApiConflictResponse({
    schema: { example: { errors: { email: ['has already been taken'] } } },
  })
  @ApiUnprocessableEntityResponse({
    schema: { example: { errors: { email: ['is invalid'] } } },
  })
  @NoStore()
  @SerializeOptions({ schema: userResponseSchema })
  async update(
    @CurrentUser() caller: Express.User,
    @Body({ schema: updateUserSchema }) body: UpdateUserBody,
  ): Promise<UserWithToken> {
    const user = await this.usersService.updateCurrentUser(
      caller.id,
      body.user,
    );

    // Changing the password leaves the presented token alive; it carries no
    // credential that the update could have made stale.
    return { ...user, token: caller.token };
  }
}
