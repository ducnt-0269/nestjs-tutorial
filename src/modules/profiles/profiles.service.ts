import { Injectable, NotFoundException } from '@nestjs/common';
import type { SafeUser } from '../users/users.service.js';
import { UsersService } from '../users/users.service.js';

@Injectable()
export class ProfilesService {
  constructor(private readonly usersService: UsersService) {}

  // The 404 is decided here rather than in users: reading an account that is
  // not there is only a missing profile in this context, and a plain query
  // keeps the users module free to answer differently elsewhere.
  async byUsername(username: string): Promise<SafeUser> {
    const user = await this.usersService.findByUsername(username);

    if (!user) {
      throw new NotFoundException({ errors: { profile: ['not found'] } });
    }

    return user;
  }
}
