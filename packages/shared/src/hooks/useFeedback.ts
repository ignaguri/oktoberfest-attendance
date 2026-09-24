/**
 * Shared hooks for in-app feedback: the day prompt, bug reports and ideas.
 */

import type {
  DismissDayFeedbackPromptBody,
  DismissDayFeedbackPromptResponse,
  FeedbackKind,
  GetDayFeedbackPromptResponse,
  ListAdminFeedbackResponse,
  SubmitFeedbackBody,
  SubmitFeedbackResponse,
} from "../schemas/feedback.schema";
import { QueryKeys, useApiClient, useInvalidateQueries, useMutation, useQuery } from "../data";

/**
 * Whether the server wants to ask about yesterday right now.
 *
 * Fetched once and kept: callers decide when to ask again (refetch), because
 * "next app open" means different things on web and mobile.
 */
export function useDayFeedbackPrompt({ enabled }: { enabled: boolean }) {
  const apiClient = useApiClient();

  const query = useQuery(
    QueryKeys.dayFeedbackPrompt(),
    async () => {
      const response: GetDayFeedbackPromptResponse = await apiClient.feedback.getDayPrompt();
      return response.prompt;
    },
    {
      enabled,
      staleTime: Infinity,
      gcTime: Infinity,
    },
  );

  return {
    prompt: query.data ?? null,
    isLoading: query.loading,
    refetch: query.refetch,
  };
}

export function useSubmitFeedback() {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async (body: SubmitFeedbackBody): Promise<SubmitFeedbackResponse> =>
      apiClient.feedback.submit(body),
    {
      onSuccess: () => {
        invalidateQueries(QueryKeys.dayFeedbackPrompt());
        invalidateQueries(QueryKeys.adminFeedbackAll());
      },
    },
  );
}

export function useDismissDayFeedbackPrompt() {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async (body: DismissDayFeedbackPromptBody): Promise<DismissDayFeedbackPromptResponse> =>
      apiClient.feedback.dismissDayPrompt(body),
    {
      onSuccess: () => {
        invalidateQueries(QueryKeys.dayFeedbackPrompt());
      },
    },
  );
}

/** Newest feedback first, for the admin screens. */
export function useAdminFeedback(kind?: FeedbackKind) {
  const apiClient = useApiClient();

  const query = useQuery(
    QueryKeys.adminFeedback(kind),
    async () => {
      const response: ListAdminFeedbackResponse = await apiClient.admin.feedback.list({ kind });
      return response.items;
    },
    {
      staleTime: 30 * 1000,
    },
  );

  return {
    items: query.data ?? [],
    isLoading: query.loading,
    error: query.error?.message ?? null,
    refetch: query.refetch,
  };
}
