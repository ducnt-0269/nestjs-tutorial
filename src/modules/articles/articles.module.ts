import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { ArticlesController } from './articles.controller.js';
import { ArticlesService } from './articles.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [ArticlesController],
  providers: [ArticlesService],
  // Comments answer a missing article with the article's own 404, so they read
  // it through this service rather than querying the table a second time.
  exports: [ArticlesService],
})
export class ArticlesModule {}
