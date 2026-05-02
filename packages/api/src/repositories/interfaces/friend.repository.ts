import type {
  Friend,
  FriendRequest,
  FriendshipStatusCheck,
  FriendSuggestion,
} from "@prostcounter/shared";

export interface IFriendRepository {
  listFriends(userId: string): Promise<Friend[]>;
  getIncomingRequests(userId: string): Promise<FriendRequest[]>;
  getOutgoingRequests(userId: string): Promise<FriendRequest[]>;
  getIncomingRequestCount(userId: string): Promise<number>;
  sendRequest(
    requesterId: string,
    addresseeId: string,
  ): Promise<{
    success: boolean;
    friendshipId?: string;
    status?: string;
    errorCode?: string;
    message?: string;
  }>;
  acceptRequest(
    friendshipId: string,
    userId: string,
  ): Promise<{ success: boolean; errorCode?: string; message?: string }>;
  declineRequest(
    friendshipId: string,
    userId: string,
  ): Promise<{ success: boolean; errorCode?: string; message?: string }>;
  cancelRequest(friendshipId: string, userId: string): Promise<void>;
  unfriend(userId: string, friendUserId: string): Promise<void>;
  getSuggestions(userId: string): Promise<FriendSuggestion[]>;
  searchUsers(
    userId: string,
    query: string,
  ): Promise<
    {
      id: string;
      username: string | null;
      fullName: string | null;
      avatarUrl: string | null;
      friendshipStatus: "friends" | "pending_sent" | "pending_received" | "none";
    }[]
  >;
  getFriendshipStatus(userId: string, otherUserId: string): Promise<FriendshipStatusCheck>;
}
