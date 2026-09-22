"use client";

import type { InvitableUser, SentGroupInvitation } from "@prostcounter/shared/schemas";
import { Loader2, Search, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AvatarPreview } from "@/components/Avatar/Avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  useCancelGroupInvitation,
  useInvitableUsers,
  useInviteToGroup,
  useSentGroupInvitations,
} from "@prostcounter/shared/hooks";
import { useTranslation } from "@/lib/i18n/client";

const SEARCH_DEBOUNCE_MS = 300;

export function InviteMembers({ groupId, groupName }: { groupId: string; groupName: string }) {
  const { t } = useTranslation();

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: results, loading: isSearching } = useInvitableUsers(groupId, debouncedQuery);
  const { data: sent } = useSentGroupInvitations(groupId);
  const invite = useInviteToGroup(groupId);
  const cancel = useCancelGroupInvitation(groupId);

  const users = useMemo(() => {
    const rows = (results as InvitableUser[] | undefined) ?? [];
    // Existing group members sink to the bottom; everyone else is alphabetical.
    return [...rows].sort((a, b) => {
      if (a.invitationStatus === "member" && b.invitationStatus !== "member") return 1;
      if (a.invitationStatus !== "member" && b.invitationStatus === "member") return -1;
      const nameA = (a.fullName || a.username || "").toLowerCase();
      const nameB = (b.fullName || b.username || "").toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [results]);

  const sentInvitations = (sent as SentGroupInvitation[] | undefined) ?? [];

  const handleInvite = async (userId: string) => {
    try {
      await invite.mutateAsync(userId);
    } catch {
      toast.error(t("groups.invitations.inviteFailed"));
    }
  };

  const handleCancel = async (invitationId: string) => {
    try {
      await cancel.mutateAsync(invitationId);
    } catch {
      toast.error(t("groups.invitations.cancelFailed"));
    }
  };

  const isBusy = invite.loading || cancel.loading;

  return (
    <div className="mt-4 overflow-hidden bg-white shadow-sm sm:rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="mb-4 text-lg leading-6 font-medium text-gray-900">
          {t("groups.invitations.searchTitle", { groupName })}
        </h3>

        <div className="relative mb-4">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            className="pl-9"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("groups.invitations.searchPlaceholder")}
            aria-label={t("groups.invitations.searchPlaceholder")}
          />
        </div>

        {isSearching && debouncedQuery.length >= 1 && (
          <p className="text-muted-foreground py-4 text-center text-sm">
            <Loader2 className="inline size-4 animate-spin" />
          </p>
        )}

        {!isSearching && debouncedQuery.length >= 1 && users.length === 0 && (
          <p className="text-muted-foreground py-4 text-center text-sm">
            {t("groups.invitations.noResults")}
          </p>
        )}

        <div className="space-y-2">
          {users.map((user) => {
            const displayName = user.fullName || user.username || "";

            return (
              <Card key={user.id} className="py-0">
                <CardContent className="flex items-center gap-3 px-3 py-2.5">
                  <AvatarPreview
                    url={user.avatarUrl}
                    previewUrl={null}
                    size="small"
                    fallback={{
                      username: user.username,
                      full_name: user.fullName,
                      email: user.username || "user",
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{displayName}</p>
                    {user.username && user.fullName && (
                      <p className="text-muted-foreground truncate text-sm">@{user.username}</p>
                    )}
                  </div>

                  {user.invitationStatus === "none" && (
                    <Button
                      variant="yellow"
                      size="sm"
                      onClick={() => handleInvite(user.id)}
                      disabled={isBusy}
                    >
                      <UserPlus className="size-4" />
                      {t("groups.invitations.invite")}
                    </Button>
                  )}

                  {user.invitationStatus === "invited" && user.invitationId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCancel(user.invitationId!)}
                      disabled={isBusy}
                    >
                      {t("groups.invitations.cancelInvite")}
                    </Button>
                  )}

                  {user.invitationStatus === "member" && (
                    <span className="text-muted-foreground text-sm">
                      {t("groups.invitations.member")}
                    </span>
                  )}

                  {user.invitationStatus === "requested" && (
                    <span className="text-muted-foreground text-sm">
                      {t("groups.invitations.reviewRequest")}
                    </span>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {sentInvitations.length > 0 && (
          <div className="mt-6">
            <h4 className="mb-2 text-sm font-medium text-gray-900">
              {t("groups.invitations.sentTitle")}
            </h4>
            <div className="space-y-2">
              {sentInvitations.map((invitation) => {
                const name = invitation.invitee.fullName || invitation.invitee.username || "";

                return (
                  <Card key={invitation.id} className="py-0">
                    <CardContent className="flex items-center gap-3 px-3 py-2.5">
                      <AvatarPreview
                        url={invitation.invitee.avatarUrl}
                        previewUrl={null}
                        size="small"
                        fallback={{
                          username: invitation.invitee.username,
                          full_name: invitation.invitee.fullName,
                          email: invitation.invitee.username || "user",
                        }}
                      />
                      <p className="min-w-0 flex-1 truncate font-medium">{name}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCancel(invitation.id)}
                        disabled={isBusy}
                      >
                        {t("groups.invitations.cancelInvite")}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
