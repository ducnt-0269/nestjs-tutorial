import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module.js';
import { AttachmentsModule } from '../attachments/attachments.module.js';

import { UserController } from './user.controller.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [PrismaModule, AttachmentsModule],
  controllers: [UserController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
