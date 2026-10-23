/**
 * Shape of every identifier we accept in routes and bodies: Prisma cuids, uuids
 * and the readable ids used by the seed (`user-student-0001`). Anything with
 * slashes, dots or whitespace is rejected before it reaches a query.
 */
export const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
