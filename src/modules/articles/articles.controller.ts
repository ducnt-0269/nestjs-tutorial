import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  SerializeOptions,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import {
  fieldBody,
  forbiddenBody,
  notFoundBody,
} from '../../common/errors/api-error.js';
import {
  BLANK_MESSAGE,
  INVALID_MESSAGE,
} from '../../common/errors/messages.js';
import { Authenticated } from '../../common/decorators/authenticated.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import {
  type CreateArticleBody,
  articleResponseExample,
  articleResponseSchema,
  articlesResponseExample,
  articlesResponseSchema,
  createArticleSchema,
  type ListArticlesQuery,
  listArticlesQuerySchema,
  type UpdateArticleBody,
  updateArticleSchema,
} from './articles.schema.js';
import {
  type ArticleList,
  type ArticleWithAuthor,
  ArticlesService,
} from './articles.service.js';

const notFound = notFoundBody('article');
const forbidden = forbiddenBody('article');
const blankTitle = fieldBody('title', BLANK_MESSAGE);
const invalidLimit = fieldBody('limit', INVALID_MESSAGE);

// An article is public data, so reading one carries no guard and no no-store:
// the response holds nothing that belongs to the reader.
@ApiTags('articles')
@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Post()
  @Authenticated()
  @ApiOperation({ summary: 'Publish an article' })
  @ApiCreatedResponse({ schema: { example: articleResponseExample } })
  @ApiUnprocessableEntityResponse({ schema: { example: blankTitle } })
  @SerializeOptions({ schema: articleResponseSchema })
  create(
    @CurrentUser() caller: Express.User,
    @Body({ schema: createArticleSchema }) body: CreateArticleBody,
  ): Promise<ArticleWithAuthor> {
    return this.articlesService.create(caller.id, body.article);
  }

  @Get()
  @ApiOperation({ summary: 'List articles' })
  @ApiQuery({
    name: 'author',
    required: false,
    description: 'Filter on username',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    schema: { default: 20, maximum: 100 },
  })
  @ApiQuery({ name: 'offset', required: false, schema: { default: 0 } })
  @ApiOkResponse({ schema: { example: articlesResponseExample } })
  @ApiUnprocessableEntityResponse({ schema: { example: invalidLimit } })
  @SerializeOptions({ schema: articlesResponseSchema })
  index(
    @Query({ schema: listArticlesQuerySchema }) query: ListArticlesQuery,
  ): Promise<ArticleList> {
    return this.articlesService.list(query);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Read an article' })
  @ApiOkResponse({ schema: { example: articleResponseExample } })
  @ApiNotFoundResponse({ schema: { example: notFound } })
  @SerializeOptions({ schema: articleResponseSchema })
  show(@Param('slug') slug: string): Promise<ArticleWithAuthor> {
    return this.articlesService.articleFor(slug);
  }

  @Put(':slug')
  @Authenticated()
  @ApiOperation({ summary: 'Edit an article' })
  @ApiOkResponse({ schema: { example: articleResponseExample } })
  @ApiForbiddenResponse({ schema: { example: forbidden } })
  @ApiNotFoundResponse({ schema: { example: notFound } })
  @ApiUnprocessableEntityResponse({ schema: { example: blankTitle } })
  @SerializeOptions({ schema: articleResponseSchema })
  update(
    @CurrentUser() caller: Express.User,
    @Param('slug') slug: string,
    @Body({ schema: updateArticleSchema }) body: UpdateArticleBody,
  ): Promise<ArticleWithAuthor> {
    return this.articlesService.update(slug, caller.id, body.article);
  }

  @Delete(':slug')
  @Authenticated()
  @ApiOperation({ summary: 'Delete an article' })
  @ApiOkResponse({ schema: { example: {} } })
  @ApiForbiddenResponse({ schema: { example: forbidden } })
  @ApiNotFoundResponse({ schema: { example: notFound } })
  remove(
    @CurrentUser() caller: Express.User,
    @Param('slug') slug: string,
  ): Promise<void> {
    return this.articlesService.remove(slug, caller.id);
  }
}
