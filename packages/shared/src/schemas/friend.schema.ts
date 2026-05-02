import { z } from "zod";

// Friendship status enum
export const FriendshipStatusSchema = z.enum(["pending", "accepted", "declined"]);
export type FriendshipStatus = z.infer<typeof FriendshipStatusSchema>;

// Friend profile (accepted friendship)
export const FriendSchema = z.object({
  id: z.string().uuid(),
  username: z.string().nullable(),
  fullName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  friendshipId: z.string().uuid(),
  friendsSince: z.string(),
});
export type Friend = z.infer<typeof FriendSchema>;

// Friend request (pending)
export const FriendRequestSchema = z.object({
  id: z.string().uuid(),
  requesterId: z.string().uuid(),
  addresseeId: z.string().uuid(),
  status: FriendshipStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  profile: z.object({
    id: z.string().uuid(),
    username: z.string().nullable(),
    fullName: z.string().nullable(),
    avatarUrl: z.string().nullable(),
  }),
});
export type FriendRequest = z.infer<typeof FriendRequestSchema>;

// Friend suggestion (shared group member)
export const FriendSuggestionSchema = z.object({
  id: z.string().uuid(),
  username: z.string().nullable(),
  fullName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  sharedGroups: z.number().int(),
});
export type FriendSuggestion = z.infer<typeof FriendSuggestionSchema>;

// Friendship status check
export const FriendshipStatusCheckSchema = z.object({
  status: z.enum(["friends", "pending_sent", "pending_received", "none"]),
  friendshipId: z.string().uuid().nullable(),
});
export type FriendshipStatusCheck = z.infer<typeof FriendshipStatusCheckSchema>;

// Request schemas
export const SendFriendRequestSchema = z.object({
  addresseeId: z.string().uuid(),
});
export type SendFriendRequestInput = z.infer<typeof SendFriendRequestSchema>;

export const FriendRequestIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const FriendUserIdParamSchema = z.object({
  userId: z.string().uuid(),
});

export const FriendSearchQuerySchema = z.object({
  q: z.string().min(1).max(100),
});

// Response schemas
export const ListFriendsResponseSchema = z.object({
  data: z.array(FriendSchema),
});
export type ListFriendsResponse = z.infer<typeof ListFriendsResponseSchema>;

export const ListFriendRequestsResponseSchema = z.object({
  data: z.array(FriendRequestSchema),
});
export type ListFriendRequestsResponse = z.infer<typeof ListFriendRequestsResponseSchema>;

export const FriendRequestCountResponseSchema = z.object({
  count: z.number().int(),
});
export type FriendRequestCountResponse = z.infer<typeof FriendRequestCountResponseSchema>;

export const FriendActionResponseSchema = z.object({
  success: z.boolean(),
  friendshipId: z.string().uuid().optional(),
  status: z.string().optional(),
  message: z.string().optional(),
});
export type FriendActionResponse = z.infer<typeof FriendActionResponseSchema>;

export const ListFriendSuggestionsResponseSchema = z.object({
  data: z.array(FriendSuggestionSchema),
});
export type ListFriendSuggestionsResponse = z.infer<typeof ListFriendSuggestionsResponseSchema>;

export const SearchUserResultSchema = z.object({
  id: z.string().uuid(),
  username: z.string().nullable(),
  fullName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  friendshipStatus: z.enum(["friends", "pending_sent", "pending_received", "none"]),
});
export type SearchUserResult = z.infer<typeof SearchUserResultSchema>;

export const SearchUsersResponseSchema = z.object({
  data: z.array(SearchUserResultSchema),
});
export type SearchUsersResponse = z.infer<typeof SearchUsersResponseSchema>;
