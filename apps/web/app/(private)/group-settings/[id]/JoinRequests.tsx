"use client";

import {
  useAcceptJoinRequest,
  useDeclineJoinRequest,
  useIncomingJoinRequests,
} from "@prostcounter/shared/hooks";
import type { GroupJoinRequest } from "@prostcounter/shared/schemas";
import { Check, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AvatarPreview } from "@/components/Avatar/Avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "@/lib/i18n/client";

/**
 * Pending requests to join this group, for its creator. Renders nothing when
 * there are none.
 */
export function JoinRequests({ groupId }: { groupId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { data } = useIncomingJoinRequests();
  const accept = useAcceptJoinRequest();
  const decline = useDeclineJoinRequest();

  const requests = ((data as GroupJoinRequest[] | undefined) ?? []).filter(
    (request) => request.groupId === groupId,
  );

  if (requests.length === 0) {
    return null;
  }

  const handleAccept = async (requestId: string) => {
    try {
      await accept.mutateAsync(requestId);
      // The members list comes from server props
      router.refresh();
    } catch {
      toast.error(t("groups.joinRequests.acceptFailed"));
    }
  };

  const handleDecline = async (requestId: string) => {
    try {
      await decline.mutateAsync(requestId);
    } catch {
      toast.error(t("groups.joinRequests.declineFailed"));
    }
  };

  const isBusy = accept.loading || decline.loading;

  return (
    <div className="mt-4 overflow-hidden bg-white shadow-sm sm:rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="mb-4 text-lg leading-6 font-medium text-gray-900">
          {t("groups.joinRequests.sectionTitle")}
        </h3>
        <div className="space-y-2">
          {requests.map((request) => {
            const { requester } = request;
            return (
              <Card key={request.id} className="py-0">
                <CardContent className="flex items-center gap-3 px-3 py-2.5">
                  <AvatarPreview
                    url={requester.avatarUrl}
                    previewUrl={null}
                    size="small"
                    fallback={{
                      username: requester.username,
                      full_name: requester.fullName,
                      email: requester.username || "user",
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {requester.fullName || requester.username}
                    </p>
                    {requester.username && requester.fullName && (
                      <p className="text-muted-foreground truncate text-sm">
                        @{requester.username}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="yellow"
                      size="sm"
                      onClick={() => handleAccept(request.id)}
                      disabled={isBusy}
                    >
                      {accept.loading ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Check className="size-4" />
                      )}
                      {t("groups.joinRequests.accept")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDecline(request.id)}
                      disabled={isBusy}
                    >
                      <X className="size-4" />
                      {t("groups.joinRequests.decline")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
