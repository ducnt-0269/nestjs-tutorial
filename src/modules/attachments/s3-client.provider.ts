import { S3Client } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';

export function createS3Client(configService: ConfigService): S3Client {
  return new S3Client({
    endpoint: configService.getOrThrow<string>('S3_ENDPOINT'),
    region: configService.getOrThrow<string>('S3_REGION'),
    credentials: {
      accessKeyId: configService.getOrThrow<string>('S3_ACCESS_KEY'),
      secretAccessKey: configService.getOrThrow<string>('S3_SECRET_KEY'),
    },
    // A storage server reachable at one host has no wildcard DNS to serve
    // virtual-host addressing, and the hosted service accepts path style as
    // well, so this holds in both places rather than only in development.
    forcePathStyle: true,
  });
}
