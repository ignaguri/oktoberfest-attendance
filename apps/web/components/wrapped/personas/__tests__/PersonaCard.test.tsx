// @vitest-environment happy-dom
import { initI18n } from "@prostcounter/shared/i18n";
import type { PersonaCardEntry } from "@prostcounter/shared/wrapped";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) => (
    <img src={src} alt={alt} className={className} />
  ),
}));

import { PersonaCard } from "../PersonaCard";

beforeAll(async () => {
  await initI18n("en");
  // Reduced motion: flips swap faces at once and opening fires immediately
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes("prefers-reduced-motion"),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
  }));
});

const okt26 = { festivalId: "11111111-1111-4111-8111-111111111111", name: "Oktoberfest 2026", isWiesn: true };
const fruehling26 = { festivalId: "22222222-2222-4222-8222-222222222222", name: "Frühlingsfest 2026", isWiesn: false };
const festivals = [okt26, fruehling26];

function card(state: PersonaCardEntry["state"]): PersonaCardEntry {
  return {
    personaId: "nachteule",
    number: 7,
    state,
    name: "Nachteule",
    descriptionKey: "wrapped.story.persona.nachteule.description",
    festivals: state === "locked" ? [] : festivals,
  };
}

describe("PersonaCard", () => {
  it("shows a locked card with the hint and no name", () => {
    const onOpen = vi.fn();
    render(<PersonaCard card={card("locked")} total={10} onOpen={onOpen} />);
    expect(screen.getByText("Usually still there after 21:30")).toBeTruthy();
    expect(screen.queryByText("Nachteule")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("opens an unopened card on tap", () => {
    const onOpen = vi.fn();
    render(<PersonaCard card={card("unopened")} total={10} onOpen={onOpen} />);
    expect(screen.getByText("New")).toBeTruthy();
    fireEvent.click(screen.getByRole("button"));
    expect(onOpen).toHaveBeenCalledWith("nachteule");
  });

  it("stays on the front once the revealed card becomes opened", () => {
    const { rerender } = render(<PersonaCard card={card("unopened")} total={10} onOpen={vi.fn()} />);
    fireEvent.click(screen.getByRole("button"));
    rerender(<PersonaCard card={card("opened")} total={10} onOpen={vi.fn()} />);
    expect(screen.getByText("Oktoberfest 2026")).toBeTruthy();
    expect(screen.queryByText("The one who turns off the tent lights.")).toBeNull();
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("The one who turns off the tent lights.")).toBeTruthy();
  });

  it("turns face-down again and can be retried when the open is rolled back", () => {
    const onOpen = vi.fn();
    const { rerender } = render(<PersonaCard card={card("unopened")} total={10} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button"));
    rerender(<PersonaCard card={card("opened")} total={10} onOpen={onOpen} />);
    rerender(<PersonaCard card={card("unopened")} total={10} onOpen={onOpen} />);
    expect(screen.getByText("New")).toBeTruthy();
    fireEvent.click(screen.getByRole("button"));
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it("shows the front of a card that became opened without being flipped here", () => {
    const { rerender } = render(<PersonaCard card={card("unopened")} total={10} onOpen={vi.fn()} />);
    rerender(<PersonaCard card={card("opened")} total={10} onOpen={vi.fn()} />);
    expect(screen.getByText("Oktoberfest 2026")).toBeTruthy();
    expect(screen.queryByText("The one who turns off the tent lights.")).toBeNull();
  });

  it("flips an opened card to the back and back again", () => {
    render(<PersonaCard card={card("opened")} total={10} onOpen={vi.fn()} />);
    expect(screen.getAllByText("Nachteule").length).toBeGreaterThan(0);
    expect(screen.getByText("Oktoberfest 2026")).toBeTruthy();
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("The one who turns off the tent lights.")).toBeTruthy();
    expect(screen.getByText("Frühlingsfest 2026")).toBeTruthy();
    expect(screen.getByText("No. 7 of 10")).toBeTruthy();
    fireEvent.click(screen.getByRole("button"));
    expect(screen.queryByText("The one who turns off the tent lights.")).toBeNull();
  });

  it("shows the card's own name and description, generic for a marathoner earned outside the Wiesn", () => {
    const marathoner: PersonaCardEntry = {
      personaId: "marathoner",
      number: 3,
      state: "opened",
      name: "Fest-Marathoner",
      descriptionKey: "wrapped.story.persona.marathoner.descriptionGeneric",
      festivals: [fruehling26],
    };
    render(<PersonaCard card={marathoner} total={10} onOpen={vi.fn()} />);
    expect(screen.getAllByText("Fest-Marathoner").length).toBeGreaterThan(0);
    expect(screen.queryByText("Wiesn-Marathoner")).toBeNull();
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("The festival grounds are your second home.")).toBeTruthy();
  });
});
