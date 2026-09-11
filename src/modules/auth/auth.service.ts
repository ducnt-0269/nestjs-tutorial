import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash, hashSync } from 'bcrypt';
import { type UserWithToken, UsersService } from '../users/users.service.js';
import type { LoginInput, RegisterInput } from './auth.schema.js';

// bcrypt's default; about 65 ms per hash on current hardware.
const SALT_ROUNDS = 10;

// Compared against when no account matches the email, so that a wrong email
// and a wrong password take the same time to answer.
const NO_ACCOUNT_HASH = hashSync('no account matches this hash', SALT_ROUNDS);

const INVALID_CREDENTIALS = { errors: { credentials: ['invalid'] } };

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async register(input: RegisterInput): Promise<UserWithToken> {
    const password = await hash(input.password, SALT_ROUNDS);
    const user = await this.users.create({ ...input, password });
    return { ...user, token: this.tokenFor(user.id) };
  }

  async login(input: LoginInput): Promise<UserWithToken> {
    const account = await this.users.findByEmailWithPassword(input.email);
    const matches = await compare(
      input.password,
      account?.password ?? NO_ACCOUNT_HASH,
    );

    if (!account || !matches) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    // The hash stops here rather than travelling on to the serializer.
    const { password: _password, ...user } = account;
    return { ...user, token: this.tokenFor(user.id) };
  }

  // Id only, nothing that PUT /user could make stale. `sub` is a string (RFC 7519).
  private tokenFor(userId: number): string {
    return this.jwt.sign({ sub: String(userId) });
  }
}
