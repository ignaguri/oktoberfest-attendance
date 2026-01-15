/**
 * Group hooks - re-exports from shared package
 *
 * These hooks use the ApiClientContext to access the API client.
 * The ApiClientProvider is set up in lib/data/query-client.tsx
 */

export {
  useCreateGroup,
  useGroupMembers,
  useGroupName,
  useGroupSearch,
  useGroupSettings,
  useJoinGroup,
  useLeaveGroup,
  useRemoveMember,
  useRenewInviteToken,
  useUpdateGroup,
  useUserGroups,
} from "@prostcounter/shared/hooks";
