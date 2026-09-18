import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  SerializeOptions,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';

import { Authenticated } from '../../common/decorators/authenticated.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import {
  fieldBody,
  forbiddenBody,
  notFoundBody,
} from '../../common/errors/api-error.js';
import { BLANK_MESSAGE } from '../../common/errors/messages.js';

import {
  type CreateCommentBody,
  commentResponseExample,
  commentResponseSchema,
  commentsResponseExample,
  commentsResponseSchema,
  createCommentSchema,
} from './comments.schema.js';
import { type CommentWithAuthor, CommentsService } from './comments.service.js';

const articleNotFound = notFoundBody('article');
const commentNotFound = notFoundBody('comment');
const commentForbidden = forbiddenBody('comment');
const blankBody = fieldBody('body', BLANK_MESSAGE);

// Comments hang off an article, so the path does too. A nested route does not
// make this a nested module: the slug arrives as a parameter like any other.
@ApiTags('comments')
@Controller('articles/:slug/comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  @Authenticated()
  @ApiOperation({ summary: 'Comment on an article' })
  @ApiCreatedResponse({ schema: { example: commentResponseExample } })
  @ApiNotFoundResponse({ schema: { example: articleNotFound } })
  @ApiUnprocessableEntityResponse({ schema: { example: blankBody } })
  @SerializeOptions({ schema: commentResponseSchema })
  create(
    @CurrentUser() caller: Express.User,
    @Param('slug') slug: string,
    @Body({ schema: createCommentSchema }) body: CreateCommentBody,
  ): Promise<CommentWithAuthor> {
    return this.commentsService.create(slug, caller.id, body.comment);
  }

  // Comments are public data, so reading them carries no guard: the response
  // holds nothing that belongs to the reader.
  @Get()
  @ApiOperation({ summary: 'Read the comments on an article' })
  @ApiOkResponse({ schema: { example: commentsResponseExample } })
  @ApiNotFoundResponse({ schema: { example: articleNotFound } })
  @SerializeOptions({ schema: commentsResponseSchema })
  async index(
    @Param('slug') slug: string,
  ): Promise<{ comments: CommentWithAuthor[] }> {
    return { comments: await this.commentsService.commentsFor(slug) };
  }

  @Delete(':id')
  @Authenticated()
  @ApiOperation({ summary: 'Delete a comment' })
  @ApiOkResponse({ schema: { example: {} } })
  @ApiForbiddenResponse({ schema: { example: commentForbidden } })
  @ApiNotFoundResponse({ schema: { example: commentNotFound } })
  remove(
    @CurrentUser() caller: Express.User,
    @Param('slug') slug: string,
    @Param('id') id: string,
  ): Promise<void> {
    return this.commentsService.remove(slug, id, caller.id);
  }
}
