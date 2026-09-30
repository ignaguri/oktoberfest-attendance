// @vitest-environment happy-dom
import type { GetPersonaCollectionResponse } from "@prostcounter/shared";
import { ApiClientProvider, QueryKeys } from "@prostcounter/shared/data";
import { useOpenPersonaCard } from "@prostcounter/shared/hooks";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const okt26 = { festivalId: "11111111-1111-4111-8111-111111111111", name: "Oktoberfest 2026" };

const collection: GetPersonaCollectionResponse = {
  earned: [
    { personaId: "massMeister", festivals: [okt26], opened: true },
    { personaId: "nachteule", festivals: [okt26], opened: false },
  ],
};

function setup(open: (personaId: string) => Promise<{ success: true }>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData(QueryKeys.wrappedPersonas(), collection);
  const apiClient = {
    wrapped: { personas: { open, get: vi.fn().mockResolvedValue(collection) } },
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ApiClientProvider client={apiClient}>{children}</ApiClientProvider>
    </QueryClientProvider>
  );
  const { result } = renderHook(() => useOpenPersonaCard(), { wrapper });
  const openedFlag = (personaId: string) =>
    queryClient
      .getQueryData<GetPersonaCollectionResponse>(QueryKeys.wrappedPersonas())
      ?.earned.find((entry) => entry.personaId === personaId)?.opened;
  return { result, openedFlag };
}

describe("useOpenPersonaCard", () => {
  it("marks the card opened in the cache before the request settles", async () => {
    let resolveOpen: (value: { success: true }) => void = () => {};
    const { result, openedFlag } = setup(
      () =>
        new Promise((resolve) => {
          resolveOpen = resolve;
        }),
    );

    let pending: Promise<unknown> = Promise.resolve();
    act(() => {
      pending = result.current.mutate("nachteule");
    });

    await waitFor(() => expect(openedFlag("nachteule")).toBe(true));
    expect(openedFlag("massMeister")).toBe(true);

    await act(async () => {
      resolveOpen({ success: true });
      await pending;
    });
    expect(openedFlag("nachteule")).toBe(true);
  });

  it("restores the unopened card when the open fails, and a retry opens it", async () => {
    const open = vi
      .fn<(personaId: string) => Promise<{ success: true }>>()
      .mockRejectedValueOnce(new Error("500"))
      .mockResolvedValueOnce({ success: true });
    const { result, openedFlag } = setup(open);

    await act(async () => {
      await expect(result.current.mutate("nachteule")).rejects.toThrow("500");
    });
    expect(openedFlag("nachteule")).toBe(false);

    await act(async () => {
      await result.current.mutate("nachteule");
    });
    expect(openedFlag("nachteule")).toBe(true);
    expect(open).toHaveBeenCalledTimes(2);
  });
});
