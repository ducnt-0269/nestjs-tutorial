import { Injectable } from '@nestjs/common';

import { notFound } from '../../common/errors/api-error.js';
import type { SafeUser } from '../users/users.service.js';
import { UsersService } from '../users/users.service.js';

@Injectable()
export class ProfilesService {
  constructor(private readonly usersService: UsersService) {}

  // The 404 is decided here rather than in users: reading an account that is
  // not there is only a missing profile in this context, and a plain query
  // keeps the users module free to answer differently elsewhere.
  async profileFor(username: string): Promise<SafeUser> {
    const user = await this.usersService.findByUsername(username);

    if (!user) {
      throw notFound('profile');
    }

    return user;
  }
}
