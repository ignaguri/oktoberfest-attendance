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
import { winningCriteriaText } from "@/lib/constants";
import { useCurrentUser } from "@/lib/data";
import { groupSettingsSchema } from "@/lib/schemas/groups";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, Copy, Check } from "lucide-react";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import type { GroupSettingsFormData } from "@/lib/schemas/groups";
import type { WinningCriteria } from "@/lib/types";

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
  } = useForm<GroupSettingsFormData>({
    resolver: zodResolver(groupSettingsSchema),
    defaultValues: {
      name: group.name,
      description: group.description || "",
      winning_criteria_id: WINNING_CRITERIA_TO_ID[group.winning_criteria] || 2,
    },
  });

  const winningCriteriaId = watch("winning_criteria_id");

  const onSubmit = useCallback(
    async (data: GroupSettingsFormData) => {
      if (!isCreator) {
        alert("Only the group creator can update group details.");
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

        toast.success("Group updated successfully!", {
          description: "Your group details have been updated.",
        });
      } catch {
        toast.error("Error updating group", {
          description: "An unexpected error occurred while updating the group.",
        });
      }
    },
    [isCreator, group.id, updateGroup],
  );

  const handleRemoveMember = useCallback(async () => {
    if (!isCreator || !selectedUserId) return;

    try {
      await removeMember({ groupId: group.id, userId: selectedUserId });
      toast.success("Member removed successfully!", {
        description: "The member has been removed from the group.",
      });
    } catch {
      toast.error("Error removing member", {
        description: "An unexpected error occurred while removing the member.",
      });
    } finally {
      setIsDialogOpen(false);
      setSelectedUserId(null);
    }
  }, [isCreator, group.id, selectedUserId, removeMember]);

  const handleCopyToClipboard = useCallback(
    async (token?: string) => {
      const tokenToCopy = token || inviteToken;
      if (!tokenToCopy) return;

      try {
        const inviteUrl = `${window.location.origin}/join-group?token=${tokenToCopy}`;
        await navigator.clipboard.writeText(inviteUrl);
        setCopiedToClipboard(true);
        toast.success("Invite link copied to clipboard!");

        // Reset the copied state after 2 seconds
        setTimeout(() => setCopiedToClipboard(false), 2000);
      } catch {
        toast.error("Failed to copy to clipboard");
      }
    },
    [inviteToken],
  );

  const handleRegenerateToken = useCallback(async () => {
    if (!isCreator) return;

    try {
      const { inviteToken: newToken } = await renewToken({ groupId: group.id });
      setInviteToken(newToken);
      toast.success("Invite token regenerated!", {
        description: "A new invitation link has been generated for your group.",
      });
      // Copy the new token to clipboard
      handleCopyToClipboard(newToken);
    } catch (error) {
      toast.error("Error regenerating token", {
        description:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred.",
      });
    }
  }, [isCreator, group.id, renewToken, handleCopyToClipboard]);

  return (
    <div className="w-full max-w-lg">
      <h2 className="text-2xl font-semibold">Group Settings</h2>
      <div className="bg-white shadow-sm overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
            Group Details
          </h3>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700"
              >
                Group Name
              </Label>
              <Input
                type="text"
                id="name"
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-xs p-2"
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
                Group Description
              </Label>
              <Textarea
                id="description"
                rows={3}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-xs p-2"
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
                Winning Criteria
              </Label>
              <SingleSelect
                id="winning_criteria_id"
                options={[
                  {
                    options: (winningCriterias ?? []).map((criteria) => ({
                      value: criteria.id.toString(),
                      label:
                        winningCriteriaText[criteria.name as WinningCriteria],
                    })),
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
                  {isUpdating ? "Updating..." : "Update Group"}
                </Button>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Invite Token Section */}
      {isCreator && (
        <div className="bg-white shadow-sm overflow-hidden sm:rounded-lg mt-4">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Invite Link
            </h3>
            <div className="space-y-2 mb-4">
              <p className="text-sm text-gray-600">
                Share this link with people you want to invite to your group.
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 text-sm text-yellow-800">
                <p className="font-medium">⏰ Token expires in 7 days</p>
                <p>
                  Generate a new link when the current one expires to ensure
                  your invites remain active.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex space-x-2">
                <Input
                  type="text"
                  value={
                    inviteToken
                      ? `${window.location.origin}/join-group?token=${inviteToken}`
                      : "Generate a new invite link ↓"
                  }
                  readOnly
                  className="flex-1 text-muted-foreground"
                  placeholder="Generate a new invite link"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleCopyToClipboard()}
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
                variant="yellow"
                onClick={handleRegenerateToken}
                disabled={isGeneratingToken}
                className="flex items-center w-fit self-center"
              >
                <Link className="w-4 h-4 mr-2" />
                {isGeneratingToken
                  ? "Generating..."
                  : "Generate New Invite Link"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4">
        <h3 className="text-xl font-semibold mb-2">Group Members</h3>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Username
              </th>
              <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              {isCreator && (
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {members.map((member) => (
              <tr key={member.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {member.username || "–"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {member.full_name || "–"}
                </td>
                {isCreator && (
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <Button
                      variant="ghost"
                      className="text-red-600 hover:text-red-900 underline disabled:text-gray-400 disabled:no-underline"
                      disabled={member.id === userId}
                      onClick={() => {
                        setSelectedUserId(member.id);
                        setIsDialogOpen(true);
                      }}
                    >
                      Kick out
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
            <DialogTitle>Confirm Removal</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this member?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={isRemoving}
              >
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleRemoveMember}
              disabled={isRemoving}
            >
              {isRemoving ? "Removing..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
