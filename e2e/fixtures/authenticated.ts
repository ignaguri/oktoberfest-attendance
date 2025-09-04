import { test as base, expect } from "@playwright/test";

import { loginAsSeededUser } from "../helpers/auth";

export const test = base.extend<{}>({
  page: async ({ page }, run) => {
    await loginAsSeededUser(page);
    await run(page);
  },
});

export { expect };
