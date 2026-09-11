import { Injectable } from '@nestjs/common';
import type { User } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

type NewUser = Pick<User, 'email' | 'username' | 'password'>;
export type SafeUser = Omit<User, 'password'>;
// Here rather than in auth: the account is this module's concept.
export type UserWithToken = SafeUser & { token: string };

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // Duplicates surface as P2002 → 409; a check-then-insert would only add a race.
  create(data: NewUser): Promise<SafeUser> {
    return this.prisma.user.create({ data });
  }

  findById(id: number): Promise<SafeUser | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  // The one query that opts back into the hash, so signing in can check it (§5).
  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
      omit: { password: false },
    });
  }
}
