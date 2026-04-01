/**
 * PostgreSQL error codes used for error handling in repositories.
 * @see https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
export const PgErrorCode = {
  /** Foreign key violation */
  FOREIGN_KEY_VIOLATION: "23503",
  /** Unique constraint violation */
  UNIQUE_VIOLATION: "23505",
} as const;
