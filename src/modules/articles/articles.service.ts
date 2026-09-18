import { Injectable } from '@nestjs/common';

import { forbidden, notFound } from '../../common/errors/api-error.js';
import { type Article, Prisma } from '../../generated/prisma/client.js';
import { isRowGone, isUniqueViolation } from '../../prisma/prisma-errors.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { TagsService } from '../tags/tags.service.js';
import type { SafeUser } from '../users/users.service.js';

import type {
  CreateArticleInput,
  ListArticlesQuery,
  UpdateArticleInput,
} from './articles.schema.js';
import { slugFor } from './slug.js';

export type ArticleWithAuthor = Article & {
  author: SafeUser;
  tagList: string[];
};
type ArticleListItem = Omit<ArticleWithAuthor, 'body'>;

// Every read of an article carries its tags, so tagList is in the response
// whichever endpoint answered.
const withAuthorAndTags = {
  author: true,
  tags: { include: { tag: true } },
} satisfies Prisma.ArticleInclude;

// Sorted, because the order a join hands rows back in is not defined: a
// response that reshuffles between two identical requests makes a test lie.
const withTagList = <Row extends { tags: { tag: { name: string } }[] }>(
  row: Row,
): Omit<Row, 'tags'> & { tagList: string[] } => {
  const { tags, ...article } = row;

  return { ...article, tagList: tags.map(({ tag }) => tag.name).sort() };
};

export type ArticleList = {
  articles: ArticleListItem[];
  articlesCount: number;
};

@Injectable()
export class ArticlesService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly tagsService: TagsService,
  ) {}

  // The author comes from the token, never from the body, so there is no path
  // that publishes under someone else's name.
  async create(
    authorId: number,
    input: CreateArticleInput,
  ): Promise<ArticleWithAuthor> {
    const { tagList, ...article } = input;
    // The tag rows are settled before the article is written, so a duplicate
    // tag name cannot surface inside the slug retry below and be read there as
    // a slug collision.
    const tagIds = await this.tagsService.ensureIds(tagList);

    return withTagList(
      await this.withFreshSlug(article.title, (slug) =>
        this.prismaService.article.create({
          data: {
            ...article,
            slug,
            authorId,
            tags: { create: tagIds.map((tagId) => ({ tagId })) },
          },
          include: withAuthorAndTags,
        }),
      ),
    );
  }

  // Two statements whatever the page size, plus one for the authors of the page.
  // Side by side rather than in a transaction, which under the default isolation
  // would hand them two snapshots anyway.
  async list(query: ListArticlesQuery): Promise<ArticleList> {
    // Prisma reads the keys of one where as an AND, so two filters narrow the
    // page rather than widening it.
    const where: Prisma.ArticleWhereInput = {
      ...(query.author ? { author: { username: query.author } } : {}),
      ...(query.tag ? { tags: { some: { tag: { name: query.tag } } } } : {}),
    };

    const [articles, articlesCount] = await Promise.all([
      this.prismaService.article.findMany({
        where,
        // The largest column, and no field in the list response holds it.
        omit: { body: true },
        include: withAuthorAndTags,
        // The id breaks ties: two articles published in the same millisecond
        // would otherwise swap places between pages, losing or repeating a row.
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: query.limit,
        skip: query.offset,
      }),
      this.prismaService.article.count({ where }),
    ]);

    return { articles: articles.map(withTagList), articlesCount };
  }

  // Named for the context that decides the 404, the way the profile lookup is:
  // an article missing elsewhere may well deserve a different answer.
  async articleFor(slug: string): Promise<ArticleWithAuthor> {
    const article = await this.prismaService.article.findUnique({
      where: { slug },
      include: withAuthorAndTags,
    });

    if (!article) {
      throw notFound('article');
    }

    return withTagList(article);
  }

  async update(
    slug: string,
    callerId: number,
    input: UpdateArticleInput,
  ): Promise<ArticleWithAuthor> {
    const article = await this.articleOwnedBy(slug, callerId);
    const write = async (data: Prisma.ArticleUpdateInput) =>
      withTagList(
        await this.prismaService.article.update({
          // By id, not by slug: the row is already in hand, and the slug is
          // the very thing this statement may be changing.
          where: { id: article.id },
          data,
          include: withAuthorAndTags,
        }),
      );

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
