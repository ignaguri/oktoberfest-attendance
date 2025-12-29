"use client";

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
import { searchKeys } from "@/lib/data/search-query-keys";
import { logger } from "@/lib/logger";
import { groupSchema } from "@/lib/schemas/admin";
import { getAvatarUrl } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, Check, Link } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import type { Tables } from "@/lib/database.types";
import type { GroupFormData } from "@/lib/schemas/admin";

import { regenerateInviteToken } from "../../group-settings/[id]/actions";
import {
  updateGroup,
  deleteGroup,
  getGroupMembers,
  getWinningCriteria,
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
  onSubmit: (data: GroupFormData) => Promise<void>;
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
  } = useForm<GroupFormData>({
    resolver: zodResolver(groupSchema),
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
        <Label className="block font-semibold mb-2">
          Members ({members.length})
        </Label>
        <div className="max-h-40 overflow-y-auto border rounded-md p-2">
          {members.length === 0 ? (
            <p className="text-muted-foreground text-sm">No members yet</p>
          ) : (
            <div className="space-y-2">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-2 p-2 bg-muted rounded"
                >
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                    {member.profiles.avatar_url ? (
                      <Image
                        src={getAvatarUrl(member.profiles.avatar_url) || ""}
                        alt={
                          member.profiles.full_name || member.profiles.username
                        }
                        width={32}
                        height={32}
                        className="w-8 h-8 rounded-full"
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
                    <p className="font-medium text-sm">
                      {member.profiles.full_name ||
                        member.profiles.username ||
                        "Unknown User"}
                    </p>
                    <p className="text-xs text-muted-foreground">
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
        <Label className="block font-semibold mb-2">Invite Link</Label>

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
                <Check className="w-4 h-4 text-green-600" />
              ) : (
                <Copy className="w-4 h-4" />
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
            <Link className="w-4 h-4 mr-2" />
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
      toast.error("Failed to load group data");
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
      const newToken = await regenerateInviteToken(selectedGroup.id);
      setInviteToken(newToken);
      toast.success("Invite token regenerated!", {
        description: "A new invitation link has been generated for the group.",
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
      toast.error("Error regenerating token", {
        description:
          "An unexpected error occurred while regenerating the token.",
      });
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
      toast.success("Invite link copied to clipboard!");

      // Reset the copied state after 2 seconds
      setTimeout(() => setCopiedToClipboard(false), 2000);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  async function handleUpdateGroup(data: GroupFormData) {
    if (!selectedGroup) return;
    try {
      await updateGroup(selectedGroup.id, data);
      setSelectedGroup(null);
      toast.success("Group updated successfully");
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
      toast.error("Failed to update group");
    }
  }

  async function handleDeleteGroup(groupId: string) {
    try {
      await deleteGroup(groupId);
      toast.success("Group deleted successfully");
      handleRefresh();
    } catch (error) {
      logger.error(
        "Error deleting group",
        logger.clientComponent("GroupList", { action: "deleteGroup", groupId }),
        error as Error,
      );
      toast.error("Failed to delete group");
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Group List</h2>

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
