import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { User } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { hashPassword, passwordMatches } from './password.js';
import type { UpdateUserInput } from './users.schema.js';

type NewUser = Pick<User, 'email' | 'username' | 'password'>;
export type SafeUser = Omit<User, 'password'>;
export type UserWithToken = SafeUser & { token: string };

@Injectable()
export class UsersService {
  constructor(private readonly prismaService: PrismaService) {}

  // Hashing sits on the write rather than at the caller, so no path can store
  // a plaintext password. Duplicates surface as P2002 → 409; a check-then-insert
  // would only add a race.
  async create(data: NewUser): Promise<SafeUser> {
    return this.prismaService.user.create({
      data: { ...data, password: await hashPassword(data.password) },
    });
  }

  // The spread order is load-bearing: the hashed value has to land after the
  // raw input, or the plaintext password would overwrite it.
  async updateCurrentUser(
    id: number,
    input: UpdateUserInput,
  ): Promise<SafeUser> {
    const password = input.password
      ? await hashPassword(input.password)
      : undefined;

    return this.prismaService.user.update({
      where: { id },
      data: { ...input, password },
    });
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

  // Plain query: the caller decides whether nothing found is a 404, a 401 or
  // an empty result.
  findByUsername(username: string): Promise<SafeUser | null> {
    return this.prismaService.user.findUnique({ where: { username } });
  }

  // The one query that opts back into the hash (§5). It compares here as well,
  // so the hash never crosses the module boundary; the caller gets an account
  // or nothing and decides what to answer.
  async findByCredentials(
    email: string,
    password: string,
  ): Promise<SafeUser | null> {
    const account = await this.prismaService.user.findUnique({
      where: { email },
      omit: { password: false },
    });
    const matches = await passwordMatches(password, account?.password ?? null);

    if (!account || !matches) {
      return null;
    }

    const { password: _password, ...user } = account;
    return user;
  }
}
