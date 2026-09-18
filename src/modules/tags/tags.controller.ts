import { Controller, Get, SerializeOptions } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { tagsResponseExample, tagsResponseSchema } from './tags.schema.js';
import { TagsService } from './tags.service.js';

// The tags in use are public data: no guard, and nothing here belongs to the
// reader, so no no-store either.
@ApiTags('tags')
@Controller('tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get()
  @ApiOperation({ summary: 'List the tags in use' })
  @ApiOkResponse({ schema: { example: tagsResponseExample } })
  @SerializeOptions({ schema: tagsResponseSchema })
  index(): Promise<{ tags: string[] }> {
    return this.tagsService.list();
  }
}
