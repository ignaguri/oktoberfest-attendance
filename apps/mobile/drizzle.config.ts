import type { Config } from "drizzle-kit";

export default {
  schema: "./lib/database/schema",
  out: "./drizzle",
  dialect: "sqlite",
} satisfies Config;
