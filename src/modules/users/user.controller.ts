import { Body, Controller, Get, Put, SerializeOptions } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { fieldBody } from '../../common/errors/api-error.js';
import {
  INVALID_MESSAGE,
  TAKEN_MESSAGE,
} from '../../common/errors/messages.js';
import { Authenticated } from '../../common/decorators/authenticated.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { NoStore } from '../../common/decorators/no-store.decorator.js';
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
  @Authenticated()
  @ApiOperation({ summary: 'Read the signed-in account' })
  @ApiOkResponse({ schema: { example: userResponseExample } })
  @NoStore()
  @SerializeOptions({ schema: userResponseSchema })
  async current(@CurrentUser() caller: Express.User): Promise<UserWithToken> {
    const user = await this.usersService.currentUser(caller.id);

    // The presented token, not a new one: one sign-in, one token to revoke.
    return { ...user, token: caller.token };
  }

  @Put()
  @Authenticated()
  @ApiOperation({ summary: 'Update the signed-in account' })
  @ApiOkResponse({ schema: { example: userResponseExample } })
  @ApiConflictResponse({
    schema: { example: fieldBody('email', TAKEN_MESSAGE) },
  })
  @ApiUnprocessableEntityResponse({
    schema: { example: fieldBody('email', INVALID_MESSAGE) },
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
