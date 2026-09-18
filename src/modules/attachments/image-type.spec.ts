import { describe, expect, it } from 'vitest';

import { imageTypeOf } from './image-type.js';

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const webp = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);

describe('imageTypeOf', () => {
  it('reads JPEG, PNG and WebP from their leading bytes', () => {
    expect(imageTypeOf(jpeg)).toEqual({
      mimeType: 'image/jpeg',
      extension: 'jpg',
    });
    expect(imageTypeOf(png)).toEqual({
      mimeType: 'image/png',
      extension: 'png',
    });
    expect(imageTypeOf(webp)).toEqual({
      mimeType: 'image/webp',
      extension: 'webp',
    });
  });

  it('rejects a GIF, which this milestone leaves out', () => {
    const gif = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);

    expect(imageTypeOf(gif)).toBeNull();
  });

  it('rejects text carrying no image signature', () => {
    expect(imageTypeOf(Buffer.from('not an image at all', 'utf8'))).toBeNull();
  });

  // A refused type has to answer 422, so reading past the end of a short
  // buffer would turn a rejection into a server error.
  it('rejects a buffer too short to carry a signature', () => {
    expect(imageTypeOf(Buffer.alloc(0))).toBeNull();
    expect(imageTypeOf(Buffer.from([0xff, 0xd8]))).toBeNull();
    expect(imageTypeOf(Buffer.from([0x89, 0x50, 0x4e]))).toBeNull();
  });

  // The container tag alone is shared with other formats, so the tag naming
  // the format has to be there too.
  it('rejects a container whose format tag is absent or wrong', () => {
    expect(imageTypeOf(Buffer.from([0x52, 0x49, 0x46, 0x46]))).toBeNull();

    const wave = Buffer.from([
      0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45,
    ]);
    expect(imageTypeOf(wave)).toBeNull();
  });
});
