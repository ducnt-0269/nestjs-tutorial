import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module.js';

import { TagsController } from './tags.controller.js';
import { TagsService } from './tags.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [TagsController],
  providers: [TagsService],
  // Articles settle their tag names through this service rather than reaching
  // into the table themselves.
  exports: [TagsService],
})
export class TagsModule {}
