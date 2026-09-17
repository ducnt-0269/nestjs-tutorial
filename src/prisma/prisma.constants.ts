// Ceiling of a Postgres integer column, which is what a Prisma Int maps to.
// Every id, skip and take reaches the driver as a 32-bit value, and past this
// point it wraps in silence rather than failing.
export const INT4_MAX = 2_147_483_647;
