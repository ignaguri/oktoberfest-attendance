/**
 * PostgreSQL error codes used for error handling in repositories.
 * @see https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
export const PgErrorCode = {
  /** Foreign key violation */
  FOREIGN_KEY_VIOLATION: "23503",
  /** Unique constraint violation */
  UNIQUE_VIOLATION: "23505",
  /** Raised by the SECURITY DEFINER guards in harden_security_definer_grants */
  INSUFFICIENT_PRIVILEGE: "42501",
  /** PostgREST: no rows returned by .single() */
  NO_ROWS: "PGRST116",
} as const;
