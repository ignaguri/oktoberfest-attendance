// @vitest-environment happy-dom
import { initI18n } from "@prostcounter/shared/i18n/core";
import {
  buildShareCards,
  shareCardFingerprint,
} from "@prostcounter/shared/wrapped";
import {
  makeOfficialStats,
  makeWrapped,
} from "@prostcounter/shared/wrapped/testing";
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const { apiClient, shareCardRequest, mutateAsync } = vi.hoisted(() => {
  const shareCardRequest = vi.fn();
  // Stable like the real context value; a new object per render would reload forever
  return {
    apiClient: { wrapped: { shareCardRequest } },
    shareCardRequest,
    mutateAsync: vi.fn(),
  };
});

vi.mock("@prostcounter/shared/data", () => ({
  useApiClient: () => apiClient,
}));
vi.mock("@prostcounter/shared/hooks", () => ({
  useWrappedShareLinks: () => ({ data: null }),
  useCreateWrappedShareLink: () => ({ mutateAsync, loading: false }),
  useRevokeWrappedShareLink: () => ({ mutate: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { ShareCarousel } from "../ShareCarousel";
import { useWebShareCards } from "../useWebShareCards";

// react-i18next is not bound in this harness, so buttons are named by their keys
const COPY_LINK = "wrapped.shareCards.carousel.copyLink";

const data = makeWrapped();
const officialStats = makeOfficialStats();
const allCards = buildShareCards(data, officialStats);
const numbers = allCards.find((card) => card.kind === "numbers")!;
const photos = allCards.find((card) => card.kind === "photos")!;

beforeAll(async () => {
  await initI18n("en");
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

function Harness() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        reopen
      </button>
      <ShareCarousel
        open={open}
        onOpenChange={setOpen}
        festivalId="f"
        lang="en"
        data={data}
        cards={[numbers, photos]}
        states={{}}
        onRetry={vi.fn()}
      />
    </>
  );
}

function swipeTo(page: number) {
  const scroller = document.querySelector<HTMLElement>(".snap-x")!;
  Object.defineProperty(scroller, "clientWidth", {
    value: 300,
    configurable: true,
  });
  Object.defineProperty(scroller, "scrollLeft", {
    value: 300 * page,
    configurable: true,
  });
  fireEvent.scroll(scroller);
}

describe("useWebShareCards", () => {
  it("asks for each card by its content, so a stale cached image is never reused", async () => {
    shareCardRequest.mockResolvedValue({ url: "http://api/card", headers: {} });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Blob(["jpeg"]), { status: 200 })),
    );
    vi.stubGlobal(
      "URL",
      Object.assign(URL, {
        createObjectURL: () => "blob:x",
        revokeObjectURL: vi.fn(),
      }),
    );
    renderHook(() =>
      useWebShareCards({ festivalId: "f", data, officialStats, lang: "en" }),
    );
    await waitFor(() => {
      expect(shareCardRequest).toHaveBeenCalledWith(
        "f",
        "numbers",
        "en",
        shareCardFingerprint(numbers),
      );
    });
  });

  function stubSlowDownloads() {
    const pending = new Map<string, () => void>();
    shareCardRequest.mockImplementation(
      async (_festivalId: string, kind: string, lang: string) => ({
        url: `http://api/${kind}/${lang}`,
        headers: {},
      }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (url: string) =>
          new Promise<Response>((resolve) =>
            pending.set(url, () =>
              resolve(new Response(new Blob([url]), { status: 200 })),
            ),
          ),
      ),
    );
    let objectUrlCount = 0;
    const revokeObjectURL = vi.fn();
    vi.stubGlobal(
      "URL",
      Object.assign(URL, {
        createObjectURL: () => `blob:${++objectUrlCount}`,
        revokeObjectURL,
      }),
    );
    const finish = async (url: string) => {
      await waitFor(() => expect(pending.has(url)).toBe(true));
      await act(async () => pending.get(url)!());
    };
    return { finish, revokeObjectURL };
  }

  function renderWithLang() {
    return renderHook(
      ({ lang }: { lang: "en" | "de" }) =>
        useWebShareCards({ festivalId: "f", data, officialStats, lang }),
      { initialProps: { lang: "en" } },
    );
  }

  it("keeps the newest image when an older download finishes last", async () => {
    const { finish } = stubSlowDownloads();
    const { result, rerender } = renderWithLang();
    rerender({ lang: "de" });
    await finish("http://api/numbers/de");
    await finish("http://api/numbers/en");

    const state = result.current.states.numbers;
    expect(state?.status).toBe("ready");
    expect(state?.status === "ready" && (await state.blob.text())).toBe(
      "http://api/numbers/de",
    );
  });

  it("releases a card's old image once its new one is ready", async () => {
    const { finish, revokeObjectURL } = stubSlowDownloads();
    const { result, rerender } = renderWithLang();
    await finish("http://api/numbers/en");
    const first = result.current.states.numbers;
    rerender({ lang: "de" });
    await finish("http://api/numbers/de");

    expect(first?.status === "ready" && first.url).toBeTruthy();
    expect(revokeObjectURL).toHaveBeenCalledWith(
      first?.status === "ready" ? first.url : undefined,
    );
  });
});

describe("ShareCarousel", () => {
  it("describes the dialog for screen readers", () => {
    render(<Harness />);
    const describedBy = screen
      .getByRole("dialog")
      .getAttribute("aria-describedby");
    expect(
      describedBy && document.getElementById(describedBy)?.textContent,
    ).toBe("wrapped.shareCards.carousel.description");
  });

  it("starts again on the first card after closing", async () => {
    render(<Harness />);
    expect(screen.getByRole("button", { name: COPY_LINK })).toBeTruthy();
    act(() => swipeTo(1));
    expect(screen.queryByRole("button", { name: COPY_LINK })).toBeNull();

    await act(async () => {
      fireEvent.keyDown(document.activeElement ?? document.body, {
        key: "Escape",
      });
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "reopen", hidden: true }),
      );
    });
    expect(screen.getByRole("button", { name: COPY_LINK })).toBeTruthy();
  });

  it("claims the clipboard inside the tap, before the link exists (Safari)", async () => {
    let resolveLink: (link: { url: string }) => void = () => {};
    mutateAsync.mockReturnValue(
      new Promise((resolve) => (resolveLink = resolve)),
    );
    const write = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal(
      "ClipboardItem",
      class {
        constructor(public items: Record<string, Promise<Blob>>) {}
      },
    );
    Object.defineProperty(navigator, "clipboard", {
      value: { write, writeText: vi.fn() },
      configurable: true,
    });

    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: COPY_LINK }));
    expect(write).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveLink({ url: "http://localhost/w/abc" });
    });
    const [[item]] = write.mock.calls[0];
    expect(await (await item.items["text/plain"]).text()).toBe(
      "http://localhost/w/abc",
    );
  });
});
