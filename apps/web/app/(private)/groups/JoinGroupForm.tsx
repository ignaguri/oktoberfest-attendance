"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFestival } from "@/contexts/FestivalContext";
import { useJoinGroup } from "@/hooks/useGroups";
import { apiClient } from "@/lib/api-client";
import { useTranslation } from "@/lib/i18n/client";
import { joinGroupSchema } from "@/lib/schemas/groups";
import { zodResolver } from "@hookform/resolvers/zod";
import { EyeOff, Eye } from "lucide-react";
import { useTransitionRouter } from "next-view-transitions";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import type { JoinGroupFormData } from "@/lib/schemas/groups";

interface JoinGroupFormProps {
  groupName?: string;
  groupId?: string;
}

export const JoinGroupForm = ({ groupName, groupId }: JoinGroupFormProps) => {
  const { t } = useTranslation();
  const { currentFestival } = useFestival();
  const router = useTransitionRouter();
  const [showPassword, setShowPassword] = useState(false);

  // Use mutation hook for joining groups
  const { mutateAsync: joinGroup, loading: isJoining } = useJoinGroup();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting: formSubmitting },
  } = useForm<JoinGroupFormData>({
    resolver: zodResolver(joinGroupSchema),
    defaultValues: {
      groupName: groupName || "",
      password: "",
    },
  });

  // Direct join when groupId is provided (from group detail page)
  const handleDirectJoin = async () => {
    if (!groupId) {
      toast.error(t("notifications.error.invalidGroup"));
      return;
    }

    try {
      await joinGroup({ groupId });
      toast.success(t("notifications.success.joinedGroup"));
      router.push(`/groups/${groupId}`);
      window.location.reload();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("groups.join.errors.failed"),
      );
    }
  };

  // Search and join by name+password (from groups list page)
  const onSubmit = async (data: JoinGroupFormData) => {
    if (!currentFestival) {
      toast.error(t("notifications.error.noFestivalSelected"));
      return;
    }

    try {
      // Search for the group by name (one-time search as part of join flow)
      const searchResult = await apiClient.groups.search({
        name: data.groupName,
        festivalId: currentFestival.id,
        limit: 1,
      });

      if (!searchResult.data || searchResult.data.length === 0) {
        toast.error(t("notifications.error.groupNotFound"));
        return;
      }

      const foundGroup = searchResult.data[0];

      // Try to join the group (password validation happens server-side)
      // Note: The API uses invite tokens, not passwords. For password-based join,
      // we'll attempt to join and let the server validate.
      await joinGroup({ groupId: foundGroup.id, inviteToken: data.password });
      toast.success(t("notifications.success.joinedGroup"));
      router.push(`/groups/${foundGroup.id}`);
      window.location.reload();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("groups.join.errors.failed"),
      );
    }
  };

  // If groupId is provided, show simple join button
  if (groupId) {
    return (
      <div className="flex flex-col items-center gap-2 space-y-4">
        <p className="text-gray-600">
          {t("groups.join.clickToJoin", { groupName })}
        </p>
        <Button
          type="button"
          variant="yellow"
          className="w-fit"
          disabled={isJoining}
          onClick={handleDirectJoin}
        >
          {isJoining ? t("groups.join.joining") : t("groups.join.submit")}
        </Button>
      </div>
    );
  }

  // Otherwise, show the full form for searching and joining by name+password
  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-2 space-y-2"
    >
      <h3 className="text-xl font-semibold">{t("groups.join.title")}</h3>
      <Input
        type="text"
        placeholder={t("groups.join.namePlaceholder")}
        errorMsg={errors.groupName?.message}
        autoComplete="new-password"
        {...register("groupName")}
      />

      <Input
        type={showPassword ? "text" : "password"}
        placeholder={t("groups.join.passwordPlaceholder")}
        errorMsg={errors.password?.message}
        autoComplete="new-password"
        rightElement={
          <Button
            type="button"
            variant="ghost"
            onClick={() => setShowPassword(!showPassword)}
            className="h-auto cursor-pointer p-0 text-gray-400 hover:bg-transparent"
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </Button>
        }
        {...register("password")}
      />

      <Button
        type="submit"
        variant="yellow"
        className="w-fit self-center"
        disabled={formSubmitting || isJoining}
      >
        {formSubmitting || isJoining
          ? t("groups.join.joining")
          : t("groups.join.submit")}
      </Button>
    </form>
  );
};
