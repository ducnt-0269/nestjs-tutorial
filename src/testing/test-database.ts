// The suffix every database this project is willing to empty has to carry.
const TEST_DATABASE_SUFFIX = '_test';

/**
 * The one check standing between an end-to-end run and the development data. A
 * URL whose database name does not carry the test suffix stops the run here,
 * before a migration or an emptied table can reach the wrong server.
 *
 * Called twice: once by the global setup against the declared URL, and again by
 * the harness against the value the running application resolved, which is what
 * a stray dotenv file would have overridden.
 */
export function assertTestDatabase(url: string): void {
  const name = new URL(url).pathname.replace(/^\//, '');

  if (!name.endsWith(TEST_DATABASE_SUFFIX)) {
    throw new Error(
      `Refusing to run against a database named ${name}: the name must end in ${TEST_DATABASE_SUFFIX}`,
    );
  }
}
