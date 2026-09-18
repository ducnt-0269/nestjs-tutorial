// The fields the service reads. Declared here because multer ships no types.
export interface UploadedImage {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}
