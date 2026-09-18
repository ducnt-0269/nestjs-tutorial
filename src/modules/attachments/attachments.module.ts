import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { S3_CLIENT } from './attachments.constants.js';
import { AttachmentsService } from './attachments.service.js';
import { createS3Client } from './s3-client.provider.js';

@Module({
  providers: [
    {
      provide: S3_CLIENT,
      useFactory: createS3Client,
      inject: [ConfigService],
    },
    AttachmentsService,
  ],
  exports: [AttachmentsService],
})
export class AttachmentsModule {}
