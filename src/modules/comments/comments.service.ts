import { Injectable } from '@nestjs/common';

import { forbidden, notFound } from '../../common/errors/api-error.js';
// Imported by name rather than relied on: TypeScript ships a global Comment
// from the DOM library, and taking that one keeps the typecheck green while
// the type means something else entirely.
import type { Comment } from '../../generated/prisma/client.js';
import { isForeignKeyViolation } from '../../prisma/prisma-errors.js';
import { INT4_MAX } from '../../prisma/prisma.constants.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ArticlesService } from '../articles/articles.service.js';
import type { SafeUser } from '../users/users.service.js';

import type { CreateCommentInput } from './comments.schema.js';

export type CommentWithAuthor = Comment & { author: SafeUser };

@Injectable()
export class CommentsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly articlesService: ArticlesService,
  ) {}

  // The article is read through the articles module rather than queried here,
  // so the answer to a missing one is written in a single place and arrives
  // under the key that names what is actually missing.
  async create(
    slug: string,
    authorId: number,
    input: CreateCommentInput,
  ): Promise<CommentWithAuthor> {
    const article = await this.articlesService.articleFor(slug);

    try {
      // The author comes from the token, never from the body, so there is no
      // path that comments under someone else's name.
      return await this.prismaService.comment.create({
        data: { ...input, articleId: article.id, authorId },
        include: { author: true },
      });
    } catch (error) {
      // The article was read a moment earlier, so the only way its row can be
      // gone by now is a concurrent delete. Answering 404 gives that caller
      // what the slower of the two requests would have been told anyway, and
      // an article is the only row this write points at besides the caller,
      // whose account no route can remove.
      if (isForeignKeyViolation(error)) throw notFound('article');
      throw error;
    }
  }

  async commentsFor(slug: string): Promise<CommentWithAuthor[]> {
    const article = await this.articlesService.articleFor(slug);

    // An article nobody has commented on answers with an empty array, which is
    // what findMany returns without any branch being written for it.
    return this.prismaService.comment.findMany({
      where: { articleId: article.id },
      // Chronological, so the discussion reads top to bottom. Without it the
      // same request twice may answer in two different orders.
      orderBy: { createdAt: 'asc' },
      include: { author: true },
    });
  }

  // The order of the three checks is load-bearing: it decides which key the
  // caller is answered under when more than one thing is wrong.
  async remove(slug: string, id: string, callerId: number): Promise<void> {
    const article = await this.articlesService.articleFor(slug);
    // Matching on both columns folds "no such comment" and "a comment on some
    // other article" into one miss. Under this URL the second is the first.
    const comment = await this.prismaService.comment.findFirst({
      where: { id: commentIdFrom(id), articleId: article.id },
    });

    if (!comment) {
      throw notFound('comment');
    }

    // Missing is answered before forbidden, the same way an article does it:
    // a comment is public, so there is nothing about its existence to hide.
    if (comment.authorId !== callerId) {
      throw forbidden('comment');
    }

    // The many-row form answers with a count where the single-row one throws.
    // A concurrent delete that arrived first leaves a count of zero, and the
    // comment being gone is what this request asked for, so nothing reads it.
    await this.prismaService.comment.deleteMany({ where: { id: comment.id } });
  }
}

// A path segment is text; the column is a 32-bit integer. Anything outside
// that range names a comment nobody could have created, which is the same
// answer a deleted one gets. Narrow enough to carry the 404 it throws.
function commentIdFrom(id: string): number {
  // A plain run of digits, not everything Number accepts: 0x10 and 1e3 would
  // otherwise silently address rows 16 and 1000.
  if (!/^\d+$/.test(id)) {
    throw notFound('comment');
  }

  const parsed = Number(id);

  if (parsed < 1 || parsed > INT4_MAX) {
    throw notFound('comment');
  }

  return parsed;
}
