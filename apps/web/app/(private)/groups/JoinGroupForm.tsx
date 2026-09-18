"use client";

// Use standardSchemaResolver instead of zodResolver to avoid Turbopack build failures
// caused by @hookform/resolvers v5.x importing "zod/v4/core" which Turbopack cannot resolve.
// See: https://github.com/colinhacks/zod/issues/4879
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useFestival } from "@prostcounter/shared/contexts";
import { useRequestToJoinGroup } from "@prostcounter/shared/hooks";
import type { JoinGroupForm as JoinGroupFormData } from "@prostcounter/shared/schemas";
import { JoinGroupFormSchema } from "@prostcounter/shared/schemas";
import { useTransitionRouter } from "next-view-transitions";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useJoinGroup } from "@/hooks/useGroups";
import { apiClient } from "@/lib/api-client";
import { translateError, useTranslation } from "@/lib/i18n/client";

interface JoinGroupFormProps {
  groupName?: string;
  groupId?: string;
}

export const JoinGroupForm = ({ groupName, groupId }: JoinGroupFormProps) => {
  const { t } = useTranslation();
  const { currentFestival } = useFestival();
  const router = useTransitionRouter();

  // Use mutation hook for joining groups
  const { mutateAsync: joinGroup, loading: isJoining } = useJoinGroup();
  const { mutateAsync: requestToJoin, loading: isRequesting } = useRequestToJoinGroup();

  const {
    register,
    handleSubmit,
    getValues,
    trigger,
    formState: { errors, isSubmitting: formSubmitting },
  } = useForm<JoinGroupFormData>({
    resolver: standardSchemaResolver(JoinGroupFormSchema),
    defaultValues: {
      groupName: groupName || "",
      inviteLink: "",
    },
  });

  // The invite link (or the bare token in it) is what authorizes the join; the
  // API pulls the token out of a pasted link.
  const onSubmit = async (data: JoinGroupFormData) => {
    try {
      let targetGroupId = groupId;

      // From the groups list there is no group yet: find it by name first
      if (!targetGroupId) {
        if (!currentFestival) {
          toast.error(t("notifications.error.noFestivalSelected"));
          return;
        }

        const searchResult = await apiClient.groups.search({
          name: data.groupName,
          festivalId: currentFestival.id,
          limit: 1,
        });

        if (!searchResult.data || searchResult.data.length === 0) {
          toast.error(t("notifications.error.groupNotFound"));
          return;
        }

        targetGroupId = searchResult.data[0].id;
      }

      await joinGroup({ groupId: targetGroupId, inviteToken: data.inviteLink });
      toast.success(t("notifications.success.joinedGroup"));
      router.push(`/groups/${targetGroupId}`);
      window.location.reload();
    } catch (error) {
      // A wrong link is the common failure; its message is the raw error code
      if ((error as { code?: string })?.code === "INVALID_INVITE_TOKEN") {
        toast.error(translateError(t, "INVALID_INVITE_TOKEN"));
      } else {
        toast.error(error instanceof Error ? error.message : t("groups.join.errors.failed"));
      }
    }
  };

  // No invite link: ask the group's creator instead. Only the name is needed.
  const onRequestToJoin = async () => {
    const isNameValid = await trigger("groupName");
    if (!isNameValid) {
      return;
    }
    if (!currentFestival) {
      toast.error(t("notifications.error.noFestivalSelected"));
      return;
    }

    try {
      const trimmedName = getValues("groupName").trim();
      const typedName = trimmedName.toLowerCase();
      const searchResult = await apiClient.groups.search({
        name: trimmedName,
        festivalId: currentFestival.id,
        limit: 10,
      });
      // The search matches substrings, so only an exact name counts as the target
      const match = searchResult.data?.find(
        (group) => group.name.trim().toLowerCase() === typedName,
      );
      if (!match) {
        toast.error(t("notifications.error.groupNotFound"));
        return;
      }

      await requestToJoin(match.id);
      toast.success(t("groups.joinRequests.requestSent", { groupName: match.name }));
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code === "JOIN_REQUEST_PENDING" || code === "ALREADY_GROUP_MEMBER") {
        toast.error(translateError(t, code));
      } else {
        toast.error(t("groups.joinRequests.requestFailed"));
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-2 space-y-2">
      {!groupId && <h3 className="text-xl font-semibold">{t("groups.join.title")}</h3>}
      {!groupId && (
        <Input
          type="text"
          placeholder={t("groups.join.namePlaceholder")}
          errorMsg={errors.groupName?.message}
          autoComplete="off"
          {...register("groupName")}
        />
      )}

      <Input
        type="text"
        placeholder={t("groups.join.inviteLinkPlaceholder")}
        errorMsg={errors.inviteLink?.message}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        {...register("inviteLink")}
      />
      <p className="text-sm text-gray-500">{t("groups.join.inviteLinkHelp")}</p>

      <div className="flex flex-wrap justify-center gap-2">
        <Button
          type="submit"
          variant="yellow"
          className="w-fit"
          disabled={formSubmitting || isJoining || isRequesting}
        >
          {formSubmitting || isJoining ? t("groups.join.joining") : t("groups.join.submit")}
        </Button>
        {!groupId && (
          <Button
            type="button"
            variant="outline"
            className="w-fit"
            onClick={onRequestToJoin}
            disabled={formSubmitting || isJoining || isRequesting}
          >
            {t("groups.joinRequests.requestToJoin")}
          </Button>
        )}
      </div>
    </form>
  );
};
