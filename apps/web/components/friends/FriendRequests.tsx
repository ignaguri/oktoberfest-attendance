"use client";

import {
  useAcceptFriendRequest,
  useCancelFriendRequest,
  useDeclineFriendRequest,
  useFriendRequests,
  useOutgoingFriendRequests,
} from "@prostcounter/shared/hooks";
import type { FriendRequest } from "@prostcounter/shared/schemas";
import { Check, Inbox, Loader2, Send, X } from "lucide-react";
import { useCallback } from "react";

import { AvatarPreview } from "@/components/Avatar/Avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/lib/i18n/client";

export function FriendRequests() {
  const { t } = useTranslation();
  const { data: incoming, loading: incomingLoading } = useFriendRequests();
  const { data: outgoing, loading: outgoingLoading } =
    useOutgoingFriendRequests();

  const loading = incomingLoading || outgoingLoading;
  const hasIncoming = incoming && incoming.length > 0;
  const hasOutgoing = outgoing && outgoing.length > 0;

  if (loading) {
    return <RequestsSkeleton />;
  }

  if (!hasIncoming && !hasOutgoing) {
    return (
      <EmptyState
        icon={Inbox}
        title={t("friends.requestsEmpty")}
        description={t("friends.requestsEmpty")}
      />
    );
  }

  return (
    <div className="space-y-6">
      {hasIncoming && (
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-gray-500 uppercase">
            <Inbox className="size-4" />
            {t("friends.requests")}
          </h3>
          <div className="space-y-2">
            {incoming.map((request: FriendRequest) => (
              <IncomingRequestCard key={request.id} request={request} />
            ))}
          </div>
        </section>
      )}

      {hasIncoming && hasOutgoing && <Separator />}

      {hasOutgoing && (
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-gray-500 uppercase">
            <Send className="size-4" />
            {t("friends.request.sent")}
          </h3>
          <div className="space-y-2">
            {outgoing.map((request: FriendRequest) => (
              <OutgoingRequestCard key={request.id} request={request} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

interface RequestProfile {
  id: string;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
}

interface RequestCardProps {
  request: {
    id: string;
    requesterId: string;
    addresseeId: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    profile: RequestProfile;
  };
}

function IncomingRequestCard({ request }: RequestCardProps) {
  const { t } = useTranslation();
  const accept = useAcceptFriendRequest();
  const decline = useDeclineFriendRequest();

  const handleAccept = useCallback(async () => {
    try {
      await accept.mutateAsync(request.id);
    } catch {
      // Error handled by mutation
    }
  }, [accept, request.id]);

  const handleDecline = useCallback(async () => {
    try {
      await decline.mutateAsync(request.id);
    } catch {
      // Error handled by mutation
    }
  }, [decline, request.id]);

  const profile = request.profile;

  return (
    <Card className="py-0">
      <CardContent className="flex items-center gap-3 px-3 py-2.5">
        <AvatarPreview
          url={profile.avatarUrl}
          previewUrl={null}
          size="small"
          fallback={{
            username: profile.username,
            full_name: profile.fullName,
            email: profile.username || "user",
          }}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">
            {profile.fullName || profile.username}
          </p>
          {profile.username && profile.fullName && (
            <p className="text-muted-foreground truncate text-sm">
              @{profile.username}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="yellow"
            size="sm"
            onClick={handleAccept}
            disabled={accept.loading}
          >
            {accept.loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            {t("friends.request.accept")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDecline}
            disabled={decline.loading}
          >
            {decline.loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <X className="size-4" />
            )}
            {t("friends.request.decline")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function OutgoingRequestCard({ request }: RequestCardProps) {
  const { t } = useTranslation();
  const cancel = useCancelFriendRequest();

  const handleCancel = useCallback(async () => {
    try {
      await cancel.mutateAsync(request.id);
    } catch {
      // Error handled by mutation
    }
  }, [cancel, request.id]);

  const profile = request.profile;

  return (
    <Card className="py-0">
      <CardContent className="flex items-center gap-3 px-3 py-2.5">
        <AvatarPreview
          url={profile.avatarUrl}
          previewUrl={null}
          size="small"
          fallback={{
            username: profile.username,
            full_name: profile.fullName,
            email: profile.username || "user",
          }}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">
            {profile.fullName || profile.username}
          </p>
          {profile.username && profile.fullName && (
            <p className="text-muted-foreground truncate text-sm">
              @{profile.username}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCancel}
          disabled={cancel.loading}
        >
          {cancel.loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <X className="size-4" />
          )}
          {t("friends.request.cancel")}
        </Button>
      </CardContent>
    </Card>
  );
}

function RequestsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border p-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  );
}
