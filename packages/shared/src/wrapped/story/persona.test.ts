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
        data.timing.medianFirstHour = 10.5; // strength 1.25
        data.timing.medianLastHour = 23; // strength 1.25
      }),
    );
    expect(persona.id).toBe("fruehschoppen");
    expect(persona.runnerUpId).toBe("nachteule");
  });

  it("needs two timed days for the timing personas", () => {
    const persona = derivePersona(
      neutral((data) => {
        data.timing.timedDays = 1;
        data.timing.medianLastHour = 23;
      }),
    );
    expect(persona.id).toBe("geniesser");
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
  });
});

describe("formatHour", () => {
  it("wraps past midnight and rounds to the minute", () => {
    expect(formatHour(24.25)).toBe("00:15");
    expect(formatHour(11.999)).toBe("12:00");
    expect(formatHour(9.5)).toBe("09:30");
  });
});
