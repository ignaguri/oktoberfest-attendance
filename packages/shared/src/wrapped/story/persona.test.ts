import { describe, expect, it } from "vitest";

import type { WrappedData } from "../../schemas/wrapped.schema";
import { derivePersona, formatHour } from "./persona";
import { makeWrapped } from "./story-fixtures";

/** Qualifies for nothing: 3 of 16 days, avg 2, 2 tents, all beer, afternoon drinker. */
function neutral(mutate?: (data: WrappedData) => void): WrappedData {
  return makeWrapped((data) => {
    data.basicStats.daysAttended = 3;
    data.basicStats.totalBeers = 6;
    data.basicStats.avgBeers = 2;
    data.tentStats.uniqueTents = 2;
    data.tentStats.tentDiversityPct = 10;
    data.tentStats.tentBreakdown = [
      { tentName: "Schottenhamel", visitCount: 2 },
      { tentName: "Hacker-Festzelt", visitCount: 2 },
    ];
    data.drinkStats.totalDrinks = 6;
    data.drinkStats.breakdown = [{ drinkType: "beer", count: 6, percentage: 100 }];
    data.timing = { timedDays: 3, medianFirstHour: 14, medianLastHour: 20, peakHour: 17, weekendShare: 0.33 };
    mutate?.(data);
  });
}

