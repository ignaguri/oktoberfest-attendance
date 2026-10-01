import { describe, expect, it } from "vitest";

import { CreateAdminFestivalSchema } from "./admin.schema";

const VALID = {
  name: "Oktoberfest 2027",
  short_name: "oktoberfest-2027",
  festival_type: "oktoberfest",
  location: "Munich",
  start_date: "2027-09-18",
  end_date: "2027-10-03",
  status: "upcoming",
} as const;

describe("CreateAdminFestivalSchema", () => {
  it.each(["name", "short_name", "location"] as const)(
    "rejects a whitespace-only %s instead of sending it empty",
    (field) => {
      const result = CreateAdminFestivalSchema.safeParse({ ...VALID, [field]: "   " });

      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.path).toEqual([field]);
    },
  );

  it("trims the text fields", () => {
    const result = CreateAdminFestivalSchema.parse({
      ...VALID,
      name: "  Oktoberfest 2027 ",
      short_name: " oktoberfest-2027 ",
      location: " Munich ",
    });

    expect(result).toMatchObject({
      name: "Oktoberfest 2027",
      short_name: "oktoberfest-2027",
      location: "Munich",
    });
  });
});
