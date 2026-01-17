"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Tables } from "@prostcounter/db";
import type { AdminGroupForm } from "@prostcounter/shared/schemas";
import { AdminGroupFormSchema } from "@prostcounter/shared/schemas";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Link } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { GroupSearch } from "@/components/admin/search/GroupSearch";
import ResponsiveDialog from "@/components/ResponsiveDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api-client";
import { searchKeys } from "@/lib/data/search-query-keys";
import { useTranslation } from "@/lib/i18n/client";
import { logger } from "@/lib/logger";
import { getAvatarUrl } from "@/lib/utils";

import {
  deleteGroup,
  getGroupMembers,
  getWinningCriteria,
  updateGroup,
} from "../actions";

const GroupEditForm = ({
  group,
  onSubmit,
  winningCriteria,
  members,
  inviteToken,
  onRegenerateToken,
  onCopyToClipboard,
  isGeneratingToken,
  copiedToClipboard,
}: {
  group: Tables<"groups">;
  onSubmit: (data: AdminGroupForm) => Promise<void>;
  winningCriteria: Tables<"winning_criteria">[];
  members: any[];
  inviteToken: string | null;
  onRegenerateToken: () => void;
  onCopyToClipboard: () => void;
  isGeneratingToken: boolean;
  copiedToClipboard: boolean;
}) => {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AdminGroupForm>({
    resolver: zodResolver(AdminGroupFormSchema),
    defaultValues: {
      name: group.name,
      description: group.description || "",
      winning_criteria_id: group.winning_criteria_id,
    },
  });

  const selectedCriteriaId = watch("winning_criteria_id");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="name" className="block">
          Group Name
        </Label>
        <Input
          type="text"
          id="name"
          className="input"
          errorMsg={errors.name?.message}
          {...register("name")}
        />
      </div>
      <div>
        <Label htmlFor="description" className="block">
          Description
        </Label>
        <Textarea
          id="description"
          className="input"
          errorMsg={errors.description?.message}
          {...register("description")}
        />
      </div>
      <div>
        <Label htmlFor="winning_criteria_id" className="block">
          Winning Criteria
        </Label>
        <Select
          value={selectedCriteriaId?.toString()}
          onValueChange={(value) =>
            setValue("winning_criteria_id", parseInt(value))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select winning criteria" />
          </SelectTrigger>
          <SelectContent>
            {winningCriteria.map((criteria) => (
              <SelectItem key={criteria.id} value={criteria.id.toString()}>
                {criteria.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.winning_criteria_id && (
          <span className="error">{errors.winning_criteria_id.message}</span>
        )}
      </div>

      {/* Members Section */}
      <div>
        <Label className="mb-2 block font-semibold">
          Members ({members.length})
        </Label>
        <div className="max-h-40 overflow-y-auto rounded-md border p-2">
          {members.length === 0 ? (
            <p className="text-muted-foreground text-sm">No members yet</p>
          ) : (
            <div className="space-y-2">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="bg-muted flex items-center gap-2 rounded p-2"
                >
                  <div className="bg-primary/10 flex h-8 w-8 items-center justify-center rounded-full">
                    {member.profiles.avatar_url ? (
                      <Image
                        src={getAvatarUrl(member.profiles.avatar_url) || ""}
                        alt={
                          member.profiles.full_name || member.profiles.username
                        }
                        width={32}
                        height={32}
                        className="h-8 w-8 rounded-full"
                      />
                    ) : (
                      <span className="text-sm font-medium">
                        {(member.profiles.full_name ||
                          member.profiles.username ||
                          "U")[0].toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {member.profiles.full_name ||
                        member.profiles.username ||
                        "Unknown User"}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Joined {new Date(member.joined_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Invite Token Section */}
      <div>
        <Label className="mb-2 block font-semibold">Invite Link</Label>

        <div className="space-y-3">
          <div className="flex space-x-2">
            <Input
              type="text"
              value={
                inviteToken
                  ? `${typeof window !== "undefined" ? window.location.origin : ""}/join-group?token=${inviteToken}`
                  : "Generate a new invite link"
              }
              readOnly
              className="flex-1"
              placeholder="Generate a new invite link"
            />
            <Button
              type="button"
              variant="outline"
              onClick={onCopyToClipboard}
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
            variant="outline"
            onClick={onRegenerateToken}
            disabled={isGeneratingToken}
            className="flex items-center"
          >
            <Link className="mr-2 h-4 w-4" />
            {isGeneratingToken ? "Generating..." : "Generate New Invite Link"}
          </Button>
        </div>
      </div>

      <Button type="submit" disabled={isSubmitting}>
        Update Group
      </Button>
    </form>
  );
};

const GroupList = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedGroup, setSelectedGroup] = useState<Tables<"groups"> | null>(
    null,
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false); // State for dialog
  const [members, setMembers] = useState<any[]>([]);
  const [winningCriteria, setWinningCriteria] = useState<
    Tables<"winning_criteria">[]
  >([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);

  const handleRefresh = () => {
    // Invalidate all group search queries to trigger a refresh
    queryClient.invalidateQueries({
      queryKey: searchKeys.groups(),
    });
  };

  async function fetchGroupData(group: Tables<"groups">) {
    setIsLoadingMembers(true);
    try {
      const [membersData, criteriaData] = await Promise.all([
        getGroupMembers(group.id),
        getWinningCriteria(),
      ]);
      setMembers(membersData);
      setWinningCriteria(criteriaData);
    } catch (error) {
      logger.error(
        "Error fetching group data",
        logger.clientComponent("GroupList", {
          action: "fetchGroupData",
          groupId: group.id,
        }),
        error as Error,
      );
      toast.error(t("notifications.error.groupLoadFailed"));
    } finally {
      setIsLoadingMembers(false);
    }
  }

  async function handleGroupSelect(group: Tables<"groups">) {
    setSelectedGroup(group);
    await fetchGroupData(group);
    // Set the current invite token if it exists
    setInviteToken(group.invite_token);
    setIsDialogOpen(true);
  }

  const handleRegenerateToken = async () => {
    if (!selectedGroup) return;

    setIsGeneratingToken(true);
    try {
      const { inviteToken: newToken } = await apiClient.groups.renewToken(
        selectedGroup.id,
      );
      setInviteToken(newToken);
      toast.success(t("notifications.success.tokenRegenerated"), {
        description: t("notifications.descriptions.tokenRegenerated"),
      });
    } catch (error) {
      logger.error(
        "Error regenerating invite token",
        logger.clientComponent("GroupList", {
          action: "regenerateInviteToken",
          groupId: selectedGroup.id,
        }),
        error as Error,
      );
      toast.error(t("notifications.error.tokenRegenFailed"));
    } finally {
      setIsGeneratingToken(false);
    }
  };

  const handleCopyToClipboard = async () => {
    if (!inviteToken) return;

    try {
      const inviteUrl = `${window.location.origin}/join-group?token=${inviteToken}`;
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedToClipboard(true);
      toast.success(t("notifications.success.linkCopied"));

      // Reset the copied state after 2 seconds
      setTimeout(() => setCopiedToClipboard(false), 2000);
    } catch {
      toast.error(t("notifications.error.copyFailed"));
    }
  };

  async function handleUpdateGroup(data: AdminGroupForm) {
    if (!selectedGroup) return;
    try {
      await updateGroup(selectedGroup.id, data);
      setSelectedGroup(null);
      toast.success(t("notifications.success.groupUpdated"));
      setIsDialogOpen(false);
      handleRefresh();
    } catch (error) {
      logger.error(
        "Error updating group",
        logger.clientComponent("GroupList", {
          action: "updateGroup",
          groupId: selectedGroup?.id,
        }),
        error as Error,
      );
      toast.error(t("notifications.error.groupUpdateFailed"));
    }
  }

  async function handleDeleteGroup(groupId: string) {
    try {
      await deleteGroup(groupId);
      toast.success(t("notifications.success.groupDeleted"));
      handleRefresh();
    } catch (error) {
      logger.error(
        "Error deleting group",
        logger.clientComponent("GroupList", { action: "deleteGroup", groupId }),
        error as Error,
      );
      toast.error(t("notifications.error.groupDeleteFailed"));
    }
  }

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">Group List</h2>

      {/* New Search System */}
      <GroupSearch
        onGroupEdit={handleGroupSelect}
        onGroupDelete={handleDeleteGroup}
        onRefresh={handleRefresh}
        showFilters={true}
        showSorting={true}
        showRefresh={true}
      />

      {/* Group Edit Dialog */}
      <ResponsiveDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        title="Edit Group"
        description="Update group details and view members"
      >
        {selectedGroup && (
          <GroupEditForm
            group={selectedGroup}
            onSubmit={handleUpdateGroup}
            winningCriteria={winningCriteria}
            members={members}
            inviteToken={inviteToken}
            onRegenerateToken={handleRegenerateToken}
            onCopyToClipboard={handleCopyToClipboard}
            isGeneratingToken={isGeneratingToken}
            copiedToClipboard={copiedToClipboard}
          />
        )}
        {isLoadingMembers && (
          <div className="flex items-center justify-center py-4">
            <p className="text-muted-foreground">Loading group data...</p>
          </div>
        )}
      </ResponsiveDialog>
    </div>
  );
};

export default GroupList;
