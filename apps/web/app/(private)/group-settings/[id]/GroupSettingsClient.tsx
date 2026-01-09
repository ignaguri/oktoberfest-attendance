"use client";

import { SingleSelect } from "@/components/Select/SingleSelect";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useUpdateGroup,
  useRemoveMember,
  useRenewInviteToken,
} from "@/hooks/useGroups";
import { useWinningCriterias } from "@/hooks/useLeaderboard";
import { useCurrentUser } from "@/lib/data";
import { useTranslation } from "@/lib/i18n/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { GroupSettingsFormSchema } from "@prostcounter/shared/schemas";
import { Link, Copy, Check } from "lucide-react";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import type { GroupSettingsForm } from "@prostcounter/shared/schemas";
import type { WinningCriteriaOption } from "@prostcounter/shared/schemas";

// Winning criteria as string literals (matching API response)
type WinningCriteriaString = "days_attended" | "total_beers" | "avg_beers";

// Type matching the API response for group data
type GroupData = {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  festival_id: string;
  winning_criteria: WinningCriteriaString;
  invite_token: string;
  created_at: string;
};

// Map winning criteria string to ID
const WINNING_CRITERIA_TO_ID: Record<WinningCriteriaString, number> = {
  days_attended: 1,
  total_beers: 2,
  avg_beers: 3,
};

type Props = {
  group: GroupData;
  members: { id: string; username: string | null; full_name: string | null }[];
};

