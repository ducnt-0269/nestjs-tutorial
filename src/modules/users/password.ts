import { compare, hash, hashSync } from 'bcrypt';

// bcrypt's default; about 65 ms per hash on current hardware.
const SALT_ROUNDS = 10;

// Compared against when no account matches the email, so that a wrong email
// and a wrong password take the same time to answer.
const NO_ACCOUNT_HASH = hashSync('no account matches this hash', SALT_ROUNDS);

export function hashPassword(password: string): Promise<string> {
  return hash(password, SALT_ROUNDS);
}

/**
 * A null hash still runs a comparison, so the absence of an account cannot be
 * read off the response time. The null check comes after it rather than
 * short-circuiting, and it also stops the dummy phrase from ever matching.
 */
export async function passwordMatches(
  password: string,
  hashed: string | null,
): Promise<boolean> {
  const matches = await compare(password, hashed ?? NO_ACCOUNT_HASH);
  return hashed !== null && matches;
}
