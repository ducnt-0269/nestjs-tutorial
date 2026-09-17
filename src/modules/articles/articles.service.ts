import { Injectable } from '@nestjs/common';
import { forbidden, notFound } from '../../common/errors/api-error.js';
import { type Article, Prisma } from '../../generated/prisma/client.js';
import { isRowGone, isUniqueViolation } from '../../prisma/prisma-errors.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { SafeUser } from '../users/users.service.js';
import type {
  CreateArticleInput,
  UpdateArticleInput,
} from './articles.schema.js';
import { slugFor } from './slug.js';

export type ArticleWithAuthor = Article & { author: SafeUser };

@Injectable()
export class ArticlesService {
  constructor(private readonly prismaService: PrismaService) {}

  // The author comes from the token, never from the body, so there is no path
  // that publishes under someone else's name.
  create(
    authorId: number,
    input: CreateArticleInput,
  ): Promise<ArticleWithAuthor> {
    return this.withFreshSlug(input.title, (slug) =>
      this.prismaService.article.create({
        data: { ...input, slug, authorId },
        include: { author: true },
      }),
    );
  }

  // Named for the context that decides the 404, the way the profile lookup is:
  // an article missing elsewhere may well deserve a different answer.
  async articleFor(slug: string): Promise<ArticleWithAuthor> {
    const article = await this.prismaService.article.findUnique({
      where: { slug },
      include: { author: true },
    });

    if (!article) {
      throw notFound('article');
    }

    return article;
  }

  async update(
    slug: string,
    callerId: number,
    input: UpdateArticleInput,
  ): Promise<ArticleWithAuthor> {
    const article = await this.articleOwnedBy(slug, callerId);
    const write = (data: Prisma.ArticleUpdateInput) =>
      this.prismaService.article.update({
        // By id, not by slug: the row is already in hand, and the slug is the
        // very thing this statement may be changing.
        where: { id: article.id },
        data,
        include: { author: true },
      });

    try {
      // A title in the body is what moves the slug. Leaving the key out
      // entirely is how the column is told to stay as it is.
      return await (input.title
        ? this.withFreshSlug(input.title, (fresh) =>
            write({ ...input, slug: fresh }),
          )
        : write(input));
    } catch (error) {
      // The row was read a moment earlier, so the only way it can be gone by
      // now is a concurrent delete. Answering 404 gives that caller what the
      // slower of the two requests would have been told anyway.
      if (isRowGone(error)) throw notFound('article');
      throw error;
    }
  }

  async remove(slug: string, callerId: number): Promise<void> {
    const article = await this.articleOwnedBy(slug, callerId);
    // The many-row form answers with a count where the single-row one throws.
    // A concurrent delete that arrived first leaves a count of zero, and the
    // article being gone is what this request asked for, so nothing reads it.
    await this.prismaService.article.deleteMany({ where: { id: article.id } });
  }

  // One retry, because the slug ends in random bytes: a repeat is a
  // coincidence rather than a conflict the caller could resolve, and the very
  // same request sent again would succeed. Answering 409 would name a column
  // the body never carried.
  private async withFreshSlug<T>(
    title: string,
    write: (slug: string) => Promise<T>,
  ): Promise<T> {
    try {
      return await write(slugFor(title));
    } catch (error) {
      // The table carries one unique index, so a duplicate is always the slug.
      if (!isUniqueViolation(error)) throw error;
      return write(slugFor(title));
    }
  }

  // Missing is answered before forbidden: an article is public data, so there
  // is nothing about its existence worth hiding from a caller who cannot edit
  // it. The name is narrow enough to carry the 403 it throws.
  private async articleOwnedBy(
    slug: string,
    callerId: number,
  ): Promise<ArticleWithAuthor> {
    const article = await this.articleFor(slug);

    if (article.authorId !== callerId) {
      throw forbidden('article');
    }

    return article;
  }
}