export default function GroupSettingsClient({ group, members }: Props) {
  const { t } = useTranslation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);

  // Get current user from session
  const { data: currentUserData } = useCurrentUser();
  const userId = currentUserData?.id;
  const isCreator = userId === group.created_by;

  const { data: winningCriterias = [] } = useWinningCriterias();

  // Mutations
  const { mutateAsync: updateGroup, loading: isUpdating } = useUpdateGroup();
  const { mutateAsync: removeMember, loading: isRemoving } = useRemoveMember();
  const { mutateAsync: renewToken, loading: isGeneratingToken } =
    useRenewInviteToken();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<GroupSettingsForm>({
    resolver: zodResolver(GroupSettingsFormSchema),
    defaultValues: {
      name: group.name,
      description: group.description || "",
      winning_criteria_id: WINNING_CRITERIA_TO_ID[group.winning_criteria] || 2,
    },
  });

  const winningCriteriaId = watch("winning_criteria_id");

  const onSubmit = useCallback(
    async (data: GroupSettingsForm) => {
      if (!isCreator) {
        alert(t("apiErrors.NOT_GROUP_CREATOR"));
        return;
      }

      try {
        await updateGroup({
          groupId: group.id,
          updates: {
            name: data.name,
            winningCriteriaId: data.winning_criteria_id,
            description: data.description || null,
          },
        });

        toast.success(t("notifications.success.groupUpdated"));
      } catch {
        toast.error(t("notifications.error.groupUpdateFailed"));
      }
    },
    [isCreator, group.id, updateGroup, t],
  );

  const handleRemoveMember = useCallback(async () => {
    if (!isCreator || !selectedUserId) return;

    try {
      await removeMember({ groupId: group.id, userId: selectedUserId });
      toast.success(t("notifications.success.memberRemoved"));
    } catch {
      toast.error(t("notifications.error.memberRemoveFailed"));
    } finally {
      setIsDialogOpen(false);
      setSelectedUserId(null);
    }
  }, [isCreator, group.id, selectedUserId, removeMember, t]);

  const handleCopyToClipboard = useCallback(
    async (token?: string) => {
      const tokenToCopy = token || inviteToken;
      if (!tokenToCopy) return;

      try {
        const inviteUrl = `${window.location.origin}/join-group?token=${tokenToCopy}`;
        await navigator.clipboard.writeText(inviteUrl);
        setCopiedToClipboard(true);
        toast.success(t("notifications.success.linkCopied"));

        // Reset the copied state after 2 seconds
        setTimeout(() => setCopiedToClipboard(false), 2000);
      } catch {
        toast.error(t("notifications.error.copyFailed"));
      }
    },
    [inviteToken, t],
  );

  const handleRegenerateToken = useCallback(async () => {
    if (!isCreator) return;

    try {
      const { inviteToken: newToken } = await renewToken({ groupId: group.id });
      setInviteToken(newToken);
      toast.success(t("notifications.success.tokenRegenerated"), {
        description: t("notifications.descriptions.tokenRegenerated"),
      });
      // Copy the new token to clipboard
      handleCopyToClipboard(newToken);
    } catch (error) {
      toast.error(t("notifications.error.tokenRegenFailed"), {
        description:
          error instanceof Error ? error.message : t("common.errors.generic"),
      });
    }
  }, [isCreator, group.id, renewToken, handleCopyToClipboard, t]);

  return (
    <div className="w-full max-w-lg">
      <h2 className="text-2xl font-semibold">{t("groups.settings.title")}</h2>
      <div className="overflow-hidden bg-white shadow-sm sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="mb-4 text-lg leading-6 font-medium text-gray-900">
            {t("groups.settings.groupDetails")}
          </h3>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700"
              >
                {t("groups.create.nameLabel")}
              </Label>
              <Input
                type="text"
                id="name"
                className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-xs"
                disabled={!isCreator}
                errorMsg={errors.name?.message}
                {...register("name")}
              />
            </div>

            <div>
              <Label
                htmlFor="description"
                className="block text-sm font-medium text-gray-700"
              >
                {t("groups.settings.descriptionLabel")}
              </Label>
              <Textarea
                id="description"
                rows={3}
                className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-xs"
                disabled={!isCreator}
                errorMsg={errors.description?.message}
                {...register("description")}
              />
            </div>

            <div>
              <Label
                htmlFor="winning_criteria_id"
                className="block text-sm font-medium text-gray-700"
              >
                {t("groups.create.winningCriteria")}
              </Label>
              <SingleSelect
                id="winning_criteria_id"
                options={[
                  {
                    options: (winningCriterias ?? []).map(
                      (criteria: WinningCriteriaOption) => ({
                        value: criteria.id.toString(),
                        label: t(`groups.winningCriteria.${criteria.name}`),
                      }),
                    ),
                  },
                ]}
                placeholder="Select winning criteria"
                disabled={!isCreator}
                value={winningCriteriaId?.toString() || ""}
                onSelect={(option) => {
                  setValue("winning_criteria_id", parseInt(option.value));
                }}
                errorMsg={errors.winning_criteria_id?.message}
              />
            </div>

            {isCreator && (
              <div>
                <Button type="submit" variant="yellow" disabled={isUpdating}>
                  {isUpdating
                    ? t("common.buttons.loading")
                    : t("groups.settings.updateButton")}
                </Button>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Invite Token Section */}
      {isCreator && (
        <div className="mt-4 overflow-hidden bg-white shadow-sm sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="mb-4 text-lg leading-6 font-medium text-gray-900">
              {t("groups.settings.inviteLink")}
            </h3>
            <div className="mb-4 space-y-2">
              <p className="text-sm text-gray-600">
                {t("groups.settings.inviteLinkDescription")}
              </p>
              <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
                <p className="font-medium">
                  {t("groups.settings.tokenExpiresTitle")}
                </p>
                <p>{t("groups.settings.tokenExpiresDescription")}</p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex space-x-2">
                <Input
                  type="text"
                  value={
                    inviteToken
                      ? `${window.location.origin}/join-group?token=${inviteToken}`
                      : t("groups.settings.generatePrompt")
                  }
                  readOnly
                  className="text-muted-foreground flex-1"
                  placeholder={t("groups.settings.generatePrompt")}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleCopyToClipboard()}
                  disabled={!inviteToken}
                  className="px-3"
                >
                  {copiedToClipboard ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>

              <Button
                type="button"
                variant="yellow"
                onClick={handleRegenerateToken}
                disabled={isGeneratingToken}
                className="flex w-fit items-center self-center"
              >
                <Link className="mr-2 h-4 w-4" />
                {isGeneratingToken
                  ? t("common.buttons.loading")
                  : t("groups.settings.generateButton")}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4">
        <h3 className="mb-2 text-xl font-semibold">
          {t("groups.settings.members")}
        </h3>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-xs font-medium tracking-wider text-gray-500 uppercase">
                {t("profile.account.usernameLabel")}
              </th>
              <th className="px-6 py-3 text-xs font-medium tracking-wider text-gray-500 uppercase">
                {t("common.labels.name")}
              </th>
              {isCreator && (
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-gray-500 uppercase">
                  {t("groups.settings.actions")}
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {members.map((member) => (
              <tr key={member.id}>
                <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                  {member.username || "–"}
                </td>
                <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                  {member.full_name || "–"}
                </td>
                {isCreator && (
                  <td className="px-6 py-4 text-sm font-medium whitespace-nowrap">
                    <Button
                      variant="ghost"
                      className="text-red-600 underline hover:text-red-900 disabled:text-gray-400 disabled:no-underline"
                      disabled={member.id === userId}
                      onClick={() => {
                        setSelectedUserId(member.id);
                        setIsDialogOpen(true);
                      }}
                    >
                      {t("groups.settings.kickOut")}
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogOverlay />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("groups.settings.confirmRemoveTitle")}</DialogTitle>
            <DialogDescription>
              {t("groups.settings.confirmRemoveDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={isRemoving}
              >
                {t("common.buttons.cancel")}
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleRemoveMember}
              disabled={isRemoving}
            >
              {isRemoving
                ? t("common.buttons.loading")
                : t("common.buttons.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
