import { Injectable } from '@nestjs/common';
import type { User } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

type NewUser = Pick<User, 'email' | 'username' | 'password'>;
export type SafeUser = Omit<User, 'password'>;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * A duplicate email or username surfaces as Prisma P2002, which
   * ErrorsEnvelopeFilter turns into 409. Checking first would only add a
   * race between the check and the insert.
   */
  create(data: NewUser): Promise<SafeUser> {
    return this.prisma.user.create({ data });
  }
}
