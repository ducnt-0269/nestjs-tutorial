import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash } from 'bcrypt';
import { type SafeUser, UsersService } from '../users/users.service.js';
import type { RegisterInput } from './auth.schema.js';

// bcrypt's default; about 65 ms per hash on current hardware.
const SALT_ROUNDS = 10;

export type AuthenticatedUser = SafeUser & { token: string };

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async register(input: RegisterInput): Promise<AuthenticatedUser> {
    const password = await hash(input.password, SALT_ROUNDS);
    const user = await this.users.create({ ...input, password });
    return { ...user, token: this.tokenFor(user.id) };
  }

  /**
   * The payload carries the id and nothing else: anything more would go
   * stale the moment PUT /user changes it. `sub` is a string by RFC 7519.
   */
  private tokenFor(userId: number): string {
    return this.jwt.sign({ sub: String(userId) });
  }
}
