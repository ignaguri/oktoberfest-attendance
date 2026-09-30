// @vitest-environment happy-dom
import type * as AnalyticsReact from "@prostcounter/shared/analytics/react";
import { initI18n } from "@prostcounter/shared/i18n/core";
import { buildWrappedStory } from "@prostcounter/shared/wrapped";
import { makeOfficialStats, makeWrapped } from "@prostcounter/shared/wrapped/testing";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

// The share carousel fetches through the API client, which needs a provider; the story itself does not.
vi.mock("../../share/useWebShareCards", () => ({
  useWebShareCards: () => ({ cards: [], states: {}, retry: vi.fn() }),
}));
vi.mock("../../share/ShareCarousel", () => ({
  ShareCarousel: ({ open }: { open: boolean }) => (open ? <div>share carousel</div> : null),
}));

// AchievementBadge's useTranslation import goes through the `@/lib/data` barrel, which drags in
// Next.js server actions and Sentry (via useProfile -> Avatar/actions.ts); neither can load under
// Vitest, so stub the one export that chain actually needs.
vi.mock("@/lib/data", () => ({
  useCurrentProfile: () => ({ data: null, loading: false, error: null, refetch: vi.fn() }),
}));

vi.mock("next-view-transitions", () => ({
  Link: ({ href, children, onClick, className }: { href: string; children: ReactNode; onClick?: () => void; className?: string }) => (
    <a href={href} onClick={onClick} className={className}>
      {children}
    </a>
  ),
}));

// vi.mock factories are hoisted above plain consts, so the mock must be hoisted too
const trackMock = vi.hoisted(() => vi.fn());
vi.mock("@prostcounter/shared/analytics/react", async (importOriginal) => ({
  ...(await importOriginal<typeof AnalyticsReact>()),
  useTrack: () => trackMock,
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
  render(<StoryShell data={data} slides={slides} share={{ festivalId: "f", officialStats: null }} onClose={onClose} />);
  return { slides, onClose };
}

describe("StoryShell", () => {
  it("starts on the Servus slide", () => {
    renderStory();
    expect(screen.getByText("Servus, Maxi Muster!")).toBeTruthy();
  });

  it("links to the persona collection from the last slide", async () => {
    const { slides } = renderStory();
    // One act per press: a slide advances only after its reveal effect has run
    for (let step = 0; step < slides.length - 1; step += 1) {
      await act(async () => {
        fireEvent.keyDown(window, { key: "ArrowRight" });
      });
    }
    const link = screen.getByRole("link", { name: "See all personas" });
    expect(link.getAttribute("href")).toBe("/wrapped/personas");
    fireEvent.click(link);
    expect(trackMock).toHaveBeenCalledWith("persona_collection_opened", { source: "prost_slide" });
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

  it("announces the slide and its whole text to screen readers", async () => {
    renderStory();
    await act(async () => {
      fireEvent.keyDown(window, { key: "ArrowRight" });
    });
    const region = screen.getByRole("status");
    expect(region.getAttribute("aria-live")).toBe("polite");
    expect(region.textContent).toContain("2 of");
    expect(region.textContent).toContain("At Oktoberfest 2026 you had");
  });

  it("leaves Space to a focused button instead of moving on", async () => {
    renderStory();
    const close = screen.getByRole("button", { name: "Close" });
    close.focus();
    await act(async () => {
      fireEvent.keyDown(close, { key: " " });
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

  it("leaves the keys to the share carousel while it is open", async () => {
    const { slides, onClose } = renderStory();
    for (let index = 1; index < slides.length; index += 1) {
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Next" }));
      });
    }
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Share your Wrapped" }));
    });
    await act(async () => {
      fireEvent.keyDown(window, { key: "ArrowLeft" });
      fireEvent.keyDown(window, { key: "Escape" });
    });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText("Prost!")).toBeTruthy();
  });
});
