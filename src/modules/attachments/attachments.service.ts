import { randomUUID } from 'node:crypto';

import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { fieldBody } from '../../common/errors/api-error.js';
import {
  BLANK_MESSAGE,
  INVALID_MESSAGE,
} from '../../common/errors/messages.js';
import {
  AttachmentOwner,
  AttachmentVisibility,
  type Prisma,
} from '../../generated/prisma/client.js';

import { S3_CLIENT } from './attachments.constants.js';
import { type ImageType, imageTypeOf } from './image-type.js';
import type { UploadedImage } from './uploaded-image.js';

interface AttachmentOwnerRef {
  ownerType: AttachmentOwner;
  ownerId: number;
}

interface StoredObject {
  key: string;
  url: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}

const OWNER_PREFIX: Record<AttachmentOwner, string> = {
  [AttachmentOwner.User]: 'users',
};

// The link to an owner carries no foreign key, so nothing here resolves to a
// row in another table, and nothing here knows what an owner does with its file.
@Injectable()
export class AttachmentsService {
  private readonly bucket: string;
  private readonly endpoint: string;

  constructor(
    configService: ConfigService,
    @Inject(S3_CLIENT) private readonly client: S3Client,
  ) {
    this.bucket = configService.getOrThrow<string>('S3_BUCKET');
    this.endpoint = configService.getOrThrow<string>('S3_ENDPOINT');
  }

  // Both rejections happen before the first call to storage, which is what
  // keeps a refused upload from leaving an object behind. The field name comes
  // from the caller because the error body keys on it.
  async putObject(
    owner: AttachmentOwnerRef,
    field: string,
    file?: UploadedImage,
  ): Promise<StoredObject> {
    if (!file) {
      throw new UnprocessableEntityException(fieldBody(field, BLANK_MESSAGE));
    }

    const imageType = imageTypeOf(file.buffer);
    if (!imageType) {
      throw new UnprocessableEntityException(fieldBody(field, INVALID_MESSAGE));
    }

    const key = this.keyFor(owner, imageType);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: imageType.mimeType,
      }),
    );

    return {
      key,
      url: this.publicUrlFor(key),
      fileName: file.originalname,
      fileType: imageType.mimeType,
      fileSize: file.size,
    };
  }

  async removeObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  // One owner holds one attachment, so whatever it holds goes first.
  async replaceFor(
    tx: Prisma.TransactionClient,
    owner: AttachmentOwnerRef,
    object: StoredObject,
  ): Promise<string[]> {
    const stale = await this.deleteFor(tx, owner);

    await tx.attachment.create({
      data: {
        ...owner,
        visibility: AttachmentVisibility.public,
        objectKey: object.key,
        fileName: object.fileName,
        fileType: object.fileType,
        fileSize: object.fileSize,
      },
    });

    return stale;
  }

  // Every attachment the owner holds goes, and the object keys come back for
  // the caller to clear once the transaction has committed: an object removed
  // any earlier would be gone even if the commit never happened.
  async deleteFor(
    tx: Prisma.TransactionClient,
    owner: AttachmentOwnerRef,
  ): Promise<string[]> {
    const held = await tx.attachment.findMany({
      where: owner,
      select: { objectKey: true },
    });

    await tx.attachment.deleteMany({ where: owner });

    return held.map((row) => row.objectKey);
  }

  private publicUrlFor(key: string): string {
    return `${this.endpoint}/${this.bucket}/${key}`;
  }

  // Named from a random identifier, never from the name the client sent: that
  // one invites both path traversal and collisions.
  private keyFor(owner: AttachmentOwnerRef, type: ImageType): string {
    const prefix = OWNER_PREFIX[owner.ownerType];
    return `${prefix}/${owner.ownerId}/${randomUUID()}.${type.extension}`;
  }
}
