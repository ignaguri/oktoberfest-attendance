// @vitest-environment happy-dom
import { initI18n } from "@prostcounter/shared/i18n/core";
import { buildWrappedStory } from "@prostcounter/shared/wrapped";
import { makeOfficialStats, makeWrapped } from "@prostcounter/shared/wrapped/testing";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

// ProstSlide calls useRouter, which throws outside a mounted app router.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// AchievementBadge's useTranslation import goes through the `@/lib/data` barrel, which drags in
// Next.js server actions and Sentry (via useProfile -> Avatar/actions.ts); neither can load under
// Vitest, so stub the one export that chain actually needs.
vi.mock("@/lib/data", () => ({
  useCurrentProfile: () => ({ data: null, loading: false, error: null, refetch: vi.fn() }),
}));

import { StoryShell } from "../StoryShell";

beforeAll(async () => {
  await initI18n("en");
  // Force reduced motion so every slide renders its end frame at once
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

function renderStory() {
  const data = makeWrapped();
  const slides = buildWrappedStory(data, makeOfficialStats());
  const onClose = vi.fn();
  render(<StoryShell data={data} slides={slides} onClose={onClose} />);
  return { slides, onClose };
}

describe("StoryShell", () => {
  it("starts on the Servus slide", () => {
    renderStory();
    expect(screen.getByText("Servus, Maxi Muster!")).toBeTruthy();
  });

  it("moves forward and back with the keyboard", async () => {
    renderStory();
    await act(async () => {
      fireEvent.keyDown(window, { key: "ArrowRight" });
    });
    expect(screen.getByText("At Oktoberfest 2026 you had")).toBeTruthy();
    await act(async () => {
      fireEvent.keyDown(window, { key: "ArrowLeft" });
    });
    expect(screen.getByText("Servus, Maxi Muster!")).toBeTruthy();
  });

  it("renders every slide through to Prost and closes on Escape", async () => {
    const { slides, onClose } = renderStory();
    for (let index = 1; index < slides.length; index += 1) {
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Next" }));
      });
    }
    expect(screen.getByText("Prost!")).toBeTruthy();
    await act(async () => {
      fireEvent.keyDown(window, { key: "Escape" });
    });
    expect(onClose).toHaveBeenCalled();
  });
});
