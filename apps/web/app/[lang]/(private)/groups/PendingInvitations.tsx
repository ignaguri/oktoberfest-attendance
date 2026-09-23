"use client";

import { useFestival } from "@prostcounter/shared/contexts";
import type { GroupInvitation } from "@prostcounter/shared/schemas";
import { Check, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AvatarPreview } from "@/components/Avatar/Avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  useAcceptGroupInvitation,
  useDeclineGroupInvitation,
  useIncomingGroupInvitations,
} from "@prostcounter/shared/hooks";
import { translateError, useTranslation } from "@/lib/i18n/client";

export default function PendingInvitations() {
  const { t } = useTranslation();
  const router = useRouter();
  const { currentFestival, festivals } = useFestival();
  const { data } = useIncomingGroupInvitations();
  const accept = useAcceptGroupInvitation();
  const decline = useDeclineGroupInvitation();

  const invitations = (data as GroupInvitation[] | undefined) ?? [];

  if (invitations.length === 0) {
    return null;
  }

  // Coded API errors set `error.code` to the error code itself, so a specific
  // message (e.g. the invitation was already answered) can be shown instead of
  // the generic fallback. i18next returns the key when it is missing, which is
  // how we detect an unmapped code without a defaultValue.
  const getErrorMessage = (error: unknown, fallbackKey: string): string => {
    const code = (error as { code?: string })?.code;
    if (code) {
      const key = `apiErrors.${code}`;
      const translated = translateError(t, code);
      if (translated !== key) {
        return translated;
      }
    }
    return t(fallbackKey);
  };

  const handleAccept = async (invitationId: string) => {
    try {
      await accept.mutateAsync(invitationId);
      // The groups list comes from server props
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error, "groups.invitations.acceptFailed"));
    }
  };

  const handleDecline = async (invitationId: string) => {
    try {
      await decline.mutateAsync(invitationId);
    } catch (error) {
      toast.error(getErrorMessage(error, "groups.invitations.declineFailed"));
    }
  };

  const isBusy = accept.loading || decline.loading;

  return (
    <div className="overflow-hidden bg-white shadow-sm sm:rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="mb-4 text-lg leading-6 font-medium text-gray-900">
          {t("groups.invitations.sectionTitle")}
        </h3>
        <div className="space-y-2">
          {invitations.map((invitation) => {
            const { inviter } = invitation;
            const inviterName = inviter.fullName || inviter.username || "";
            // Groups lists are festival-scoped, so an invitation for a group
            // outside the active festival needs a label: accepting it joins a
            // group that then shows up nowhere in the app otherwise.
            const otherFestival =
              invitation.festivalId !== currentFestival?.id
                ? festivals.find((festival) => festival.id === invitation.festivalId)
                : undefined;

            return (
              <Card key={invitation.id} className="py-0">
                <CardContent className="flex items-center gap-3 px-3 py-2.5">
                  <AvatarPreview
                    url={inviter.avatarUrl}
                    previewUrl={null}
                    size="small"
                    fallback={{
                      username: inviter.username,
                      full_name: inviter.fullName,
                      email: inviter.username || "user",
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {t("groups.invitations.invitedYou", {
                        inviterName,
                        groupName: invitation.groupName,
                      })}
                    </p>
                    {otherFestival && (
                      <p className="truncate text-sm text-gray-500">
                        {t("groups.carryOver.fromFestival", { festival: otherFestival.name })}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="yellow"
                      size="sm"
                      onClick={() => handleAccept(invitation.id)}
                      disabled={isBusy}
                    >
                      {accept.loading ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Check className="size-4" />
                      )}
                      {t("groups.invitations.accept")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDecline(invitation.id)}
                      disabled={isBusy}
                    >
                      <X className="size-4" />
                      {t("groups.invitations.decline")}
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
