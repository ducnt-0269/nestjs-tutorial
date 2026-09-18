import { Injectable, Logger } from '@nestjs/common';

import { invalidToken, notFound } from '../../common/errors/api-error.js';
import {
  AttachmentOwner,
  Prisma,
  type User,
} from '../../generated/prisma/client.js';
import { isRowGone } from '../../prisma/prisma-errors.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AttachmentsService } from '../attachments/attachments.service.js';
import type { UploadedImage } from '../attachments/uploaded-image.js';

import { hashPassword, passwordMatches } from './password.js';
import type { UpdateUserInput } from './users.schema.js';

type NewUser = Pick<User, 'email' | 'username' | 'password'>;
export type SafeUser = Omit<User, 'password'>;
export type UserWithToken = SafeUser & { token: string };

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly attachmentsService: AttachmentsService,
  ) {}

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

  // Which file is the avatar, and that the account carries a column for it, are
  // decisions this module owns; the storage module is told neither. The upload
  // runs before the transaction opens, so no transaction is held open across it.
  async setAvatar(
    userId: number,
    field: string,
    file?: UploadedImage,
  ): Promise<SafeUser> {
    const owner = { ownerType: AttachmentOwner.User, ownerId: userId };
    const stored = await this.attachmentsService.putObject(owner, field, file);

    try {
      const { user, stale } = await this.prismaService.$transaction(
        async (tx) => {
          // First, for two reasons. It locks the account row, so a second
          // upload by the same user waits here instead of inserting a rival
          // attachment that neither transaction can see. And it is the check
          // that the account still exists, which now fails before any file
          // record is written.
          const user = await tx.user.update({
            where: { id: userId },
            data: { image: stored.url },
          });
          const stale = await this.attachmentsService.replaceFor(
            tx,
            owner,
            stored,
          );

          return { user, stale };
        },
      );

      await this.clearStale(stale);
      return user;
    } catch (error) {
      // The account keeps its previous value: the write to it rolled back.
      await this.attachmentsService
        .removeObject(stored.key)
        .catch((failure: unknown) => {
          this.logger.error(
            `Removing the stored object after a failed upload left it behind: ${String(failure)}`,
          );
        });

      // The account disappeared between the guard accepting the token and the
      // commit, which is what a token naming no account already answers.
      if (isRowGone(error)) throw invalidToken();
      throw error;
    }
  }

  // The account holds one avatar, so the caller needs no identifier to name it:
  // the token already says which account, and that is this module's knowledge.
  async removeAvatar(userId: number): Promise<void> {
    const owner = { ownerType: AttachmentOwner.User, ownerId: userId };

    const removed = await this.prismaService.$transaction(async (tx) => {
      const removed = await this.attachmentsService.deleteFor(tx, owner);

      // Nothing held, nothing to answer with. Thrown inside the transaction so
      // the column below is left alone.
      if (removed.length === 0) {
        throw notFound('attachment');
      }

      // The column goes with the file. A response that left it pointing at a
      // removed object would be this request's own half-applied state, which is
      // not the same as a client having put an arbitrary URL there itself.
      await tx.user.update({ where: { id: userId }, data: { image: null } });

      return removed;
    });

    await this.clearStale(removed);
  }

  // A failure here leaves an unreferenced object without making the committed
  // state wrong, so it is logged and nothing else.
  private async clearStale(keys: string[]): Promise<void> {
    const results = await Promise.allSettled(
      keys.map((key) => this.attachmentsService.removeObject(key)),
    );

    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.error(
          `Removing a replaced stored object failed: ${String(result.reason)}`,
        );
      }
    }
  }

  // Named for the signed-in caller so that answering with a 401 stays right: a
  // user missing in any other context is a 404, not a rejected token.
  async currentUser(id: number): Promise<SafeUser> {
    const user = await this.prismaService.user.findUnique({ where: { id } });

    // No endpoint deletes an account, so only a row removed by hand gets here.
    if (!user) {
      throw invalidToken();
    }

    return user;
  }

  // Plain query: the caller decides whether nothing found is a 404, a 401 or
  // an empty result.
  findByUsername(username: string): Promise<SafeUser | null> {
    return this.prismaService.user.findUnique({ where: { username } });
  }

  // An email is all a password reset is given to go on, and finding the
  // account by it belongs to the module that owns the column.
  findByEmail(email: string): Promise<SafeUser | null> {
    return this.prismaService.user.findUnique({ where: { email } });
  }

  // Takes the transaction rather than opening one, so this write and whatever
  // authorised it commit together or not at all. Hashing stays on this side of
  // the boundary for the reason it does on every other write: no caller is
  // handed the opportunity to store a plaintext password. The cost is that the
  // transaction stays open for as long as bcrypt takes, which is the price of
  // not letting a hash cross the boundary instead. No P2025 branch: the row
  // this transaction already holds is the one a concurrent delete would have
  // to take, so it waits rather than leaving this update nothing to act on.
  async setPassword(
    tx: Prisma.TransactionClient,
    id: number,
    password: string,
  ): Promise<void> {
    await tx.user.update({
      where: { id },
      data: { password: await hashPassword(password) },
    });
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