describe("derivePersona", () => {
  it("falls back to Der Genießer with no runner-up", () => {
    const persona = derivePersona(neutral());
    expect(persona.id).toBe("geniesser");
    expect(persona.runnerUpId).toBeNull();
    expect(persona.because).toEqual({
      key: "wrapped.story.persona.geniesser.because",
      params: { count: 3, beers: 6 },
    });
  });

  it("Einmal, aber richtig beats Maß-Meister for a single big day", () => {
    const persona = derivePersona(
      neutral((data) => {
        data.basicStats.daysAttended = 1;
        data.basicStats.totalBeers = 6;
        data.basicStats.avgBeers = 6;
      }),
    );
    expect(persona.id).toBe("einmalAberRichtig");
    expect(persona.runnerUpId).toBe("massMeister");
    expect(persona.because.params).toEqual({ beers: 6 });
  });

  it.each<[string, (data: WrappedData) => void]>([
    ["massMeister", (data) => { data.basicStats.avgBeers = 7; }],
    ["marathoner", (data) => { data.basicStats.daysAttended = 12; }],
    ["zeltwanderer", (data) => { data.tentStats.uniqueTents = 8; data.tentStats.tentDiversityPct = 60; }],
    ["stammgast", (data) => {
      data.tentStats.tentBreakdown = [
        { tentName: "Schottenhamel", visitCount: 5 },
        { tentName: "Hacker-Festzelt", visitCount: 1 },
      ];
    }],
    ["fruehschoppen", (data) => { data.timing.medianFirstHour = 10.5; }],
    ["nachteule", (data) => { data.timing.medianLastHour = 23; }],
    ["radlerDiplomat", (data) => {
      data.drinkStats.totalDrinks = 7;
      data.drinkStats.breakdown = [
        { drinkType: "beer", count: 3, percentage: 42.9 },
        { drinkType: "radler", count: 3, percentage: 42.9 },
        { drinkType: "alcohol_free", count: 1, percentage: 14.3 },
      ];
    }],
    ["wochenendKrieger", (data) => { data.timing.weekendShare = 1; }],
  ])("%s wins when only its rule holds", (expected, mutate) => {
    expect(derivePersona(neutral(mutate)).id).toBe(expected);
  });

  it("breaks a tie by priority (Frühschoppen before Nachteule)", () => {
    const persona = derivePersona(
      neutral((data) => {
        data.timing.medianFirstHour = 8; // strength capped at 2
        data.timing.medianLastHour = 25; // strength capped at 2
      }),
    );
    expect(persona.id).toBe("fruehschoppen");
    expect(persona.runnerUpId).toBe("nachteule");
  });

  it("does not crown a zero-drink weekend visit a Wochenend-Krieger", () => {
    const persona = derivePersona(
      neutral((data) => {
        data.basicStats.daysAttended = 1;
        data.basicStats.totalBeers = 0;
        data.basicStats.avgBeers = 0;
        data.timing.weekendShare = 1;
      }),
    );
    expect(persona.id).toBe("geniesser");
  });

  it("needs a timed day for the timing personas", () => {
    const persona = derivePersona(
      neutral((data) => {
        data.timing.timedDays = 0;
        data.timing.medianLastHour = 23;
      }),
    );
    expect(persona.id).toBe("geniesser");
  });

  // Thresholds tuned against production data (Oktoberfest 2025/2026, Frühlingsfest
  // 2026): each case sits exactly on its persona's boundary.
  it.each<[string, (data: WrappedData) => void]>([
    ["einmalAberRichtig", (data) => {
      data.basicStats.daysAttended = 1;
      data.basicStats.totalBeers = 2;
      data.basicStats.avgBeers = 2;
    }],
    ["massMeister", (data) => { data.basicStats.avgBeers = 4; }],
    ["marathoner", (data) => { data.basicStats.daysAttended = 5; }],
    ["zeltwanderer", (data) => { data.tentStats.uniqueTents = 4; data.tentStats.tentDiversityPct = 10; }],
    ["stammgast", (data) => {
      data.tentStats.tentBreakdown = [
        { tentName: "Schottenhamel", visitCount: 2 },
        { tentName: "Hacker-Festzelt", visitCount: 1 },
      ];
    }],
    ["fruehschoppen", (data) => { data.timing.timedDays = 1; data.timing.medianFirstHour = 12.99; }],
    ["nachteule", (data) => { data.timing.timedDays = 1; data.timing.medianLastHour = 21.5; }],
    ["radlerDiplomat", (data) => {
      data.drinkStats.totalDrinks = 3;
      data.drinkStats.breakdown = [
        { drinkType: "beer", count: 2, percentage: 66.7 },
        { drinkType: "radler", count: 1, percentage: 33.3 },
      ];
    }],
    ["wochenendKrieger", (data) => {
      data.basicStats.daysAttended = 1;
      data.basicStats.totalBeers = 1;
      data.basicStats.avgBeers = 1;
      data.timing.weekendShare = 1;
    }],
  ])("%s qualifies at its tuned threshold", (expected, mutate) => {
    expect(derivePersona(neutral(mutate)).id).toBe(expected);
  });

  it("passes the real numbers to the because line", () => {
    const zelt = derivePersona(
      neutral((data) => {
        data.tentStats.uniqueTents = 8;
        data.tentStats.tentDiversityPct = 60;
      }),
    );
    expect(zelt.because).toEqual({
      key: "wrapped.story.persona.zeltwanderer.because",
      params: { tents: 8, totalTents: 13 },
    });

    const stamm = derivePersona(
      neutral((data) => {
        data.tentStats.tentBreakdown = [
          { tentName: "Schottenhamel", visitCount: 5 },
          { tentName: "Hacker-Festzelt", visitCount: 1 },
        ];
      }),
    );
    expect(stamm.because.params).toEqual({ tent: "Schottenhamel", visits: 5 });

    const owl = derivePersona(neutral((data) => { data.timing.medianLastHour = 24.25; }));
    expect(owl.because.params).toEqual({ time: "00:15" });

    // count, so the copy can say "your one day" instead of "all 1 of your days"
    const weekend = derivePersona(
      neutral((data) => {
        data.basicStats.daysAttended = 1;
        data.basicStats.totalBeers = 1;
        data.timing.weekendShare = 1;
      }),
    );
    expect(weekend.because.params).toEqual({ count: 1 });
  });
});

describe("formatHour", () => {
  it("wraps past midnight and rounds to the minute", () => {
    expect(formatHour(24.25)).toBe("00:15");
    expect(formatHour(11.999)).toBe("12:00");
    expect(formatHour(9.5)).toBe("09:30");
  });
});
