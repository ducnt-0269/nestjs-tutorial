import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  SerializeOptions,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import {
  fieldBody,
  forbiddenBody,
  invalidTokenBody,
  notFoundBody,
} from '../../common/errors/api-error.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import {
  JwtAuthGuard,
  TOKEN_SCHEME,
} from '../../common/guards/jwt-auth.guard.js';
import {
  type CreateArticleBody,
  articleResponseExample,
  articleResponseSchema,
  createArticleSchema,
  type UpdateArticleBody,
  updateArticleSchema,
} from './articles.schema.js';
import { type ArticleWithAuthor, ArticlesService } from './articles.service.js';

const notFound = notFoundBody('article');
const forbidden = forbiddenBody('article');
const blankTitle = fieldBody('title', "can't be blank");

// An article is public data, so reading one carries no guard and no no-store:
// the response holds nothing that belongs to the reader.
@ApiTags('articles')
@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Publish an article' })
  @ApiSecurity(TOKEN_SCHEME)
  @ApiCreatedResponse({ schema: { example: articleResponseExample } })
  @ApiUnauthorizedResponse({ schema: { example: invalidTokenBody } })
  @ApiUnprocessableEntityResponse({ schema: { example: blankTitle } })
  @SerializeOptions({ schema: articleResponseSchema })
  create(
    @CurrentUser() caller: Express.User,
    @Body({ schema: createArticleSchema }) body: CreateArticleBody,
  ): Promise<ArticleWithAuthor> {
    return this.articlesService.create(caller.id, body.article);
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
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Edit an article' })
  @ApiSecurity(TOKEN_SCHEME)
  @ApiOkResponse({ schema: { example: articleResponseExample } })
  @ApiUnauthorizedResponse({ schema: { example: invalidTokenBody } })
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
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Delete an article' })
  @ApiSecurity(TOKEN_SCHEME)
  @ApiOkResponse({ schema: { example: {} } })
  @ApiUnauthorizedResponse({ schema: { example: invalidTokenBody } })
  @ApiForbiddenResponse({ schema: { example: forbidden } })
  @ApiNotFoundResponse({ schema: { example: notFound } })
  remove(
    @CurrentUser() caller: Express.User,
    @Param('slug') slug: string,
  ): Promise<void> {
    return this.articlesService.remove(slug, caller.id);
  }
}
