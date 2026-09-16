import { Controller, Get, Param, SerializeOptions } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { SafeUser } from '../users/users.service.js';
import {
  profileResponseExample,
  profileResponseSchema,
} from './profiles.schema.js';
import { ProfilesService } from './profiles.service.js';

// Anyone may read a profile, so no guard and no no-store: the response holds
// nothing that belongs to the reader.
@ApiTags('profiles')
@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get(':username')
  @ApiOperation({ summary: 'Read a public profile' })
  @ApiOkResponse({ schema: { example: profileResponseExample } })
  @ApiNotFoundResponse({
    schema: { example: { errors: { profile: ['not found'] } } },
  })
  @SerializeOptions({ schema: profileResponseSchema })
  show(@Param('username') username: string): Promise<SafeUser> {
    return this.profilesService.byUsername(username);
  }
}
