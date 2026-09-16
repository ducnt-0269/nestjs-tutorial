import { describe, expect, it } from 'vitest';
import { hashPassword, passwordMatches } from './password.js';

describe('passwordMatches', () => {
  it('accepts the password behind the hash', async () => {
    const hashed = await hashPassword('secret123');

    expect(await passwordMatches('secret123', hashed)).toBe(true);
    expect(await passwordMatches('secret124', hashed)).toBe(false);
  });

  it('refuses everything when there is no hash to compare against', async () => {
    expect(await passwordMatches('secret123', null)).toBe(false);
  });

  // The dummy hash exists to equalise timing; a caller sending the phrase it
  // was built from must not be let in by it. No endpoint can reach this.
  it('refuses the phrase the stand-in hash was built from', async () => {
    expect(await passwordMatches('no account matches this hash', null)).toBe(
      false,
    );
  });
});
