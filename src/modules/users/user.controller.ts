import {
  Controller,
  Get,
  SerializeOptions,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { NoStore } from '../../common/decorators/no-store.decorator.js';
import {
  JwtAuthGuard,
  TOKEN_SCHEME,
} from '../../common/guards/jwt-auth.guard.js';
import { userResponseExample, userResponseSchema } from './users.schema.js';
import { type UserWithToken, UsersService } from './users.service.js';

// The singular route is the caller's own account and belongs to this module;
// the plural one is public and stays with auth.
@ApiTags('user')
@Controller('user')
export class UserController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Read the signed-in account' })
  @ApiSecurity(TOKEN_SCHEME)
  @ApiOkResponse({ schema: { example: userResponseExample } })
  @ApiUnauthorizedResponse({
    schema: { example: { errors: { token: ['is missing'] } } },
  })
  @NoStore()
  @SerializeOptions({ schema: userResponseSchema })
  async current(@CurrentUser() caller: Express.User): Promise<UserWithToken> {
    const user = await this.users.findById(caller.id);

    // The spec offers no way to delete an account, so this answers only a token
    // minted for a row that was then removed by hand.
    if (!user) {
      throw new UnauthorizedException({ errors: { token: ['is invalid'] } });
    }

    // The token the client presented rather than a new one: one sign-in means
    // one token, so revoking it later ends the whole session.
    return { ...user, token: caller.token };
  }
}
