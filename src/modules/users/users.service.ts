import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { User } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

type NewUser = Pick<User, 'email' | 'username' | 'password'>;
export type SafeUser = Omit<User, 'password'>;
export type UserWithToken = SafeUser & { token: string };

@Injectable()
export class UsersService {
  constructor(private readonly prismaService: PrismaService) {}

  // Duplicates surface as P2002 → 409; a check-then-insert would only add a race.
  create(data: NewUser): Promise<SafeUser> {
    return this.prismaService.user.create({ data });
  }

  // Named for the signed-in caller so that answering with a 401 stays right: a
  // user missing in any other context is a 404, not a rejected token.
  async currentUser(id: number): Promise<SafeUser> {
    const user = await this.prismaService.user.findUnique({ where: { id } });

    // No endpoint deletes an account, so only a row removed by hand gets here.
    if (!user) {
      throw new UnauthorizedException({ errors: { token: ['is invalid'] } });
    }

    return user;
  }

  // The one query that opts back into the hash, so signing in can check it (§5).
  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.prismaService.user.findUnique({
      where: { email },
      omit: { password: false },
    });
  }
}
