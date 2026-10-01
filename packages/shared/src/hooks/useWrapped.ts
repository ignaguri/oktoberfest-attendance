/**
 * Shared hooks for Wrapped. Both apps read through the API, which records the
 * view (wrapped_viewed achievement, wrapped_views analytics) on status=ready.
 */

import {
  QueryKeys,
  useApiClient,
  useCancelQueries,
  useGetQueryData,
  useInvalidateQueries,
  useMutation,
  useQuery,
  useSetQueryData,
} from "../data";
import type {
  GetPersonaCollectionResponse,
  GetWrappedResponse,
  OpenPersonaCardResponse,
  WrappedFestival,
} from "../schemas/wrapped.schema";
import type { PersonaId } from "../wrapped/story/persona";

/**
 * Only a ready Wrapped is worth keeping: a locked answer has to be refetched
 * once unlocksAt passes, or reopening shows a countdown that already ended.
 */
export function wrappedStaleTime(response: GetWrappedResponse | undefined): number {
  return response?.status === "ready" ? 10 * 60 * 1000 : 0;
}

export function useWrapped(festivalId?: string) {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  return useQuery(
    QueryKeys.wrapped(festivalId || ""),
    async (): Promise<GetWrappedResponse> => {
      const response = await apiClient.wrapped.get(festivalId!);
      if (response.status === "ready") {
        // Evaluate-only route: the unlock reaches the client through the
        // outbox, so nudge the pending query instead of waiting for focus.
        invalidateQueries(QueryKeys.pendingUnlocks());
        // The archive's "new" dot depends on the view just recorded.
        invalidateQueries(QueryKeys.wrappedFestivals());
      }
      return response;
    },
    {
      enabled: !!festivalId,
      staleTime: (data) => wrappedStaleTime(data as GetWrappedResponse | undefined),
      gcTime: 30 * 60 * 1000,
      retry: 2,
    },
  );
}

export function useWrappedFestivals() {
  const apiClient = useApiClient();

  return useQuery(
    QueryKeys.wrappedFestivals(),
    async (): Promise<WrappedFestival[]> => {
      const response = await apiClient.wrapped.list();
      return response.festivals;
    },
    {
      staleTime: 5 * 60 * 1000,
      gcTime: 15 * 60 * 1000,
    },
  );
}

/** Earned personas with their festivals and opened flags (GET /wrapped/personas). */
export function usePersonaCollection() {
  const apiClient = useApiClient();

  return useQuery(
    QueryKeys.wrappedPersonas(),
    async (): Promise<GetPersonaCollectionResponse> => apiClient.wrapped.personas.get(),
    {
      staleTime: 5 * 60 * 1000,
      gcTime: 15 * 60 * 1000,
    },
  );
}

/**
 * First flip of a persona card. Optimistic: the card is opened in the cache
 * at once and rolled back (face-down again) if the request fails.
 */
export function useOpenPersonaCard() {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();
  const setQueryData = useSetQueryData();
  const getQueryData = useGetQueryData();
  const cancelQueries = useCancelQueries();

  return useMutation<
    OpenPersonaCardResponse,
    PersonaId,
    { previous: GetPersonaCollectionResponse | undefined }
  >(
    async (personaId) => apiClient.wrapped.personas.open(personaId),
    {
      onMutate: async (personaId) => {
        await cancelQueries(QueryKeys.wrappedPersonas());
        const previous = getQueryData<GetPersonaCollectionResponse>(QueryKeys.wrappedPersonas());
        if (previous) {
          setQueryData<GetPersonaCollectionResponse>(QueryKeys.wrappedPersonas(), {
            earned: previous.earned.map((entry) =>
              entry.personaId === personaId ? { ...entry, opened: true } : entry,
            ),
          });
        }
        return { previous };
      },
      onError: (_error, _personaId, context) => {
        if (context?.previous) {
          setQueryData<GetPersonaCollectionResponse>(QueryKeys.wrappedPersonas(), context.previous);
        }
      },
      onSettled: () => {
        invalidateQueries(QueryKeys.wrappedPersonas());
      },
    },
  );
}
