// @vitest-environment happy-dom
import type { EarnedPersona } from "@prostcounter/shared";
import { initI18n } from "@prostcounter/shared/i18n";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) => (
    <img src={src} alt={alt} className={className} />
  ),
}));

import { PersonaAlbum } from "../PersonaAlbum";

beforeAll(async () => {
  await initI18n("en");
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

describe("PersonaAlbum", () => {
  it("shows 0 of 10 and a locked first card when nothing is earned", () => {
    render(<PersonaAlbum earned={[]} onOpen={vi.fn()} />);
    expect(screen.getByText("0 of 10 collected")).toBeTruthy();
    expect(screen.getByRole("img", { name: /Card 1, locked/ })).toBeTruthy();
  });

  it("opens on the first unopened card", () => {
    const earned: EarnedPersona[] = [
      { personaId: "massMeister", festivals: [okt26], opened: true },
      { personaId: "nachteule", festivals: [okt26], opened: false },
    ];
    render(<PersonaAlbum earned={earned} onOpen={vi.fn()} />);
    expect(screen.getByText("2 of 10 collected")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Card 7, new card, not opened yet" })).toBeTruthy();
  });

  it("moves between cards with the arrow keys and the strip", () => {
    render(<PersonaAlbum earned={[]} onOpen={vi.fn()} />);
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByRole("img", { name: /Card 2, locked/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "No. 10" }));
    expect(screen.getByRole("img", { name: /Card 10, locked/ })).toBeTruthy();
  });
});
