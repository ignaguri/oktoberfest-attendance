import { describe, expect, it } from "vitest";

import { QueryKeys } from "../query-keys";

/**
 * Regression test for the Add Friend button falling back to "Add friend"
 * after a request was sent.
 *
 * The friend mutations invalidate `QueryKeys.friendSearchAll()` so that every
 * cached `friendSearch(query)` entry refetches: search results embed their own
 * `friendshipStatus`, and both the mobile search screen and the web
 * `AddFriendButton` render the button straight off that field. The provider's
 * `invalidateQueries` matches by key prefix, so this only works while
 * `friendSearchAll()` really is a prefix of `friendSearch(...)`.
 *
 * This locks the key shapes together; it does not assert that the mutations
 * still call it.
 */
describe("QueryKeys.friendSearchAll", () => {
  it("is a prefix of every friendSearch key", () => {
    const prefix = QueryKeys.friendSearchAll();

    for (const query of ["", "a", "ignaguri", "Celina Inés"]) {
      const key = QueryKeys.friendSearch(query);
      expect(key.slice(0, prefix.length)).toEqual([...prefix]);
    }
  });

  it("does not swallow the sibling friend query keys", () => {
    const prefix = QueryKeys.friendSearchAll();
    const siblings = [
      QueryKeys.friends(),
      QueryKeys.friendSuggestions(),
      QueryKeys.friendRequestsIncoming(),
      QueryKeys.friendRequestsOutgoing(),
      QueryKeys.friendRequestCount(),
      QueryKeys.friendshipStatus("some-user-id"),
    ];

    for (const key of siblings) {
      expect(key.slice(0, prefix.length)).not.toEqual([...prefix]);
    }
  });
});
