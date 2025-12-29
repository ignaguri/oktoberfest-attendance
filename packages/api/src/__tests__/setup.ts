import { beforeAll, afterAll } from "vitest";

beforeAll(() => {
  // Global test setup
  process.env.NODE_ENV = "test";
});

afterAll(() => {
  // Cleanup
});
