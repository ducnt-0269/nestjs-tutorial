import { createHash, randomBytes } from 'node:crypto';

// 256 bits, encoded url-safe so the value survives being placed in a link.
const TOKEN_BYTES = 32;

export const generateResetToken = (): string =>
  randomBytes(TOKEN_BYTES).toString('base64url');

// Only this digest is stored, the same way a revoked sign-in token is
// recorded. A password hash would buy nothing here: the input is 256 bits of
// randomness rather than something a person chose, so there is no smaller set
// of likely values for anyone to work through.
export const digestResetToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');
