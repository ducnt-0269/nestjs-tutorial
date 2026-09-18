export interface ImageType {
  mimeType: string;
  extension: string;
}

// JPEG is recognised by three leading bytes and PNG by four. WebP needs twelve:
// it opens with a container tag, then a four byte length, and only then the tag
// naming the format.
const JPEG = [0xff, 0xd8, 0xff];
const PNG = [0x89, 0x50, 0x4e, 0x47];
const RIFF = [0x52, 0x49, 0x46, 0x46];
const WEBP = [0x57, 0x45, 0x42, 0x50];
const WEBP_OFFSET = 8;

// Checks the length first: a buffer shorter than the signature would otherwise
// compare against undefined and read as a match for an empty tail.
function startsWith(bytes: Buffer, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

// Read from the leading bytes, not from the content type the client declared: a
// client picks that header freely, so an allowed-type list built on it records
// only what the client claimed.
export function imageTypeOf(bytes: Buffer): ImageType | null {
  if (startsWith(bytes, JPEG)) {
    return { mimeType: 'image/jpeg', extension: 'jpg' };
  }
  if (startsWith(bytes, PNG)) {
    return { mimeType: 'image/png', extension: 'png' };
  }
  if (startsWith(bytes, RIFF) && startsWith(bytes, WEBP, WEBP_OFFSET)) {
    return { mimeType: 'image/webp', extension: 'webp' };
  }
  return null;
}
